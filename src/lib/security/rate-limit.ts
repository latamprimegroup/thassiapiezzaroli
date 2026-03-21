type Counter = {
  count: number;
  windowStartMs: number;
};

declare global {
  var __warRoomRateLimitStore: Map<string, Counter> | undefined;
}

function getStore() {
  if (!globalThis.__warRoomRateLimitStore) {
    globalThis.__warRoomRateLimitStore = new Map<string, Counter>();
  }
  return globalThis.__warRoomRateLimitStore;
}

function now() {
  return Date.now();
}

export function readRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown-ip"
  );
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const store = getStore();
  const record = store.get(params.key);
  const currentMs = now();
  if (!record || currentMs - record.windowStartMs >= params.windowMs) {
    store.set(params.key, {
      count: 1,
      windowStartMs: currentMs,
    });
    return {
      allowed: true,
      remaining: Math.max(0, params.limit - 1),
      resetMs: currentMs + params.windowMs,
    };
  }
  const nextCount = record.count + 1;
  const allowed = nextCount <= params.limit;
  store.set(params.key, {
    count: nextCount,
    windowStartMs: record.windowStartMs,
  });
  return {
    allowed,
    remaining: Math.max(0, params.limit - nextCount),
    resetMs: record.windowStartMs + params.windowMs,
  };
}

