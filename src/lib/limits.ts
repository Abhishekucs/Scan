/**
 * Budgets tuned for Vercel serverless (Hobby ~10s default; Pro allows
 * maxDuration up to 60s on the scan route). Keep aggregate work under that.
 */
export const LIMITS = {
  /** Route segment config for /api/scan */
  scanMaxDurationSec: 60,

  /** Primary HTML document fetch */
  pageFetchTimeoutMs: 12_000,
  pageMaxBytes: 1_500_000,

  /** External JS bundles inspected for secrets */
  maxScripts: 12,
  scriptFetchTimeoutMs: 8_000,
  scriptMaxBytes: 800_000,
  scriptConcurrency: 4,
  inlineScriptMaxChars: 200_000,

  /** Same-origin link crawl */
  linkCap: 20,
  linkFetchTimeoutMs: 6_000,
  linkMaxBytes: 16_000,
  linkConcurrency: 4,

  /** Misc security / SEO probes */
  probeTimeoutMs: 6_000,
  probeMaxBytes: 50_000,

  /** PageSpeed Insights (optional; runs in parallel with other checks) */
  pagespeedTimeoutMs: 15_000,

  /** Default Redis TTL for scan records (30 days) */
  scanTtlSeconds: 60 * 60 * 24 * 30,
} as const;
