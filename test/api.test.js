import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/database.js";
import { createJargServer } from "../server/app.js";

const pepper = "test-pepper";
const db = openDatabase(":memory:", pepper);
const server = createJargServer({ db, pepper, sessionDays: 1, emailSecret: "test-email-secret" });
let baseUrl;
let token;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    method: options.method || "GET",
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

test("shows the ARG lobby before asking the guest to log in", async () => {
  const response = await fetch(baseUrl + "/");
  const html = await response.text();
  assert.match(html, /id="authScreen" hidden/);
  assert.match(html, /class="lobby-title">ARG<\/h1>/);
  assert.match(html, /<dt>#login<\/dt>/);
});

test("registers a user and creates account progress", async () => {
  const result = await request("/api/auth/register", { method: "POST", body: { email: "player@example.com", displayName: "Player", password: "strong-pass" } });
  assert.equal(result.status, 201);
  token = result.data.token;
  const progress = await request("/api/problems", { token });
  assert.equal(progress.data.problems.length, 16);
  assert.equal(progress.data.problems[0].status, "available");
  assert.equal(progress.data.problems[1].status, "locked");
  assert.equal(progress.data.problems[1].moduleUrl, null);
});

test("email hints require a registered account and an unlocked problem", async () => {
  const allowed = await request("/api/email/hint-access", {
    method: "POST",
    body: { email: "player@example.com", problem: 1 },
  });
  assert.equal(allowed.status, 401);

  const headers = { "x-email-secret": "test-email-secret" };
  const registered = await request("/api/email/hint-access", {
    method: "POST",
    body: { email: "player@example.com", problem: 1 },
    headers,
  });
  assert.equal(registered.status, 200);
  assert.equal(registered.data.allowed, true);

  const locked = await request("/api/email/hint-access", {
    method: "POST",
    body: { email: "player@example.com", problem: 2 },
    headers,
  });
  assert.equal(locked.status, 403);
  assert.equal(locked.data.reason, "problem_locked");

  const unknownAccount = await request("/api/email/hint-access", {
    method: "POST",
    body: { email: "nobody@example.com", problem: 1 },
    headers,
  });
  assert.equal(unknownAccount.status, 403);
  assert.equal(unknownAccount.data.reason, "account_not_found");
});

test("does not expose answers and blocks locked problems", async () => {
  const locked = await request("/api/problems/2", { token });
  assert.equal(locked.status, 403);
  const source = await fetch(baseUrl + "/problems/problem-01.js").then((response) => response.text());
  assert.doesNotMatch(source, /answer\s*:/);
  assert.doesNotMatch(source, /apple/i);
});

test("validates answers on the server and unlocks the next problem", async () => {
  const wrong = await request("/api/problems/1/submit", { method: "POST", token, body: { answer: "pear" } });
  assert.equal(wrong.data.correct, false);
  const correct = await request("/api/problems/1/submit", { method: "POST", token, body: { answer: " APPLE " } });
  assert.equal(correct.data.correct, true);
  assert.equal(correct.data.problems[0].status, "cleared");
  assert.equal(correct.data.problems[0].attempts, 2);
  assert.equal(correct.data.problems[1].status, "available");
  assert.match(correct.data.problems[1].moduleUrl, /problem-02\.js$/);
});

test("records hint usage and resets only the signed-in user's progress", async () => {
  const hint = await request("/api/problems/2/hint", { method: "POST", token });
  assert.equal(hint.status, 200);
  assert.equal(typeof hint.data.hint, "string");
  const reset = await request("/api/me/progress", { method: "DELETE", token });
  assert.equal(reset.data.problems[0].status, "available");
  assert.equal(reset.data.problems[1].status, "locked");
});

test("rejects invalid credentials", async () => {
  const result = await request("/api/auth/login", { method: "POST", body: { email: "player@example.com", password: "wrong-pass" } });
  assert.equal(result.status, 401);
  assert.equal(result.data.reason, "invalid_credentials");
});
