"use client";

import type { Finding } from "@/lib/types";
import { CopyButton } from "./CopyButton";

const SEVERITY_STYLES: Record<Finding["severity"], string> = {
  critical: "text-[var(--bad)] border-[var(--bad)]/40 bg-[var(--bad)]/10",
  high: "text-orange-300 border-orange-400/30 bg-orange-400/10",
  medium: "text-[var(--warn)] border-[var(--warn)]/30 bg-[var(--warn)]/10",
  low: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  info: "text-[var(--fg-muted)] border-[var(--border)] bg-[var(--surface-2)]",
};

export function FindingCard({
  finding,
  blurred = false,
}: {
  finding: Finding;
  blurred?: boolean;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 ${
        blurred ? "select-none" : ""
      }`}
    >
      <div className={blurred ? "pointer-events-none blur-[6px] opacity-70" : ""}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_STYLES[finding.severity]}`}
          >
            {finding.severity}
          </span>
          <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">
            {finding.category}
          </span>
        </div>
        <h3 className="mb-2 text-base font-medium text-[var(--fg)]">{finding.title}</h3>
        <p className="mb-3 text-sm leading-relaxed text-[var(--fg-muted)]">
          {finding.explanation}
        </p>
        {finding.evidence && (
          <p className="mb-3 font-mono text-xs text-[var(--fg-faint)] break-all">
            {finding.evidence}
          </p>
        )}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-muted)]">
              AI fix prompt
            </span>
            {!blurred && <CopyButton text={finding.fixPrompt} />}
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--fg-muted)]">
            {finding.fixPrompt}
          </pre>
        </div>
      </div>
      {blurred && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg)]/30">
          <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--fg-muted)]">
            Unlock Launch Pack
          </span>
        </div>
      )}
    </article>
  );
}
