import "dotenv/config";

const hasSmtp = Boolean(process.env.SMTP_HOST);

export const config = {
  port: Number(process.env.PORT) || 3000,
  mail: {
    from: process.env.HINT_FROM || "JARG Hint Bot <jshsemail@gmail.com>",
    smtp: hasSmtp
      ? {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE) === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        }
      : null,
  },
  adminToken: process.env.ADMIN_TOKEN || "",
  rateLimit: {
    windowMs: Number(process.env.RATE_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_MAX) || 5,
  },
  jarg: {
    apiUrl: (process.env.JARG_API_URL || "http://localhost:3100").replace(/\/$/, ""),
    secret: process.env.JARG_EMAIL_SECRET || "",
  },
  imap: {
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_SECURE ? String(process.env.IMAP_SECURE) === "true" : true,
    mailbox: process.env.IMAP_MAILBOX || "INBOX",
    pollMs: Number(process.env.IMAP_POLL_MS) || 30_000,
    auth: {
      // Falls back to the SMTP credentials (same Gmail app password works for IMAP).
      user: process.env.IMAP_USER || process.env.SMTP_USER || "",
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS || "",
    },
  },
};
