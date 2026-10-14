import { promises as fs } from "fs";
import path from "path";
import type { ScanResult } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data", "scans");

const memory = new Map<string, ScanResult>();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function filePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function saveScan(scan: ScanResult): Promise<void> {
  memory.set(scan.id, scan);
  try {
    await ensureDir();
    await fs.writeFile(filePath(scan.id), JSON.stringify(scan, null, 2), "utf8");
  } catch {
    // Ephemeral environments (e.g. some serverless) may not allow writes.
    // In-memory still works for the current process lifetime.
  }
}

export async function getScan(id: string): Promise<ScanResult | null> {
  const cached = memory.get(id);
  if (cached) return cached;

  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    const scan = JSON.parse(raw) as ScanResult;
    memory.set(id, scan);
    return scan;
  } catch {
    return null;
  }
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
