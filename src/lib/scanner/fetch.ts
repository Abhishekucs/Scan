import { LIMITS } from "../limits";

export interface FetchedResource {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  ttfbMs: number;
}

const DEFAULT_TIMEOUT_MS = LIMITS.pageFetchTimeoutMs;
const MAX_BODY_BYTES = LIMITS.pageMaxBytes;

export async function fetchResource(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<FetchedResource> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? MAX_BODY_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "LaunchScoreBot/0.1 (+https://github.com; passive read-only launch scanner)",
        Accept: "*/*",
      },
    });
    const ttfbMs = Date.now() - started;
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const buf = await res.arrayBuffer();
    const sliced = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    const body = new TextDecoder("utf-8", { fatal: false }).decode(sliced);

    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      ok: res.ok,
      headers,
      body,
      bytes: buf.byteLength,
      ttfbMs,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function isSameOrigin(base: string, candidate: string): boolean {
  try {
    const a = new URL(base);
    const b = new URL(candidate, base);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

export function absolutize(base: string, href: string): string | null {
  try {
    if (
      !href ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return null;
    }
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}
