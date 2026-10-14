"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BUILDERS, type Builder } from "@/lib/types";

export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [builder, setBuilder] = useState<Builder>("Cursor");
  const [ownsApp, setOwnsApp] = useState(false);
  const [mode, setMode] = useState<"url" | "github">("url");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "github") {
      setError("GitHub repo scanning is coming soon. Use a live deployed URL for now.");
      return;
    }
    if (!ownsApp) {
      setError("Confirm you own or are authorized to scan this app.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, builder, ownsApp: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Scan failed");
          return;
        }
        router.push(`/results/${data.id}`);
      } catch {
        setError("Network error — try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="scan-form w-full max-w-xl space-y-5">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "url"
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          Live URL
        </button>
        <button
          type="button"
          onClick={() => setMode("github")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "github"
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          GitHub repo
          <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">
            soon
          </span>
        </button>
      </div>

      <div>
        <label htmlFor="url" className="mb-2 block text-sm text-[var(--fg-muted)]">
          {mode === "url" ? "Deployed app URL" : "GitHub repository URL"}
        </label>
        <input
          id="url"
          name="url"
          type="text"
          required={mode === "url"}
          disabled={mode === "github" || pending}
          placeholder={
            mode === "url" ? "https://your-app.vercel.app" : "https://github.com/you/repo"
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono text-sm text-[var(--fg)] outline-none ring-[var(--accent)] transition placeholder:text-[var(--fg-faint)] focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="builder" className="mb-2 block text-sm text-[var(--fg-muted)]">
          Built with
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUILDERS.map((b) => (
            <button
              key={b}
              type="button"
              disabled={pending}
              onClick={() => setBuilder(b)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                builder === b
                  ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <input type="hidden" name="builder" value={builder} />
      </div>

      <label className="flex items-start gap-3 text-sm text-[var(--fg-muted)]">
        <input
          type="checkbox"
          checked={ownsApp}
          onChange={(e) => setOwnsApp(e.target.checked)}
          disabled={pending}
          className="mt-1 size-4 accent-[var(--accent)]"
        />
        <span>
          I own this app (or have permission to scan it). Checks are passive and
          read-only — no exploitation, no writes.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-[var(--fg-faint)]">
        By scanning you agree that Launch Score may fetch publicly served pages,
        assets, and metadata for scoring. Do not submit apps you are not authorized
        to test. See Terms below.
      </p>

      {error && (
        <div className="rounded-lg border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || mode === "github"}
        className="group relative w-full overflow-hidden rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#04110C] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="relative z-10">
          {pending ? "Scanning…" : "Get my Launch Score"}
        </span>
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-white/20 transition group-hover:translate-x-full duration-700" />
      </button>
    </form>
  );
}
