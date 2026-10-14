import { afterEach, describe, expect, it } from "vitest";
import {
  redisConfigured,
  resetRedisClientForTests,
  storageBackend,
} from "./storage";

describe("storage backend selection", () => {
  const keys = [
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ] as const;
  const snapshot = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
    resetRedisClientForTests();
  });

  it("uses file backend when Redis env is unset", () => {
    for (const k of keys) delete process.env[k];
    expect(redisConfigured()).toBe(false);
    expect(storageBackend()).toBe("file");
  });

  it("detects KV_REST_API_* credentials", () => {
    for (const k of keys) delete process.env[k];
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    expect(redisConfigured()).toBe(true);
    expect(storageBackend()).toBe("redis");
  });

  it("detects UPSTASH_REDIS_REST_* credentials", () => {
    for (const k of keys) delete process.env[k];
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(redisConfigured()).toBe(true);
    expect(storageBackend()).toBe("redis");
  });
});
