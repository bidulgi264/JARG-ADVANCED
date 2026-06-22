import express from "express";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { handleHintRequest } from "./handler.js";
import { getProblemIds, getProblemMeta } from "./hints.js";
import { readLog } from "./store.js";
import { rateLimit } from "./limiter.js";

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get("/api/hints", (req, res) => {
  res.json({ problems: getProblemIds().map(getProblemMeta) });
});

async function processRequest(req, res, payload) {
  const key = (payload.from || req.ip || "anon").toLowerCase();
  const limit = rateLimit(key, config.rateLimit);

  if (limit.limited) {
    return res.status(429).json({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: limit.retryAfterMs,
    });
  }

  const result = await handleHintRequest(payload);
  return res.status(result.status).json(result);
}

// Primary endpoint: simulate (or directly drive) a hint request.
app.post("/api/hint", (req, res) =>
  processRequest(req, res, {
    from: req.body.from,
    subject: req.body.subject,
    text: req.body.text ?? req.body.body,
  }),
);

// Generic inbound-email webhook. Adapt the field names below to whatever your
// mail provider posts (SendGrid Inbound Parse, Mailgun Routes, Cloudflare
// Email Workers, etc.).
app.post("/inbound", (req, res) =>
  processRequest(req, res, {
    from: req.body.from || req.body.sender,
    subject: req.body.subject,
    text: req.body.text || req.body["body-plain"] || req.body.plain,
  }),
);

// Admin: inspect the request log. Locked unless ADMIN_TOKEN is configured and
// supplied via the x-admin-token header.
app.get("/api/requests", (req, res) => {
  if (!config.adminToken || req.get("x-admin-token") !== config.adminToken) {
    return res.status(401).json({ ok: false, reason: "unauthorized" });
  }

  res.json({ requests: readLog() });
});

app.use((req, res) => res.status(404).json({ ok: false, reason: "not_found" }));

// Only start listening when run directly (not when imported by tests).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  app.listen(config.port, () => {
    console.log(`JARG hint API listening on http://localhost:${config.port}`);
    if (!config.mail.smtp) {
      console.log(
        "[mail] SMTP 미설정 → dry-run 모드: 메일을 실제로 보내지 않고 API 응답/콘솔로만 표시합니다.",
      );
    }
  });
}
