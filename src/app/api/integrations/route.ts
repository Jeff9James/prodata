import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { accounts, projects, syncLogs } from "@/lib/db/schema";
import {
  getAllIntegrations,
  getIntegration,
  loadAllIntegrations,
} from "@/integrations/registry";
import { encrypt } from "@/lib/crypto";
import {
  validateCsrf,
  validateLabel,
  validateIntegrationId,
  validateCredentials,
} from "@/lib/security";
import { desc } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Ensure integrations are loaded
let loaded = false;
async function ensureLoaded() {
  if (!loaded) {
    await loadAllIntegrations();
    loaded = true;
  }
}

/**
 * GET /api/integrations
 * Returns all available integrations and their connected accounts.
 */
export async function GET() {
  await ensureLoaded();

  const db = getDb();
  const allIntegrations = getAllIntegrations();
  const allAccounts = await db.select().from(accounts).execute();
  const allProjects = await db.select().from(projects).execute();
  const allSyncLogs = await db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).execute();

  const latestSyncByAccount = new Map<string, (typeof syncLogs.$inferSelect)>();
  for (const log of allSyncLogs) {
    if (!latestSyncByAccount.has(log.accountId)) {
      latestSyncByAccount.set(log.accountId, log);
    }
  }

  const result = allIntegrations.map((integration) => ({
    id: integration.id,
    name: integration.name,
    description: integration.description,
    icon: integration.icon,
    color: integration.color,
    credentials: integration.credentials,
    metricTypes: integration.metricTypes,
    requiredPermissions: integration.requiredPermissions ?? [],
    dateBucketing: integration.dateBucketing ?? "local",
    accounts: allAccounts
      .filter((a) => a.integrationId === integration.id)
      .map((a) => ({
        id: a.id,
        label: a.label,
        isActive: a.isActive,
        createdAt: a.createdAt,
        lastSync: latestSyncByAccount.get(a.id)
          ? {
            status: latestSyncByAccount.get(a.id)!.status,
            startedAt: latestSyncByAccount.get(a.id)!.startedAt,
            completedAt: latestSyncByAccount.get(a.id)!.completedAt,
            error: latestSyncByAccount.get(a.id)!.error,
            recordsProcessed: latestSyncByAccount.get(a.id)!.recordsProcessed,
          }
          : null,
        // Include products (projects) for this account
        products: allProjects
          .filter((p) => p.accountId === a.id)
          .map((p) => ({
            id: p.id,
            label: p.label,
          })),
      })),
  }));

  return NextResponse.json(result);
}

/**
 * POST /api/integrations
 * Connect a new account for an integration.
 *
 * Body: { integrationId: string, label: string, credentials: Record<string, string> }
 */
export async function POST(request: Request) {
  // CSRF check
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  await ensureLoaded();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { integrationId, label, credentials } = body;

  // Validate all inputs
  const integrationIdError = validateIntegrationId(integrationId);
  if (integrationIdError) {
    return NextResponse.json(
      { error: integrationIdError.message },
      { status: 400 }
    );
  }

  const labelError = validateLabel(label);
  if (labelError) {
    return NextResponse.json({ error: labelError.message }, { status: 400 });
  }

  const credentialsError = validateCredentials(credentials);
  if (credentialsError) {
    return NextResponse.json(
      { error: credentialsError.message },
      { status: 400 }
    );
  }

  const integration = getIntegration(integrationId as string);
  if (!integration) {
    return NextResponse.json(
      { error: `Integration "${integrationId}" not found` },
      { status: 404 }
    );
  }

  // Validate credentials against the external service
  const isValid = await integration.fetcher.validateCredentials(
    credentials as Record<string, string>
  );
  if (!isValid) {
    return NextResponse.json(
      {
        error:
          "Invalid credentials. Please check your API key and try again.",
      },
      { status: 401 }
    );
  }

  // Get user ID from session
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  // Encrypt credentials before storing
  const encryptedCredentials = encrypt(JSON.stringify(credentials));

  const result = await db.insert(accounts)
    .values({
      userId: user.id,
      integrationId: integrationId as string,
      label: (label as string).trim(),
      credentials: encryptedCredentials,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const newAccount = result[0];

  return NextResponse.json(
    { id: newAccount.id, integrationId, label, isActive: true },
    { status: 201 }
  );
}
