const hits = new Map();

export function rateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);

  recent.push(now);
  hits.set(key, recent);

  return {
    limited: recent.length > max,
    remaining: Math.max(0, max - recent.length),
    retryAfterMs: windowMs,
  };
}

export function resetLimiter() {
  hits.clear();
}
