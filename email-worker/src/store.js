import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const defaultPath = join(here, "..", "data", "requests.json");

function logPath() {
  return process.env.REQUESTS_FILE || defaultPath;
}

function ensureFile(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(path)) {
    writeFileSync(path, "[]");
  }
}

export function readLog() {
  const path = logPath();
  ensureFile(path);

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

export function appendLog(entry) {
  const path = logPath();
  const log = readLog();
  const record = {
    id: log.length + 1,
    at: new Date().toISOString(),
    ...entry,
  };

  log.push(record);
  writeFileSync(path, JSON.stringify(log, null, 2));
  return record;
}

