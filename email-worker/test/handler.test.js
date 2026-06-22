import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const tempLog = join(tmpdir(), "jarg-handler-test-requests.json");

// Use an isolated request log so tests do not pollute real data.
process.env.REQUESTS_FILE = tempLog;

// Force dry-run so tests never hit a real SMTP server, even if .env has one.
// dotenv does not override variables already set on process.env.
process.env.SMTP_HOST = "";
process.env.JARG_EMAIL_SECRET = "test-email-secret";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  const payload = JSON.parse(options.body);
  if (payload.problem === 99) {
    return new Response(JSON.stringify({ ok: false, reason: "unknown_problem" }), { status: 404 });
  }
  if (payload.email === "locked@example.com") {
    return new Response(JSON.stringify({ ok: false, reason: "problem_locked" }), { status: 403 });
  }
  if (payload.email === "unregistered@example.com") {
    return new Response(JSON.stringify({ ok: false, reason: "account_not_found" }), { status: 403 });
  }
  return new Response(JSON.stringify({
    ok: true,
    allowed: true,
    problem: { id: payload.problem, name: `Problem ${payload.problem}`, status: "available" },
    hint: `Hint for problem ${payload.problem}`,
  }), { status: 200 });
};

const { handleHintRequest } = await import("../src/handler.js");

before(() => {
  rmSync(tempLog, { force: true });
});

after(() => {
  rmSync(tempLog, { force: true });
  globalThis.fetch = originalFetch;
});

test("parses 'HINT #10' and returns level 1", async () => {
  const result = await handleHintRequest({
    from: "Player One <player1@example.com>",
    subject: "HINT #10",
    text: "Please send a hint.",
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, "hint");
  assert.equal(result.hint.problem, 10);
  assert.equal(result.hint.level, 1);
  assert.equal(result.mail.dryRun, true);
});

test("keeps the same single hint on repeated valid subjects from same sender", async () => {
  const sender = "Repeat <repeat@example.com>";

  const first = await handleHintRequest({ from: sender, subject: "HINT #7" });
  const second = await handleHintRequest({ from: sender, subject: "HINT #7" });
  const third = await handleHintRequest({ from: sender, subject: "HINT #7" });

  assert.equal(first.hint.level, 1);
  assert.equal(second.hint.level, 1);
  assert.equal(third.hint.level, 1);
  assert.match(third.reply.text, /힌트/);
  assert.doesNotMatch(third.reply.text, /정답|다음 단계/);
});

test("ignores requests when subject is not exactly HINT #number", async () => {
  const cases = [
    "HINT 10",
    "HINT #10 LEVEL 2",
    "Re: HINT #10",
    "hello",
    "",
  ];

  for (const subject of cases) {
    const result = await handleHintRequest({
      from: "ignored@example.com",
      subject,
      text: "HINT #10",
    });

    assert.equal(result.status, 204);
    assert.equal(result.kind, "ignored");
    assert.equal(result.reason, "invalid_subject");
    assert.equal(result.reply, undefined);
    assert.equal(result.mail, undefined);
  }
});

test("accepts lowercase hint subject with surrounding whitespace", async () => {
  const result = await handleHintRequest({
    from: "case@example.com",
    subject: "  hint #9  ",
  });

  assert.equal(result.kind, "hint");
  assert.equal(result.hint.problem, 9);
});

test("rejects an invalid sender address", async () => {
  const result = await handleHintRequest({ from: "not-an-email", subject: "HINT #1" });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_sender");
});

test("reports unknown problem numbers when the subject format is valid", async () => {
  const result = await handleHintRequest({
    from: "curious@example.com",
    subject: "HINT #99",
  });

  assert.equal(result.kind, "unknown_problem");
});

test("denies hints for locked problems", async () => {
  const result = await handleHintRequest({
    from: "locked@example.com",
    subject: "HINT #2",
  });

  assert.equal(result.kind, "problem_locked");
  assert.equal(result.record.served, false);
  assert.match(result.reply.text, /아직 열리지 않았습니다/);
});

test("denies hints from email addresses without an account", async () => {
  const result = await handleHintRequest({
    from: "unregistered@example.com",
    subject: "HINT #1",
  });

  assert.equal(result.kind, "account_not_found");
  assert.equal(result.record.served, false);
});
