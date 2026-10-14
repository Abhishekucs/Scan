# Launch Score

**Is my app ready to launch?**

Launch Score is a passive, read-only scanner for vibe-coded apps (Cursor, Lovable, Bolt, Replit, v0, Claude Code). Paste a live deployed URL, pick your builder, and get one score out of 100 covering:

- **Security** — exposed secrets/API keys in HTML/JS, Supabase RLS open reads, Firebase open reads, security headers, HTTPS, `.env`/`.git` exposure, source maps
- **SEO / meta** — title, description, OG/Twitter, favicon, robots.txt, sitemap, canonical, H1
- **Performance** — page weight, request count, TTFB; PageSpeed Insights when `PAGESPEED_API_KEY` is set
- **Broken links** — same-origin crawl (capped ~30)

Each finding includes a plain-English explanation and a **builder-specific AI fix prompt** with one-click copy. Free tier shows the overall score + CRITICAL findings; the rest unlocks via **Launch Pack** ($19 one-off / $19/mo monitoring) through Stripe when configured.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL you own, confirm ownership, and scan.

```bash
npm test          # unit tests for check/scoring modules
npm run build     # production build
npm start         # serve production build
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical app URL (e.g. `http://localhost:3000` or your Vercel URL). Used for Stripe redirects. |
| `PAGESPEED_API_KEY` | Optional | Google PageSpeed Insights API key. Without it, basic TTFB/weight/request checks still run. |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret key. If unset, checkout **unlocks the scan locally** for demos. |
| `STRIPE_WEBHOOK_SECRET` | Optional | For `/api/webhook/stripe` to unlock after payment. |
| `STRIPE_PRICE_ONE_OFF` | Optional | Stripe Price ID for the $19 one-off Launch Pack. |
| `STRIPE_PRICE_MONITORING` | Optional | Stripe Price ID for the $19/mo subscription. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Publishable key (reserved for future client Stripe.js use). |
| `DEMO_UNLOCKED_SCANS` | Optional | Comma-separated scan IDs force-unlocked for demos. |

## How it works

1. **Landing** — URL input + builder picker + ownership checkbox + short Terms.
2. **`POST /api/scan`** — server-side passive fetches only (no exploitation / no writes).
3. **`/results/[id]`** — overall score, category scores, findings by severity, share link, SVG badge.
4. **`GET /api/badge/[id]`** — embeddable `Launch Score NN` SVG.
5. **`POST /api/checkout`** — Stripe Checkout when keys exist; otherwise demo unlock.

Scan results are stored as JSON under `.data/scans/` (in-memory fallback if the filesystem is not writable). Fine for local/dev; for durable production on Vercel, swap the storage adapter for Blob/KV/Turso.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Set env vars from `.env.example`.
4. Deploy.

GitHub repo scanning is stubbed as **coming soon** on the landing form.

## Ethics / safety

- Only scan apps you own or are authorized to assess.
- All network checks are **GET/read-only**.
- Supabase/Firebase probes only attempt anonymous reads of discoverable data.
- Rotate any secrets Launch Score reports as exposed.

## License

MIT
