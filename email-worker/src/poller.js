import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { handleHintRequest } from "./handler.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Read every unseen message, hand it to the hint handler, then mark it seen so
// it is never processed (or replied to) twice.
async function processNewMail(client) {
  const lock = await client.getMailboxLock(config.imap.mailbox);
  let handled = 0;

  try {
    // Flush server state so messages that arrived after the mailbox was opened
    // are reflected in this SEARCH (otherwise only the startup backlog is seen).
    await client.noop();

    const uids = (await client.search({ seen: false }, { uid: true })) || [];

    for (const uid of uids) {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message || !message.source) {
        continue;
      }

      const parsed = await simpleParser(message.source);
      const payload = {
        from: parsed.from?.text || "",
        subject: parsed.subject || "",
        text: parsed.text || "",
      };

      let completed = false;
      try {
        const result = await handleHintRequest(payload);
        completed = result.status < 500;
        const detail = result.hint
          ? ` (#${result.hint.problem} 레벨 ${result.hint.level})`
          : "";
        console.log(`[poll] ${payload.from} → ${result.kind}${detail}`);
      } catch (err) {
        console.error("[poll] 처리 중 오류:", err.message);
      }

      if (!completed) {
        continue;
      }

      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      handled += 1;
    }
  } finally {
    lock.release();
  }

  return handled;
}

async function start() {
  if (!config.imap.auth.user || !config.imap.auth.pass) {
    console.error(
      "[poll] IMAP 자격 증명이 없습니다. .env에 SMTP_USER/SMTP_PASS (또는 IMAP_USER/IMAP_PASS)를 설정하세요.",
    );
    process.exit(1);
  }

  if (!config.mail.smtp) {
    console.warn(
      "[poll] 경고: SMTP가 비어 있어 dry-run입니다. 수신은 처리되지만 답장이 실제로 발송되지 않습니다.",
    );
  }

  // Reconnect loop: if the connection drops, wait and start over.
  for (;;) {
    const client = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: config.imap.auth,
      logger: false,
    });

    try {
      await client.connect();
      console.log(
        `[poll] ${config.imap.host} 연결됨 · ${config.imap.mailbox} 폴링 (${config.imap.pollMs}ms 간격) · 발신 ${config.mail.from}`,
      );

      for (;;) {
        const count = await processNewMail(client);
        if (count > 0) {
          console.log(`[poll] ${count}건 처리 완료`);
        }
        await sleep(config.imap.pollMs);
      }
    } catch (err) {
      console.error(`[poll] 연결/처리 오류, 5초 후 재연결: ${err.message}`);
      if (err.authenticationFailed) {
        console.error(
          "[poll] → 인증 실패: Gmail 앱 비밀번호(SMTP_PASS)가 올바른지, 2단계 인증이 켜져 있는지, IMAP 사용이 켜져 있는지 확인하세요.",
        );
      }
      if (err.responseText) {
        console.error(`[poll] → 서버 응답: ${err.responseText}`);
      }
      if (err.serverResponseCode) {
        console.error(`[poll] → 응답 코드: ${err.serverResponseCode}`);
      }
      if (err.code) {
        console.error(`[poll] → 오류 코드: ${err.code}`);
      }
      try {
        await client.logout();
      } catch {
        // ignore logout failure on a broken connection
      }
      await sleep(5000);
    }
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  start();
}

export { processNewMail, start };
