import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema.ts";

type Database = PostgresJsDatabase<typeof schema>;

declare global {
  var __studyDb: Database | undefined;
}

function connect(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See README, Running the app.");
  const client = postgres(url, { max: 10, onnotice: () => {} });
  return drizzle(client, { schema });
}

// One pool per process. Dev reload reuses it instead of opening another.
export function db(): Database {
  globalThis.__studyDb ??= connect();
  return globalThis.__studyDb;
}
