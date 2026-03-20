import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projectGroups, projectGroupMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateCsrf, validateLabel } from "@/lib/security";
import { accounts, projects } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MemberInput {
  accountId: string;
  projectId?: string | null;
}

// ─── PUT /api/project-groups/[id] ───────────────────────────────────────────

/**
 * Update a project group (rename, update members).
 *
 * Body: {
 *   name?: string,
 *   members?: Array<{ accountId: string, projectId?: string | null }>
 * }
 *
 * If `members` is provided, the existing members are replaced entirely
 * (delete-and-reinsert strategy, matching the simple local-first approach).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const db = getDb();

  const groupResult = await db
    .select()
    .from(projectGroups)
    .where(eq(projectGroups.id, id))
    .execute();

  const group = groupResult[0];

  if (!group) {
    return NextResponse.json(
      { error: "Project group not found" },
      { status: 404 }
    );
  }

  const now = new Date();

  // Update name if provided
  if (body.name !== undefined) {
    const nameError = validateLabel(body.name);
    if (nameError) {
      return NextResponse.json(
        { error: nameError.message.replace("Label", "Name") },
        { status: 400 }
      );
    }

    await db.update(projectGroups)
      .set({ name: (body.name as string).trim(), updatedAt: now })
      .where(eq(projectGroups.id, id))
      .execute();
  }

  // Replace members if provided
  if (body.members !== undefined) {
    const members = body.members;

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Members must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate all referenced accounts/projects exist
    for (const member of members as MemberInput[]) {
      if (
        typeof member.accountId !== "string" ||
        member.accountId.length === 0
      ) {
        return NextResponse.json(
          { error: "Each member must have a valid accountId" },
          { status: 400 }
        );
      }

      const accountResult = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, member.accountId))
        .execute();
      const account = accountResult[0];
      if (!account) {
        return NextResponse.json(
          { error: `Account "${member.accountId}" not found` },
          { status: 404 }
        );
      }

      if (member.projectId) {
        const projectResult = await db
          .select()
          .from(projects)
          .where(eq(projects.id, member.projectId))
          .execute();
        const project = projectResult[0];
        if (!project) {
          return NextResponse.json(
            { error: `Project "${member.projectId}" not found` },
            { status: 404 }
          );
        }
      }
    }

    // Replace members atomically — delete + reinsert in a single transaction
    // so a crash or concurrent request can't leave the group in a partial state.
    await db.transaction(async (tx) => {
      await tx.delete(projectGroupMembers)
        .where(eq(projectGroupMembers.groupId, id))
        .execute();

      // Get user ID from session
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      for (const member of members as MemberInput[]) {
        await tx.insert(projectGroupMembers)
          .values({
            userId: user.id,
            groupId: id,
            accountId: member.accountId,
            projectId: member.projectId ?? null,
            createdAt: now,
          })
          .execute();
      }

      await tx.update(projectGroups)
        .set({ updatedAt: now })
        .where(eq(projectGroups.id, id))
        .execute();
    });
  }

  return NextResponse.json({ success: true });
}

// ─── DELETE /api/project-groups/[id] ────────────────────────────────────────

/**
 * Delete a project group.
 * Members are cascade-deleted via the FK constraint.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const db = getDb();

  const groupResult = await db
    .select()
    .from(projectGroups)
    .where(eq(projectGroups.id, id))
    .execute();

  const group = groupResult[0];

  if (!group) {
    return NextResponse.json(
      { error: "Project group not found" },
      { status: 404 }
    );
  }

  await db.delete(projectGroups).where(eq(projectGroups.id, id)).execute();

  return NextResponse.json({ success: true });
}
