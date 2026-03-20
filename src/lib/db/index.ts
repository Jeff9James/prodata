import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5432/postgres";

type PostgresDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: PostgresDb | null = null;
let _sql: postgres.Sql<{}> | null = null;

/**
 * Get the singleton database instance.
 */
export function getDb() {
  if (!_db) {
    _sql = postgres(DATABASE_URL);
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

/**
 * Get the raw SQL client for direct queries if needed.
 */
export function getSql() {
  if (!_sql) {
    _sql = postgres(DATABASE_URL);
  }
  return _sql;
}

/**
 * Close the database connection.
 */
export async function closeDb() {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

/**
 * Create a test database instance (useful for testing).
 */
export function createTestDb() {
  const sql = postgres("postgresql://postgres:password@localhost:5432/postgres");
  const db = drizzle(sql, { schema });
  return { db, sql };
}
