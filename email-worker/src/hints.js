import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hintsPath = join(here, "..", "data", "hints.json");

const hints = JSON.parse(readFileSync(hintsPath, "utf8"));

export function getProblemIds() {
  return Object.keys(hints)
    .map(Number)
    .sort((a, b) => a - b);
}

export function hasProblem(problem) {
  return Object.prototype.hasOwnProperty.call(hints, String(problem));
}

export function getProblemMeta(problem) {
  const entry = hints[String(problem)];
  if (!entry) {
    return null;
  }

  return {
    problem: Number(problem),
    name: entry.name,
    levels: entry.levels.length,
  };
}

export function getHint(problem, level) {
  const entry = hints[String(problem)];
  if (!entry) {
    return null;
  }

  const maxLevel = entry.levels.length;
  const clamped = Math.min(Math.max(level, 1), maxLevel);

  return {
    problem: Number(problem),
    name: entry.name,
    level: clamped,
    maxLevel,
    text: entry.levels[clamped - 1],
    isFinal: clamped >= maxLevel,
  };
}
