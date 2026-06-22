import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHmac } from "node:crypto";
import { catalog, normalizeAnswer } from "./catalog.js";

function answerHash(answer, pepper) {
  return createHmac("sha256", pepper).update(normalizeAnswer(answer)).digest("hex");
}

export function openDatabase(file, pepper) {
  const path = file === ":memory:" ? file : resolve(file);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      renderer_key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      published INTEGER NOT NULL DEFAULT 1,
      answer_hash TEXT NOT NULL,
      client_completable INTEGER NOT NULL DEFAULT 0,
      hint TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_problem_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      status TEXT NOT NULL CHECK(status IN ('locked','available','cleared')),
      attempts INTEGER NOT NULL DEFAULT 0,
      first_opened_at TEXT,
      cleared_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, problem_id)
    );
    CREATE TABLE IF NOT EXISTS answer_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      submitted_hash TEXT NOT NULL,
      correct INTEGER NOT NULL,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS hint_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      source TEXT NOT NULL DEFAULT 'web',
      used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const hintColumns = db.prepare("PRAGMA table_info(hint_usage)").all();
  if (!hintColumns.some((column) => column.name === "source")) {
    db.exec("ALTER TABLE hint_usage ADD COLUMN source TEXT NOT NULL DEFAULT 'web'");
  }

  const upsert = db.prepare(`
    INSERT INTO problems (id, slug, name, renderer_key, version, published, answer_hash, client_completable, hint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name=excluded.name,
      renderer_key=excluded.renderer_key, version=excluded.version,
      published=excluded.published, answer_hash=excluded.answer_hash,
      client_completable=excluded.client_completable, hint=excluded.hint
  `);
  for (const problem of catalog) {
    upsert.run(problem.id, problem.slug, problem.name, problem.rendererKey,
      problem.version, problem.published ? 1 : 0, answerHash(problem.answer, pepper),
      problem.clientCompletable ? 1 : 0, problem.hint);
  }
  return db;
}

export function initializeProgress(db, userId) {
  const insert = db.prepare(`INSERT OR IGNORE INTO user_problem_progress(user_id, problem_id, status)
    SELECT ?, id, CASE WHEN id=(SELECT MIN(id) FROM problems WHERE published=1) THEN 'available' ELSE 'locked' END
    FROM problems WHERE published=1`);
  insert.run(userId);
}

export function markCleared(db, userId, problemId) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`UPDATE user_problem_progress SET status='cleared', cleared_at=COALESCE(cleared_at,CURRENT_TIMESTAMP),
      updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND problem_id=?`).run(userId, problemId);
    db.prepare(`UPDATE user_problem_progress SET status='available', updated_at=CURRENT_TIMESTAMP
      WHERE user_id=? AND problem_id=(SELECT MIN(id) FROM problems WHERE published=1 AND id>?) AND status='locked'`)
      .run(userId, problemId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export { answerHash };
