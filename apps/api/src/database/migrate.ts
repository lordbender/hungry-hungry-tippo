import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationDirCandidates = [
  path.resolve(dirname, "../migrations"),
  path.resolve(dirname, "../../src/migrations"),
  path.resolve(dirname, "../../migrations")
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P03"].includes(String(code));
}

async function resolveMigrationsDir() {
  for (const candidate of migrationDirCandidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // Keep looking; dev and production builds place migrations differently.
    }
  }

  throw new Error(`Could not find migrations directory. Checked: ${migrationDirCandidates.join(", ")}`);
}

async function waitForDatabase(maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = Math.min(500 * attempt, 5000);
      console.log(`Database unavailable, retrying in ${delayMs}ms (${attempt}/${maxAttempts})`);
      await sleep(delayMs);
    }
  }
}

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedMigrationIds() {
  const { rows } = await pool.query<{ id: string }>("select id from schema_migrations");
  return new Set(rows.map((row) => row.id));
}

export async function runMigrations() {
  await waitForDatabase();
  const migrationsDir = await resolveMigrationsDir();
  await ensureMigrationsTable();
  const applied = await appliedMigrationIds();
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query("begin");
    try {
      await pool.query(sql);
      await pool.query("insert into schema_migrations (id) values ($1)", [file]);
      await pool.query("commit");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
