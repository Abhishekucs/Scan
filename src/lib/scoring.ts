import type { Category, CategoryScore, Finding, ScanScores, Severity } from "./types";

const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 25,
  high: 12,
  medium: 6,
  low: 3,
  info: 0,
};

const CATEGORY_WEIGHT: Record<Category, number> = {
  security: 0.35,
  seo: 0.25,
  performance: 0.25,
  links: 0.15,
};

export function scoreCategory(findings: Finding[]): CategoryScore {
  let penalty = 0;
  for (const f of findings) {
    penalty += SEVERITY_PENALTY[f.severity];
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { score, maxScore: 100, findings };
}

export function computeScores(findings: Finding[]): ScanScores {
  const byCategory = (cat: Category) =>
    scoreCategory(findings.filter((f) => f.category === cat));

  const security = byCategory("security");
  const seo = byCategory("seo");
  const performance = byCategory("performance");
  const links = byCategory("links");

  const overall = Math.round(
    security.score * CATEGORY_WEIGHT.security +
      seo.score * CATEGORY_WEIGHT.seo +
      performance.score * CATEGORY_WEIGHT.performance +
      links.score * CATEGORY_WEIGHT.links
  );

  return { overall, security, seo, performance, links };
}

export function severityRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[s];
}
