import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  projectGroups,
  projectGroupMembers,
  accounts,
  projects,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateCsrf, validateLabel } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MemberInput {
  accountId: string;
  projectId?: string | null;
}

// ─── GET /api/project-groups ────────────────────────────────────────────────

/**
 * Returns all project groups with their members.
 *
 * Response shape:
 * [
 *   {
 *     id, name, createdAt, updatedAt,
 *     members: [{ id, accountId, projectId, accountLabel, projectLabel, integrationId }]
 *   }
 * ]
 */
export async function GET() {
  // Get user ID from session
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const allGroups = await db.select().from(projectGroups).where(eq(projectGroups.userId, user.id)).execute();
  const allMembers = await db.select().from(projectGroupMembers).where(eq(projectGroupMembers.userId, user.id)).execute();
  const allAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id)).execute();
  const accountIds = new Set(allAccounts.map(a => a.id));
  const allProjects = await db.select().from(projects).where(eq(projects.userId, user.id)).execute();

  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
  const projectMap = new Map(allProjects.map((p) => [p.id, p]));

  const membersByGroup = new Map<string, typeof allMembers>();
  for (const m of allMembers) {
    const list = membersByGroup.get(m.groupId) ?? [];
    list.push(m);
    membersByGroup.set(m.groupId, list);
  }

  const result = allGroups.map((group) => {
    const members = (membersByGroup.get(group.id) ?? []).map((m) => {
      const account = accountMap.get(m.accountId);
      const project = m.projectId ? projectMap.get(m.projectId) : null;
      return {
        id: m.id,
        accountId: m.accountId,
        projectId: m.projectId,
        accountLabel: account?.label ?? m.accountId,
        projectLabel: project?.label ?? null,
        integrationId: account?.integrationId ?? null,
      };
    });

    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members,
    };
  });

  return NextResponse.json(result);
}

// ─── POST /api/project-groups ───────────────────────────────────────────────

/**
 * Create a new project group.
 *
 * Body: {
 *   name: string,
 *   members: Array<{ accountId: string, projectId?: string | null }>
 * }
 */
export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, members } = body;

  // Validate name
  const nameError = validateLabel(name);
  if (nameError) {
    return NextResponse.json(
      { error: nameError.message.replace("Label", "Name") },
      { status: 400 }
    );
  }

  // Validate members array
  if (!Array.isArray(members) || members.length === 0) {
    return NextResponse.json(
      { error: "Members must be a non-empty array" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Validate all referenced accounts/projects exist
  for (const member of members as MemberInput[]) {
    if (typeof member.accountId !== "string" || member.accountId.length === 0) {
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

  // Get user ID from session
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Insert group + members atomically so a crash mid-way can't leave
  // an orphaned group with partial members.
  const result = await db.transaction(async (tx) => {
    await tx.insert(projectGroups)
      .values({
        userId: user.id,
        name: (name as string).trim(),
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    const groupResult = await tx.select().from(projectGroups).where(eq(projectGroups.name, (name as string).trim())).execute();
    const groupId = groupResult[0].id;

    for (const member of members as MemberInput[]) {
      await tx.insert(projectGroupMembers)
        .values({
          userId: user.id,
          groupId,
          accountId: member.accountId,
          projectId: member.projectId ?? null,
          createdAt: now,
        })
        .execute();
    }

    return { groupId, name: (name as string).trim() };
  });

  return NextResponse.json({ id: result.groupId, name: result.name }, { status: 201 });
}
