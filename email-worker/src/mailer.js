import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter = null;

export function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (config.mail.smtp) {
    transporter = nodemailer.createTransport(config.mail.smtp);
  } else {
    // Dry-run: composes the message but does not deliver it.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

// Strip CR/LF so attacker-controlled values cannot inject extra mail headers.
function sanitizeHeader(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

export async function sendMail({ to, subject, text }) {
  const dryRun = !config.mail.smtp;
  const info = await getTransporter().sendMail({
    from: config.mail.from,
    to: sanitizeHeader(to),
    subject: sanitizeHeader(subject),
    text,
  });

  return { delivered: !dryRun, dryRun, info };
}
