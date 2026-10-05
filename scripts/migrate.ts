import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  await baselineExistingSchema(client, migrationsFolder);
  await migrate(drizzle(client), { migrationsFolder });
} finally {
  await client.end();
}
console.log("Migrations applied.");

// Databases created before Drizzle already have these tables.
// Record the init migration as applied so Drizzle does not create them again.
async function baselineExistingSchema(client: postgres.Sql, migrationsFolder: string) {
  const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const init = journal.entries[0];
  if (!init) return;

  const [{ participants, sessions, events }] = await client<{ participants: boolean; sessions: boolean; events: boolean }[]>`
    select
      to_regclass('public.participants') is not null as participants,
      to_regclass('public.sessions') is not null as sessions,
      to_regclass('public.events') is not null as events
  `;
  const present = [participants, sessions, events].filter(Boolean).length;
  if (present === 0) return;
  if (present !== 3) throw new Error("Database has some study tables but not all. Refusing to baseline.");

  await client`create schema if not exists drizzle`;
  await client`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `;
  const applied = await client`select 1 from drizzle.__drizzle_migrations where created_at = ${init.when} limit 1`;
  if (applied.length > 0) return;

  const sqlText = readFileSync(`${migrationsFolder}/${init.tag}.sql`, "utf8");
  const hash = createHash("sha256").update(sqlText).digest("hex");
  await client`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${init.when})`;
  console.log("Existing schema recorded as already applied (0000_init).");
}
