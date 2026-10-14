import * as cheerio from "cheerio";
import { nanoid } from "nanoid";
import type { Builder, ScanResult } from "../types";
import { computeScores } from "../scoring";
import { LIMITS } from "../limits";
import { fetchResource, absolutize, isSameOrigin } from "./fetch";
import { runSecurityChecks } from "./security";
import { runSeoChecks } from "./seo";
import { runPerformanceChecks } from "./performance";
import { runLinkChecks } from "./links";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProto);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  return url.toString();
}

async function collectScriptBodies(
  pageUrl: string,
  html: string
): Promise<{ urls: string[]; bodies: string[] }> {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const abs = absolutize(pageUrl, src);
    if (!abs) return;
    urls.push(abs);
  });

  // Prefer same-origin bundles (where secrets usually leak), then others
  const ranked = [
    ...urls.filter((u) => isSameOrigin(pageUrl, u)),
    ...urls.filter((u) => !isSameOrigin(pageUrl, u)),
  ].slice(0, LIMITS.maxScripts);

  const bodies: string[] = [];
  $("script:not([src])").each((_, el) => {
    const t = $(el).html();
    if (t && t.length < LIMITS.inlineScriptMaxChars) bodies.push(t);
  });

  const queue = [...ranked];
  const workers = Array.from(
    { length: Math.min(LIMITS.scriptConcurrency, queue.length) },
    async () => {
      while (queue.length) {
        const url = queue.shift();
        if (!url) return;
        try {
          const res = await fetchResource(url, {
            timeoutMs: LIMITS.scriptFetchTimeoutMs,
            maxBytes: LIMITS.scriptMaxBytes,
          });
          if (res.ok) bodies.push(res.body);
        } catch {
          // ignore
        }
      }
    }
  );
  await Promise.all(workers);

  return { urls: ranked, bodies };
}

export async function runScan(opts: {
  url: string;
  builder: Builder;
}): Promise<ScanResult> {
  const target = normalizeUrl(opts.url);
  const page = await fetchResource(target, {
    timeoutMs: LIMITS.pageFetchTimeoutMs,
    maxBytes: LIMITS.pageMaxBytes,
  });

  if (!page.ok && page.status === 0) {
    throw new Error("Could not reach that URL");
  }

  const { urls: scriptUrls, bodies: scriptBodies } = await collectScriptBodies(
    page.finalUrl,
    page.body
  );

  const [security, seo, performance, links] = await Promise.all([
    runSecurityChecks({ page, scriptBodies, builder: opts.builder }),
    runSeoChecks({ page, builder: opts.builder }),
    runPerformanceChecks({ page, scriptUrls, builder: opts.builder }),
    runLinkChecks({ page, builder: opts.builder }),
  ]);

  const findings = [
    ...security,
    ...seo.findings,
    ...performance.findings,
    ...links,
  ];

  const scores = computeScores(findings);

  return {
    id: nanoid(10),
    meta: {
      url: target,
      finalUrl: page.finalUrl,
      builder: opts.builder,
      scannedAt: new Date().toISOString(),
      title: seo.title,
      ttfbMs: performance.metrics.ttfbMs,
      pageWeightBytes: performance.metrics.pageWeightBytes,
      requestCount: performance.metrics.requestCount,
      pagespeedUsed: performance.metrics.pagespeedUsed,
    },
    scores,
    findings,
    unlocked: false,
  };
}
