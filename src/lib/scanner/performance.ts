import type { Builder, Finding } from "../types";
import { buildFixPrompt } from "../prompts";
import { LIMITS } from "../limits";
import type { FetchedResource } from "./fetch";

function finding(
  builder: Builder,
  partial: Omit<Finding, "fixPrompt">
): Finding {
  return {
    ...partial,
    fixPrompt: buildFixPrompt(
      builder,
      partial.title,
      partial.explanation,
      partial.evidence
    ),
  };
}

export interface PerfMetrics {
  ttfbMs: number;
  pageWeightBytes: number;
  requestCount: number;
  pagespeedUsed: boolean;
  pagespeedScore?: number;
}

export async function runPerformanceChecks(opts: {
  page: FetchedResource;
  scriptUrls: string[];
  builder: Builder;
}): Promise<{ findings: Finding[]; metrics: PerfMetrics }> {
  const { page, scriptUrls, builder } = opts;
  const findings: Finding[] = [];

  const pageWeightBytes = page.bytes;
  // Approximate request count: document + discovered scripts (+1 for common favicon guess)
  const requestCount = 1 + scriptUrls.length;
  const ttfbMs = page.ttfbMs;

  if (ttfbMs > 1500) {
    findings.push(
      finding(builder, {
        id: "perf-ttfb-slow",
        category: "performance",
        severity: ttfbMs > 3000 ? "high" : "medium",
        title: "Slow time to first byte (TTFB)",
        explanation:
          "High TTFB usually means slow origin compute, cold starts, or distant regions. Cache HTML where possible, trim server work, and use an edge CDN.",
        evidence: `${ttfbMs} ms`,
      })
    );
  }

  if (pageWeightBytes > 1_500_000) {
    findings.push(
      finding(builder, {
        id: "perf-heavy-html",
        category: "performance",
        severity: pageWeightBytes > 3_000_000 ? "high" : "medium",
        title: "Large HTML document payload",
        explanation:
          "Heavy HTML slows first paint on mobile networks. Reduce inline scripts/styles, paginate content, and defer non-critical data.",
        evidence: `${(pageWeightBytes / 1024).toFixed(0)} KB`,
      })
    );
  }

  if (scriptUrls.length > 25) {
    findings.push(
      finding(builder, {
        id: "perf-many-scripts",
        category: "performance",
        severity: "medium",
        title: "High number of script requests",
        explanation:
          "Too many JS files increase connection overhead. Bundle/code-split thoughtfully and remove unused third-party tags.",
        evidence: `${scriptUrls.length} script tags`,
      })
    );
  }

  let pagespeedUsed = false;
  let pagespeedScore: number | undefined;
  const key = process.env.PAGESPEED_API_KEY;

  if (key) {
    try {
      const api = new URL(
        "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
      );
      api.searchParams.set("url", page.finalUrl);
      api.searchParams.set("key", key);
      api.searchParams.set("strategy", "mobile");
      api.searchParams.set("category", "performance");

      const res = await fetch(api.toString(), {
        signal: AbortSignal.timeout(LIMITS.pagespeedTimeoutMs),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          lighthouseResult?: {
            categories?: { performance?: { score?: number } };
            audits?: Record<
              string,
              { displayValue?: string; numericValue?: number; title?: string }
            >;
          };
        };
        pagespeedUsed = true;
        const score =
          json.lighthouseResult?.categories?.performance?.score ?? undefined;
        if (typeof score === "number") {
          pagespeedScore = Math.round(score * 100);
          if (pagespeedScore < 50) {
            findings.push(
              finding(builder, {
                id: "perf-pagespeed-poor",
                category: "performance",
                severity: "high",
                title: `PageSpeed mobile score is low (${pagespeedScore})`,
                explanation:
                  "Google PageSpeed Insights reports weak mobile performance. Focus on LCP images, unused JS, and server response time.",
                evidence: `PSI score ${pagespeedScore}/100`,
              })
            );
          } else if (pagespeedScore < 80) {
            findings.push(
              finding(builder, {
                id: "perf-pagespeed-fair",
                category: "performance",
                severity: "medium",
                title: `PageSpeed mobile score is fair (${pagespeedScore})`,
                explanation:
                  "Performance is acceptable but not launch-strong. Optimize largest contentful paint and reduce unused JavaScript.",
                evidence: `PSI score ${pagespeedScore}/100`,
              })
            );
          }
        }

        const lcp = json.lighthouseResult?.audits?.["largest-contentful-paint"];
        if (lcp?.numericValue && lcp.numericValue > 4000) {
          findings.push(
            finding(builder, {
              id: "perf-lcp-slow",
              category: "performance",
              severity: "medium",
              title: "Largest Contentful Paint is slow",
              explanation:
                "Users wait too long for the main visual. Compress hero images, preloads critical assets, and avoid late-loading fonts blocking render.",
              evidence: lcp.displayValue ?? `${Math.round(lcp.numericValue)} ms`,
            })
          );
        }
      }
    } catch {
      // fall back to basic metrics only
    }
  } else {
    findings.push(
      finding(builder, {
        id: "perf-pagespeed-skipped",
        category: "performance",
        severity: "info",
        title: "PageSpeed Insights not configured",
        explanation:
          "Set PAGESPEED_API_KEY to include Lighthouse lab metrics. Basic TTFB/weight/request checks still ran.",
      })
    );
  }

  // Heuristic weight penalty when PSI unavailable
  if (!pagespeedUsed) {
    const approxKb = pageWeightBytes / 1024 + scriptUrls.length * 40;
    if (approxKb > 2000) {
      findings.push(
        finding(builder, {
          id: "perf-estimated-heavy",
          category: "performance",
          severity: "medium",
          title: "Estimated page weight looks heavy",
          explanation:
            "Based on HTML size and script count, the page may feel slow on mobile. Lazy-load media and trim client bundles.",
          evidence: `~${approxKb.toFixed(0)} KB estimated`,
        })
      );
    }
  }

  return {
    findings,
    metrics: {
      ttfbMs,
      pageWeightBytes,
      requestCount,
      pagespeedUsed,
      pagespeedScore,
    },
  };
}
