import { notFound } from "next/navigation";
import { getScan, isDemoUnlocked } from "@/lib/storage";
import { ResultsView } from "@/components/ResultsView";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; unlocked?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const scan = await getScan(id);
  if (!scan) notFound();

  if (!scan.unlocked && (isDemoUnlocked(id) || sp.unlocked === "1")) {
    scan.unlocked = true;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <a
          href="/"
          className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--fg)]"
        >
          Launch Score
        </a>
        <span className="font-mono text-xs text-[var(--fg-muted)]">{id}</span>
      </header>
      <ResultsView scan={scan} checkoutSessionId={sp.session_id} />
    </div>
  );
}
