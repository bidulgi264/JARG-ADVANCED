import { config } from "./config.js";

export async function checkHintAccess({ email, problem }) {
  if (!config.jarg.secret) {
    throw new Error("JARG_EMAIL_SECRET is not configured");
  }

  let response;
  try {
    const baseUrl = /^https?:\/\//i.test(config.jarg.apiUrl)
      ? config.jarg.apiUrl
      : `http://${config.jarg.apiUrl}`;
    response = await fetch(`${baseUrl}/api/email/hint-access`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-email-secret": config.jarg.secret,
      },
      body: JSON.stringify({ email, problem }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    throw new Error(`JARG API unavailable: ${error.message}`);
  }

  const data = await response.json().catch(() => ({}));
  return { status: response.status, ...data };
}
