import * as cheerio from "cheerio";
import type { Builder, Finding } from "../types";
import { buildFixPrompt } from "../prompts";
import {
  absolutize,
  fetchResource,
  isSameOrigin,
  type FetchedResource,
} from "./fetch";

const LINK_CAP = 30;

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

export async function runLinkChecks(opts: {
  page: FetchedResource;
  builder: Builder;
}): Promise<Finding[]> {
  const { page, builder } = opts;
  const $ = cheerio.load(page.body);
  const base = page.finalUrl;
  const hrefs = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const abs = absolutize(base, href);
    if (!abs) return;
    if (!isSameOrigin(base, abs)) return;
    // skip hashes-only effectively same page anchors as network checks
    try {
      const u = new URL(abs);
      u.hash = "";
      hrefs.add(u.toString());
    } catch {
      // ignore
    }
  });

  const targets = [...hrefs].slice(0, LINK_CAP);
  const broken: Array<{ url: string; status: number }> = [];

  // Bound concurrency
  const queue = [...targets];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      try {
        const res = await fetchResource(url, {
          timeoutMs: 10000,
          maxBytes: 20_000,
        });
        if (res.status >= 400 || res.status === 0) {
          broken.push({ url, status: res.status });
        }
      } catch {
        broken.push({ url, status: 0 });
      }
    }
  });
  await Promise.all(workers);

  const findings: Finding[] = [];

  if (targets.length === 0) {
    findings.push(
      finding(builder, {
        id: "links-none",
        category: "links",
        severity: "info",
        title: "No same-origin links found to crawl",
        explanation:
          "The homepage had no internal links within the crawl cap. That can be fine for a single-page marketing site.",
      })
    );
    return findings;
  }

  if (broken.length === 0) {
    findings.push(
      finding(builder, {
        id: "links-ok",
        category: "links",
        severity: "info",
        title: `Checked ${targets.length} internal links — none broken`,
        explanation:
          "Same-origin links within the crawl cap responded successfully.",
        evidence: `${targets.length} URLs`,
      })
    );
    return findings;
  }

  for (const b of broken.slice(0, 15)) {
    findings.push(
      finding(builder, {
        id: `link-broken-${b.status}-${b.url}`,
        category: "links",
        severity: b.status === 404 ? "high" : "medium",
        title: `Broken link (${b.status || "network error"})`,
        explanation:
          "Users hitting dead ends before launch looks unfinished. Update or remove the href, or restore the destination route.",
        evidence: b.url,
      })
    );
  }

  if (broken.length > 15) {
    findings.push(
      finding(builder, {
        id: "links-broken-more",
        category: "links",
        severity: "medium",
        title: `${broken.length - 15} additional broken links not listed`,
        explanation:
          "Multiple internal URLs failed. Run a fuller crawl before launch and fix routing/redirects.",
        evidence: `${broken.length} total broken / ${targets.length} checked`,
      })
    );
  }

  return findings;
}
