import * as cheerio from "cheerio";
import type { Builder, Finding } from "../types";
import { buildFixPrompt } from "../prompts";
import { LIMITS } from "../limits";
import type { FetchedResource } from "./fetch";
import { fetchResource, absolutize } from "./fetch";

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

export async function runSeoChecks(opts: {
  page: FetchedResource;
  builder: Builder;
}): Promise<{ findings: Finding[]; title?: string }> {
  const { page, builder } = opts;
  const $ = cheerio.load(page.body);
  const findings: Finding[] = [];
  const origin = new URL(page.finalUrl).origin;

  const title = $("title").first().text().trim();
  if (!title) {
    findings.push(
      finding(builder, {
        id: "seo-title-missing",
        category: "seo",
        severity: "high",
        title: "Missing <title> tag",
        explanation:
          "Search engines and browser tabs rely on a clear title. Add a unique, descriptive title (roughly 50–60 characters).",
      })
    );
  } else if (title.length < 10) {
    findings.push(
      finding(builder, {
        id: "seo-title-short",
        category: "seo",
        severity: "medium",
        title: "Page title is too short",
        explanation:
          "Very short titles underperform in search results. Aim for a specific value proposition in ~50–60 characters.",
        evidence: title,
      })
    );
  }

  const description = $('meta[name="description"]').attr("content")?.trim();
  if (!description) {
    findings.push(
      finding(builder, {
        id: "seo-description-missing",
        category: "seo",
        severity: "high",
        title: "Missing meta description",
        explanation:
          "A meta description helps click-through from search results. Add a compelling 120–160 character summary.",
      })
    );
  }

  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (!ogTitle || !ogDesc || !ogImage) {
    findings.push(
      finding(builder, {
        id: "seo-og-incomplete",
        category: "seo",
        severity: "medium",
        title: "Incomplete Open Graph tags",
        explanation:
          "OG tags control how links look when shared on social apps. Set og:title, og:description, and og:image.",
        evidence: `title=${Boolean(ogTitle)} desc=${Boolean(ogDesc)} image=${Boolean(ogImage)}`,
      })
    );
  }

  const twCard = $('meta[name="twitter:card"]').attr("content");
  const twTitle = $('meta[name="twitter:title"]').attr("content");
  if (!twCard && !twTitle) {
    findings.push(
      finding(builder, {
        id: "seo-twitter-missing",
        category: "seo",
        severity: "low",
        title: "Missing Twitter/X card tags",
        explanation:
          "Add twitter:card and twitter:title (and image) so shares look polished on X.",
      })
    );
  }

  const favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href");
  if (!favicon) {
    findings.push(
      finding(builder, {
        id: "seo-favicon-missing",
        category: "seo",
        severity: "low",
        title: "No favicon detected",
        explanation:
          "A favicon improves brand recognition in tabs and bookmarks. Add a /favicon.ico or link rel=icon.",
      })
    );
  }

  const canonical = $('link[rel="canonical"]').attr("href");
  if (!canonical) {
    findings.push(
      finding(builder, {
        id: "seo-canonical-missing",
        category: "seo",
        severity: "medium",
        title: "Missing canonical URL",
        explanation:
          "Canonical tags prevent duplicate-content confusion. Point rel=canonical at the preferred URL.",
      })
    );
  }

  const h1Count = $("h1").length;
  if (h1Count === 0) {
    findings.push(
      finding(builder, {
        id: "seo-h1-missing",
        category: "seo",
        severity: "medium",
        title: "No H1 heading found",
        explanation:
          "Pages should have one clear H1 describing the primary topic for accessibility and SEO.",
      })
    );
  } else if (h1Count > 2) {
    findings.push(
      finding(builder, {
        id: "seo-h1-many",
        category: "seo",
        severity: "low",
        title: "Multiple H1 headings detected",
        explanation:
          "Too many H1s dilute page structure. Prefer a single primary H1 and nest subheadings as H2/H3.",
        evidence: `${h1Count} H1 elements`,
      })
    );
  }

  // robots.txt
  try {
    const robots = await fetchResource(`${origin}/robots.txt`, {
      timeoutMs: LIMITS.probeTimeoutMs,
      maxBytes: LIMITS.probeMaxBytes,
    });
    if (!robots.ok) {
      findings.push(
        finding(builder, {
          id: "seo-robots-missing",
          category: "seo",
          severity: "medium",
          title: "robots.txt not found",
          explanation:
            "Publish a robots.txt so crawlers know what to index. Include a Sitemap directive when possible.",
          evidence: `HTTP ${robots.status}`,
        })
      );
    } else if (/disallow:\s*\/\s*$/im.test(robots.body) && !/allow:/im.test(robots.body)) {
      findings.push(
        finding(builder, {
          id: "seo-robots-blocking",
          category: "seo",
          severity: "high",
          title: "robots.txt appears to block all crawlers",
          explanation:
            "Disallowing `/` prevents search indexing. Relax rules before a public launch.",
        })
      );
    }
  } catch {
    findings.push(
      finding(builder, {
        id: "seo-robots-unreachable",
        category: "seo",
        severity: "low",
        title: "Could not fetch robots.txt",
        explanation: "Verify robots.txt is reachable over HTTPS at launch.",
      })
    );
  }

  // sitemap
  const sitemapCandidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];
  let sitemapOk = false;
  for (const sm of sitemapCandidates) {
    try {
      const res = await fetchResource(sm, {
        timeoutMs: LIMITS.probeTimeoutMs,
        maxBytes: 100_000,
      });
      if (res.ok && /<urlset|<sitemapindex/i.test(res.body)) {
        sitemapOk = true;
        break;
      }
    } catch {
      // continue
    }
  }
  if (!sitemapOk) {
    // also check robots for sitemap directive
    try {
      const robots = await fetchResource(`${origin}/robots.txt`, {
        timeoutMs: LIMITS.probeTimeoutMs,
        maxBytes: LIMITS.probeMaxBytes,
      });
      const smMatch = robots.body.match(/sitemap:\s*(\S+)/i);
      if (smMatch) {
        const abs = absolutize(origin, smMatch[1]);
        if (abs) {
          const res = await fetchResource(abs, {
            timeoutMs: LIMITS.probeTimeoutMs,
            maxBytes: 100_000,
          });
          if (res.ok) sitemapOk = true;
        }
      }
    } catch {
      // ignore
    }
  }
  if (!sitemapOk) {
    findings.push(
      finding(builder, {
        id: "seo-sitemap-missing",
        category: "seo",
        severity: "medium",
        title: "No XML sitemap detected",
        explanation:
          "A sitemap helps search engines discover pages. Generate sitemap.xml and reference it from robots.txt.",
      })
    );
  }

  return { findings, title: title || undefined };
}
