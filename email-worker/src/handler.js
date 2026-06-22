import { parseRequest, extractEmail } from "./parser.js";
import { sendMail } from "./mailer.js";
import { appendLog } from "./store.js";
import { checkHintAccess } from "./jarg.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function denialMessage(reason, problem) {
  if (reason === "account_not_found") {
    return "이 이메일로 등록된 JARG 계정을 찾을 수 없습니다. 게임 계정과 같은 이메일 주소로 요청해 주세요.";
  }
  if (reason === "problem_locked") {
    return `문제 #${problem}은 현재 계정에서 아직 열리지 않았습니다. 앞 문제를 먼저 해결한 뒤 다시 요청해 주세요.`;
  }
  if (reason === "unknown_problem") {
    return `문제 #${problem}은 존재하지 않거나 아직 공개되지 않았습니다.`;
  }
  return "현재 힌트 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

async function denyHint({ email, problem, reason }) {
  const text = denialMessage(reason, problem);
  const subject = `Re: JARG 힌트 #${problem}`;
  const mail = await sendMail({ to: email, subject, text });
  const record = appendLog({
    email,
    problem,
    served: false,
    kind: reason,
    dryRun: mail.dryRun,
  });

  return {
    status: 200,
    ok: true,
    kind: reason,
    reply: { to: email, subject, text },
    record,
    mail,
  };
}

export async function handleHintRequest({ from, subject = "" } = {}) {
  const email = extractEmail(from);
  if (!email || !EMAIL_RE.test(email)) {
    return { status: 400, ok: false, reason: "invalid_sender" };
  }

  const parsed = parseRequest({ subject });
  if (!parsed.ok) {
    return { status: 204, ok: true, kind: "ignored", reason: "invalid_subject" };
  }

  let access;
  try {
    access = await checkHintAccess({ email, problem: parsed.problem });
  } catch (error) {
    appendLog({
      email,
      problem: parsed.problem,
      served: false,
      kind: "service_unavailable",
    });
    return {
      status: 503,
      ok: false,
      kind: "service_unavailable",
      reason: error.message,
    };
  }

  if (!access.ok || !access.allowed) {
    return denyHint({
      email,
      problem: parsed.problem,
      reason: access.reason || "access_denied",
    });
  }

  const hint = {
    problem: access.problem.id,
    name: access.problem.name,
    level: 1,
    maxLevel: 1,
    text: access.hint,
    isFinal: false,
  };
  const text = [
    `문제 #${hint.problem} - ${hint.name}`,
    "힌트",
    "",
    hint.text,
  ].join("\n");
  const replySubject = `Re: JARG 힌트 #${hint.problem} (${hint.name})`;
  const mail = await sendMail({ to: email, subject: replySubject, text });
  const record = appendLog({
    email,
    problem: hint.problem,
    level: 1,
    served: true,
    kind: "hint",
    dryRun: mail.dryRun,
  });

  return {
    status: 200,
    ok: true,
    kind: "hint",
    hint,
    reply: { to: email, subject: replySubject, text },
    record,
    mail,
  };
}
