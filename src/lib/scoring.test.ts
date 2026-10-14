import { describe, expect, it } from "vitest";
import { computeScores, scoreCategory } from "./scoring";
import type { Finding } from "./types";

function f(
  partial: Pick<Finding, "id" | "category" | "severity" | "title">
): Finding {
  return {
    explanation: "test",
    fixPrompt: "fix",
    ...partial,
  };
}

describe("scoreCategory", () => {
  it("starts at 100 and applies severity penalties", () => {
    const score = scoreCategory([
      f({
        id: "1",
        category: "security",
        severity: "critical",
        title: "x",
      }),
      f({
        id: "2",
        category: "security",
        severity: "low",
        title: "y",
      }),
    ]);
    expect(score.score).toBe(100 - 25 - 3);
  });
});

describe("computeScores", () => {
  it("weights categories into an overall score", () => {
    const findings: Finding[] = [
      f({
        id: "a",
        category: "security",
        severity: "critical",
        title: "sec",
      }),
      f({
        id: "b",
        category: "seo",
        severity: "info",
        title: "seo",
      }),
    ];
    const scores = computeScores(findings);
    expect(scores.security.score).toBe(75);
    expect(scores.seo.score).toBe(100);
    expect(scores.overall).toBeGreaterThan(0);
    expect(scores.overall).toBeLessThanOrEqual(100);
  });
});
