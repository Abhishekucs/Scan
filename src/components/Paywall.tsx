"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function Paywall({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function checkout(plan: "one_off" | "monitoring") {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanId, plan }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Checkout failed");
          return;
        }
        if (data.url) {
          if (data.mode === "demo") {
            router.push(data.url);
            router.refresh();
          } else {
            window.location.href = data.url;
          }
        }
      } catch {
        setError("Network error");
      }
    });
  }

  return (
    <div className="paywall rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-[var(--surface)] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--fg)]">
        Unlock Launch Pack
      </h2>
      <p className="mt-2 max-w-xl text-sm text-[var(--fg-muted)]">
        Free tier shows your overall score and all CRITICAL findings. Unlock every
        high/medium/low finding plus builder-specific fix prompts.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => checkout("one_off")}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left transition hover:border-[var(--accent)] disabled:opacity-60"
        >
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--fg-muted)]">
            One-off
          </div>
          <div className="mt-1 font-mono text-2xl text-[var(--fg)]">$19</div>
          <div className="mt-1 text-sm text-[var(--fg-muted)]">
            Full report for this scan
          </div>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => checkout("monitoring")}
          className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/15 px-4 py-4 text-left transition hover:bg-[var(--accent)]/25 disabled:opacity-60"
        >
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
            Monitoring
          </div>
          <div className="mt-1 font-mono text-2xl text-[var(--fg)]">$19/mo</div>
          <div className="mt-1 text-sm text-[var(--fg-muted)]">
            Recurring checks (Stripe subscription)
          </div>
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--bad)]">{error}</p>}
      <p className="mt-4 text-xs text-[var(--fg-faint)]">
        {pending
          ? "Starting checkout…"
          : "If Stripe keys are not set, checkout unlocks locally for demos."}
      </p>
    </div>
  );
}
