"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Finding, ScanResult, Severity } from "@/lib/types";
import { severityRank } from "@/lib/scoring";
import { ScoreRing } from "./ScoreRing";
import { FindingCard } from "./FindingCard";
import { Paywall } from "./Paywall";
import { CopyButton } from "./CopyButton";

function isFreeVisible(f: Finding, unlocked: boolean): boolean {
  if (unlocked) return true;
  return f.severity === "critical";
}

export function ResultsView({
  scan,
  checkoutSessionId,
}: {
  scan: ScanResult;
  checkoutSessionId?: string;
}) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(scan.unlocked);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!checkoutSessionId || unlocked) return;
    (async () => {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: scan.id,
          sessionId: checkoutSessionId,
        }),
      });
      const data = await res.json();
      if (data.unlocked) {
        setUnlocked(true);
        router.refresh();
      }
    })();
  }, [checkoutSessionId, unlocked, scan.id, router]);

  const sorted = useMemo(() => {
    return [...scan.findings].sort(
      (a, b) => severityRank(a.severity as Severity) - severityRank(b.severity as Severity)
    );
  }, [scan.findings]);

  const visible = sorted.filter((f) => isFreeVisible(f, unlocked));
  const locked = sorted.filter((f) => !isFreeVisible(f, unlocked));

  const shareUrl = `${origin}/results/${scan.id}`;
  const badgeUrl = `${origin}/api/badge/${scan.id}`;
  const badgeMarkdown = `![Launch Score](${badgeUrl})`;

  const categories = [
    { key: "security", label: "Security", score: scan.scores.security.score },
    { key: "seo", label: "SEO / Meta", score: scan.scores.seo.score },
    { key: "performance", label: "Performance", score: scan.scores.performance.score },
    { key: "links", label: "Links", score: scan.scores.links.score },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            Launch Score report
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--fg)] sm:text-4xl">
            {scan.meta.title || "Untitled app"}
          </h1>
          <p className="font-mono text-sm text-[var(--fg-muted)] break-all">
            {scan.meta.finalUrl}
          </p>
          <p className="text-sm text-[var(--fg-faint)]">
            Built with {scan.meta.builder} · scanned{" "}
            {new Date(scan.meta.scannedAt).toLocaleString()}
            {scan.meta.ttfbMs != null && ` · TTFB ${scan.meta.ttfbMs}ms`}
            {scan.meta.pageWeightBytes != null &&
              ` · ${(scan.meta.pageWeightBytes / 1024).toFixed(0)}KB HTML`}
          </p>
        </div>
        <ScoreRing score={scan.scores.overall} />
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((c, i) => (
          <div
            key={c.key}
            className="category-tile rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              {c.label}
            </div>
            <div className="mt-2 font-mono text-2xl text-[var(--fg)]">{c.score}</div>
          </div>
        ))}
      </section>

      <section className="mb-10 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-[var(--fg)]">Shareable report</div>
          <div className="font-mono text-xs text-[var(--fg-muted)] break-all">
            {shareUrl || `/results/${scan.id}`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={shareUrl || `/results/${scan.id}`} label="Copy link" />
          <CopyButton text={badgeMarkdown} label="Copy badge" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl || `/api/badge/${scan.id}`} alt="Launch Score badge" height={40} />
        </div>
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--fg)]">
          Findings
        </h2>
        {!unlocked && (
          <p className="text-sm text-[var(--fg-muted)]">
            Free tier: overall score + all CRITICAL findings. Everything else is
            behind Launch Pack.
          </p>
        )}
        <div className="space-y-4">
          {!unlocked && visible.length === 0 && (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--fg-muted)]">
              No CRITICAL findings on this scan. Unlock Launch Pack to see the
              full list with AI fix prompts.
            </p>
          )}
          {visible.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
          {locked.slice(0, 6).map((f) => (
            <FindingCard key={f.id} finding={f} blurred />
          ))}
        </div>
      </section>

      {!unlocked && (
        <section className="mb-12">
          <Paywall scanId={scan.id} />
        </section>
      )}

      <div className="text-center">
        <a
          href="/"
          className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
        >
          Scan another app
        </a>
      </div>
    </div>
  );
}
