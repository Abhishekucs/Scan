import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import type { ScanResult } from "./types";
import { LIMITS } from "./limits";

const DATA_DIR = path.join(process.cwd(), ".data", "scans");
const KEY_PREFIX = "launchscore:scan:";

const memory = new Map<string, ScanResult>();

let redisClient: Redis | null | undefined;

function redisEnv() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";
  return { url, token };
}

/** True when Vercel Marketplace KV / Upstash Redis REST credentials are present. */
export function redisConfigured(): boolean {
  const { url, token } = redisEnv();
  return Boolean(url && token);
}

export function storageBackend(): "redis" | "file" {
  return redisConfigured() ? "redis" : "file";
}

/** Test helper — clears the lazy Redis singleton between env mutations. */
export function resetRedisClientForTests() {
  redisClient = undefined;
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const { url, token } = redisEnv();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function scanKey(id: string) {
  return `${KEY_PREFIX}${id}`;
}

function scanTtlSeconds(): number {
  const raw = process.env.SCAN_TTL_SECONDS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return LIMITS.scanTtlSeconds;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

async function saveFile(scan: ScanResult): Promise<void> {
  await ensureDir();
  await fs.writeFile(filePath(scan.id), JSON.stringify(scan, null, 2), "utf8");
}

async function getFile(id: string): Promise<ScanResult | null> {
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw) as ScanResult;
  } catch {
    return null;
  }
}

export async function saveScan(scan: ScanResult): Promise<void> {
  memory.set(scan.id, scan);

  const redis = getRedis();
  if (redis) {
    await redis.set(scanKey(scan.id), scan, { ex: scanTtlSeconds() });
    return;
  }

  try {
    await saveFile(scan);
  } catch {
    // Ephemeral/serverless FS may be read-only; in-memory still works for this invocation.
  }
}

export async function getScan(id: string): Promise<ScanResult | null> {
  const cached = memory.get(id);
  if (cached) return cached;

  const redis = getRedis();
  if (redis) {
    const scan = await redis.get<ScanResult>(scanKey(id));
    if (scan) {
      memory.set(id, scan);
      return scan;
    }
    return null;
  }

  const fromFile = await getFile(id);
  if (fromFile) memory.set(id, fromFile);
  return fromFile;
}

export async function unlockScan(
  id: string,
  stripeSessionId?: string
): Promise<ScanResult | null> {
  const scan = await getScan(id);
  if (!scan) return null;
  scan.unlocked = true;
  if (stripeSessionId) scan.stripeSessionId = stripeSessionId;
  await saveScan(scan);
  return scan;
}

export function isDemoUnlocked(id: string): boolean {
  const list = process.env.DEMO_UNLOCKED_SCANS ?? "";
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(id);
}
