import { ScanForm } from "@/components/ScanForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--fg)]">
          Launch Score
        </div>
        <a
          href="#terms"
          className="text-xs text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
        >
          Terms
        </a>
      </header>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 pb-20 pt-6 sm:px-6">
        <div className="hero-orb pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="hero-brand font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-tight text-[var(--fg)] sm:text-6xl md:text-7xl">
              Launch
              <br />
              <span className="text-[var(--accent)]">Score</span>
            </p>
            <p className="hero-copy mt-5 max-w-md text-lg text-[var(--fg-muted)]">
              Is my app ready to launch? One score out of 100 — security, SEO,
              performance, and broken links — with copy-paste AI fix prompts for
              your builder.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 backdrop-blur sm:p-6">
            <ScanForm />
          </div>
        </div>

        <section className="mt-20 grid gap-8 border-t border-[var(--border)] pt-10 sm:grid-cols-3">
          {[
            {
              title: "Passive checks only",
              body: "We fetch what the public internet already sees. No exploitation, no writes, no auth bypass attempts beyond read-only probes.",
            },
            {
              title: "Builder-aware fixes",
              body: "Pick Cursor, Lovable, Bolt, Replit, v0, or Claude Code — every finding ships with a tailored prompt you can paste into your AI.",
            },
            {
              title: "Shareable proof",
              body: "Each scan gets a public results URL and an embeddable Launch Score badge for your README.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--fg)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                {item.body}
              </p>
            </div>
          ))}
        </section>

        <section id="terms" className="mt-16 max-w-3xl text-xs leading-relaxed text-[var(--fg-faint)]">
          <h2 className="mb-2 text-sm text-[var(--fg-muted)]">Terms (short)</h2>
          <p>
            Launch Score is a passive, read-only scanner for apps you own or are
            authorized to assess. You agree not to use it against third-party
            systems without permission. Results are informational and may include
            false positives/negatives — they are not a security audit, legal
            advice, or a guarantee of launch readiness. Do not submit secrets in
            the URL field. Paid Unlock (“Launch Pack”) is processed by Stripe when
            configured; otherwise demo unlock may be used locally. Data for scans
            is stored so reports and badges remain shareable.
          </p>
        </section>
      </main>
    </div>
  );
}
