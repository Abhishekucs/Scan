import { getScan } from "@/lib/storage";

export const maxDuration = 10;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const scan = await getScan(id);

  const score = scan?.scores.overall ?? 0;
  const label = scan ? `Launch Score ${score}` : "Launch Score —";
  const color = !scan
    ? "#6B7280"
    : score >= 80
      ? "#3DDC97"
      : score >= 60
        ? "#F5C542"
        : "#FF6B6B";

  const display = scan ? String(score).padStart(2, "0") : "--";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40" role="img" aria-label="${label}">
  <title>${label}</title>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#12141A"/>
      <stop offset="100%" stop-color="#1B2030"/>
    </linearGradient>
  </defs>
  <rect width="200" height="40" rx="8" fill="url(#g)" stroke="#2A3142"/>
  <text x="14" y="25" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#9AA3B2">Launch Score</text>
  <rect x="118" y="8" width="70" height="24" rx="6" fill="${color}"/>
  <text x="153" y="25" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" fill="#0B0D12">${display}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
