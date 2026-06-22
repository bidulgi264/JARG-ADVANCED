import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword, createSession, authenticate, tokenHash } from "./auth.js";
import { openDatabase, initializeProgress, markCleared, answerHash } from "./database.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

function json(response, status, value, extraHeaders = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders });
  response.end(JSON.stringify(value));
}

async function body(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_768) throw Object.assign(new Error("body_too_large"), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

function progressRows(db, userId) {
  return db.prepare(`SELECT p.id,p.slug,p.name,p.renderer_key AS rendererKey,p.version,
    upp.status,upp.attempts,upp.first_opened_at AS firstOpenedAt,upp.cleared_at AS clearedAt,
    (SELECT COUNT(*) FROM hint_usage h WHERE h.user_id=upp.user_id AND h.problem_id=p.id) AS hintsUsed
    FROM problems p JOIN user_problem_progress upp ON upp.problem_id=p.id
    WHERE upp.user_id=? AND p.published=1 ORDER BY p.id`).all(userId).map((row) => ({
      ...row,
      moduleUrl: row.status === "locked" ? null : `/problems/${row.rendererKey}.js`,
      styleUrl: row.status === "locked" ? null : `/styles/${row.rendererKey}.css`,
    }));
}

function publicUser(user) {
  return { id: Number(user.id), email: user.email, displayName: user.displayName };
}

export function createJargServer(options = {}) {
  const pepper = options.pepper || process.env.ANSWER_PEPPER || "development-only-pepper";
  const emailSecret = options.emailSecret ?? process.env.EMAIL_WEBHOOK_SECRET ?? "";
  const db = options.db || openDatabase(options.dbFile || process.env.DB_FILE || "./data/jarg-advanced.sqlite", pepper);
  const sessionDays = Number(options.sessionDays || process.env.SESSION_DAYS || 30);
  const attempts = new Map();

  function requireUser(request, response) {
    const user = authenticate(db, request);
    if (!user) json(response, 401, { ok: false, reason: "unauthorized" });
    return user;
  }

  function checkRate(userId, problemId) {
    const key = `${userId}:${problemId}`;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    attempts.set(key, recent);
    return recent.length <= 30;
  }

  const server = createServer(async (request, response) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "same-origin");
    response.setHeader("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");
    const url = new URL(request.url, "http://localhost");
    const path = url.pathname;

    try {
      if (path === "/api/health" && request.method === "GET") return json(response, 200, { ok: true, uptime: process.uptime() });

      if (path === "/api/auth/register" && request.method === "POST") {
        const input = await body(request);
        const email = String(input.email || "").trim().toLowerCase();
        const displayName = String(input.displayName || "").trim();
        const password = String(input.password || "");
        if (!emailPattern.test(email) || displayName.length < 2 || displayName.length > 30 || password.length < 8 || password.length > 128) {
          return json(response, 400, { ok: false, reason: "invalid_registration" });
        }
        const passwordHash = await hashPassword(password);
        let result;
        try {
          result = db.prepare("INSERT INTO users(email,display_name,password_hash) VALUES(?,?,?)").run(email, displayName, passwordHash);
        } catch (error) {
          if (String(error.message).includes("UNIQUE")) return json(response, 409, { ok: false, reason: "email_taken" });
          throw error;
        }
        const userId = Number(result.lastInsertRowid);
        initializeProgress(db, userId);
        const session = createSession(db, userId, sessionDays);
        return json(response, 201, { ok: true, token: session.token, expiresAt: session.expiresAt, user: { id: userId, email, displayName } });
      }

      if (path === "/api/auth/login" && request.method === "POST") {
        const input = await body(request);
        const email = String(input.email || "").trim().toLowerCase();
        const row = db.prepare("SELECT id,email,display_name AS displayName,password_hash AS passwordHash FROM users WHERE email=?").get(email);
        if (!row || !(await verifyPassword(String(input.password || ""), row.passwordHash))) {
          return json(response, 401, { ok: false, reason: "invalid_credentials" });
        }
        initializeProgress(db, Number(row.id));
        const session = createSession(db, Number(row.id), sessionDays);
        return json(response, 200, { ok: true, token: session.token, expiresAt: session.expiresAt, user: publicUser(row) });
      }

      if (path === "/api/auth/me" && request.method === "GET") {
        const user = requireUser(request, response); if (!user) return;
        return json(response, 200, { ok: true, user: publicUser(user) });
      }

      if (path === "/api/auth/logout" && request.method === "POST") {
        const auth = request.headers.authorization || "";
        if (auth.startsWith("Bearer ")) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(auth.slice(7).trim()));
        return json(response, 200, { ok: true });
      }

      if (path === "/api/email/hint-access" && request.method === "POST") {
        if (!emailSecret || request.headers["x-email-secret"] !== emailSecret) {
          return json(response, 401, { ok: false, reason: "unauthorized" });
        }
        const input = await body(request);
        const email = String(input.email || "").trim().toLowerCase();
        const problemId = Number(input.problem);
        if (!emailPattern.test(email) || !Number.isInteger(problemId)) {
          return json(response, 400, { ok: false, reason: "invalid_request" });
        }
        const problemExists = db.prepare("SELECT id FROM problems WHERE id=? AND published=1").get(problemId);
        if (!problemExists) return json(response, 404, { ok: false, reason: "unknown_problem" });
        const user = db.prepare("SELECT id,email,display_name AS displayName FROM users WHERE email=?").get(email);
        if (!user) return json(response, 403, { ok: false, reason: "account_not_found" });
        initializeProgress(db, Number(user.id));
        const access = db.prepare(`SELECT p.id,p.name,p.hint,upp.status
          FROM problems p JOIN user_problem_progress upp ON upp.problem_id=p.id
          WHERE p.id=? AND upp.user_id=?`).get(problemId, Number(user.id));
        if (!access || access.status === "locked") {
          return json(response, 403, { ok: false, reason: "problem_locked" });
        }
        db.prepare("INSERT INTO hint_usage(user_id,problem_id,source) VALUES(?,?,'email')").run(Number(user.id), problemId);
        return json(response, 200, {
          ok: true,
          allowed: true,
          problem: { id: access.id, name: access.name, status: access.status },
          hint: access.hint,
        });
      }

      if ((path === "/api/problems" || path === "/api/me/progress") && request.method === "GET") {
        const user = requireUser(request, response); if (!user) return;
        initializeProgress(db, Number(user.id));
        return json(response, 200, { ok: true, problems: progressRows(db, Number(user.id)) });
      }

      if (path === "/api/me/progress" && request.method === "DELETE") {
        const user = requireUser(request, response); if (!user) return;
        db.prepare("DELETE FROM user_problem_progress WHERE user_id=?").run(Number(user.id));
        initializeProgress(db, Number(user.id));
        return json(response, 200, { ok: true, problems: progressRows(db, Number(user.id)) });
      }

      const match = path.match(/^\/api\/problems\/(\d+)(?:\/(submit|complete|hint))?$/);
      if (match) {
        const user = requireUser(request, response); if (!user) return;
        const userId = Number(user.id);
        const problemId = Number(match[1]);
        initializeProgress(db, userId);
        const problem = db.prepare(`SELECT p.*,upp.status FROM problems p JOIN user_problem_progress upp ON upp.problem_id=p.id
          WHERE p.id=? AND p.published=1 AND upp.user_id=?`).get(problemId, userId);
        if (!problem) return json(response, 404, { ok: false, reason: "not_found" });
        if (problem.status === "locked") return json(response, 403, { ok: false, reason: "problem_locked" });

        if (!match[2] && request.method === "GET") {
          db.prepare("UPDATE user_problem_progress SET first_opened_at=COALESCE(first_opened_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND problem_id=?").run(userId, problemId);
          return json(response, 200, { ok: true, problem: { id: problem.id, slug: problem.slug, name: problem.name, rendererKey: problem.renderer_key, version: problem.version, status: problem.status, moduleUrl: `/problems/${problem.renderer_key}.js`, styleUrl: `/styles/${problem.renderer_key}.css` } });
        }

        if (match[2] === "submit" && request.method === "POST") {
          if (!checkRate(userId, problemId)) return json(response, 429, { ok: false, reason: "rate_limited" }, { "retry-after": "60" });
          const input = await body(request);
          const submittedHash = answerHash(input.answer, pepper);
          const correct = submittedHash === problem.answer_hash;
          db.prepare("INSERT INTO answer_submissions(user_id,problem_id,submitted_hash,correct) VALUES(?,?,?,?)").run(userId, problemId, submittedHash, correct ? 1 : 0);
          db.prepare("UPDATE user_problem_progress SET attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND problem_id=?").run(userId, problemId);
          if (correct) markCleared(db, userId, problemId);
          return json(response, 200, { ok: true, correct, problems: correct ? progressRows(db, userId) : undefined });
        }

        if (match[2] === "complete" && request.method === "POST") {
          if (!problem.client_completable) return json(response, 400, { ok: false, reason: "server_answer_required" });
          markCleared(db, userId, problemId);
          return json(response, 200, { ok: true, correct: true, problems: progressRows(db, userId) });
        }

        if (match[2] === "hint" && request.method === "POST") {
          db.prepare("INSERT INTO hint_usage(user_id,problem_id) VALUES(?,?)").run(userId, problemId);
          return json(response, 200, { ok: true, hint: problem.hint });
        }
      }

      if (path.startsWith("/api/")) return json(response, 404, { ok: false, reason: "not_found" });
      if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { ok: false, reason: "method_not_allowed" });

      const requested = path === "/" ? "index.html" : decodeURIComponent(path.slice(1));
      const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "");
      let filePath = join(publicDir, safe);
      try {
        const content = await readFile(filePath);
        const extension = extname(filePath).toLowerCase();
        const cacheControl = safe === "index.html" || extension === ".js" ? "no-cache" : "public, max-age=3600";
        response.writeHead(200, { "content-type": mime[extension] || "application/octet-stream", "cache-control": cacheControl });
        return response.end(request.method === "HEAD" ? undefined : content);
      } catch {
        if (extname(safe)) return json(response, 404, { ok: false, reason: "not_found" });
        filePath = join(publicDir, "index.html");
        const content = await readFile(filePath);
        response.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-cache" });
        return response.end(request.method === "HEAD" ? undefined : content);
      }
    } catch (error) {
      console.error(error);
      return json(response, error.status || 500, { ok: false, reason: error.status ? error.message : "internal_error" });
    }
  });

  server.database = db;
  return server;
}
