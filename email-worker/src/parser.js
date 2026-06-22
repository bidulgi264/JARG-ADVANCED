// Accepted subject format (case-insensitive):
//   HINT #10 -> problem 10, auto level
const REQUEST_SUBJECT_RE = /^\s*HINT\s+#(\d+)\s*$/i;

export function parseRequest({ subject = "" } = {}) {
  const match = String(subject).match(REQUEST_SUBJECT_RE);

  if (!match) {
    return { ok: false };
  }

  return {
    ok: true,
    problem: Number(match[1]),
    level: null,
  };
}

export function extractEmail(from) {
  if (!from) {
    return "";
  }

  const bracketed = String(from).match(/<([^>]+)>/);
  return (bracketed ? bracketed[1] : String(from)).trim().toLowerCase();
}
