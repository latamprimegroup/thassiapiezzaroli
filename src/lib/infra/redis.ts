import Redis from "ioredis";

declare global {
  var __warRoomRedisClient: Redis | undefined;
  var __warRoomRedisDisabled: boolean | undefined;
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "";
}

function isRedisDisabled() {
  return process.env.REDIS_DISABLED === "true";
}

export function getRedisClient() {
  if (globalThis.__warRoomRedisDisabled) {
    return null;
  }
  const redisUrl = getRedisUrl();
  if (!redisUrl || isRedisDisabled()) {
    globalThis.__warRoomRedisDisabled = true;
    return null;
  }
  if (!globalThis.__warRoomRedisClient) {
    globalThis.__warRoomRedisClient = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
    });
    globalThis.__warRoomRedisClient.on("error", () => undefined);
  }
  return globalThis.__warRoomRedisClient;
}

export async function redisGetString(key: string) {
  const client = getRedisClient();
  if (!client) {
    return null;
  }
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function redisSetStringEx(key: string, value: string, ttlSeconds: number) {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    await client.set(key, value, "EX", Math.max(1, Math.floor(ttlSeconds)));
    return true;
  } catch {
    return false;
  }
}

export async function redisDelete(key: string) {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

export async function redisIncrementWithWindow(key: string, windowSeconds: number) {
  const client = getRedisClient();
  if (!client) {
    return null;
  }
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const result = await client
      .multi()
      .incr(key)
      .expire(key, Math.max(1, Math.floor(windowSeconds)), "NX")
      .ttl(key)
      .exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    const ttl = Math.max(0, Number(result?.[2]?.[1] ?? 0));
    return { count, ttlSeconds: ttl };
  } catch {
    return null;
  }
}

export async function redisPing() {
  const client = getRedisClient();
  if (!client) {
    return { ok: false, reason: "redis_unconfigured" as const };
  }
  try {
    if (client.status !== "ready") {
      await client.connect();
    }
    const pong = await client.ping();
    return { ok: pong === "PONG", reason: pong === "PONG" ? ("ok" as const) : ("ping_failed" as const) };
  } catch {
    return { ok: false, reason: "redis_unreachable" as const };
  }
}

