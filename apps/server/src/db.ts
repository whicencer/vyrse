import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// The whole server state lives in one SQLite file.
// better-sqlite3 is synchronous: read, change and write a row with no `await` in between,
// so two requests can't interleave inside one update.
//
// SQL is written only in the features' store.ts files; they get the connection from db().

export type Db = Database.Database;

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

let instance: Db | null = null;

// Opens the database (":memory:" for tests) and brings the schema up to date.
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  instance = db;
  return db;
}

export function db(): Db {
  if (!instance) throw new Error("Database is not open: call openDb() first");
  return instance;
}

export function closeDb() {
  instance?.close();
  instance = null;
}

// Applies migrations/NNN_name.sql in order. The number of the last applied one is
// kept in PRAGMA user_version, so each file runs once.
function migrate(db: Db) {
  const applied = db.pragma("user_version", { simple: true }) as number;

  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .map((file) => ({ file, version: Number(file.split("_")[0]) }))
    .filter((m) => Number.isInteger(m.version) && m.version > applied)
    .sort((a, b) => a.version - b.version);

  for (const { file, version } of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
    console.log(`Database migrated to ${file}`);
  }
}
