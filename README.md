# Launch Score

**Is my app ready to launch?**

Launch Score is a passive, read-only scanner for vibe-coded apps (Cursor, Lovable, Bolt, Replit, v0, Claude Code). Paste a live deployed URL, pick your builder, and get one score out of 100 covering:

- **Security** — exposed secrets/API keys in HTML/JS, Supabase RLS open reads, Firebase open reads, security headers, HTTPS, `.env`/`.git` exposure, source maps
- **SEO / meta** — title, description, OG/Twitter, favicon, robots.txt, sitemap, canonical, H1
- **Performance** — page weight, request count, TTFB; PageSpeed Insights when `PAGESPEED_API_KEY` is set
- **Broken links** — same-origin crawl (capped for serverless)

Each finding includes a plain-English explanation and a **builder-specific AI fix prompt** with one-click copy. Free tier shows the overall score + CRITICAL findings; the rest unlocks via **Launch Pack** ($19 one-off / $19/mo monitoring) through Stripe when configured.

## Quick start (local)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a public URL you own, confirm ownership, and scan.

Without Redis env vars, results are stored under `.data/scans/` (gitignored). That works for local development only.

```bash
npm test          # unit tests for check/scoring modules
npm run build     # production build
npm start         # serve production build
```

## Deploy to Vercel (exact steps)

1. **Push** this repo to GitHub (already on `main` if you cloned Scan).
2. In [Vercel](https://vercel.com) → **Add New…** → **Project** → import the GitHub repo.
3. **Framework Preset:** Next.js (auto-detected). Leave build settings default (`npm run build`, output detected).
4. **Add Upstash Redis (required for durable scans on serverless):**
   - In the Vercel project → **Storage** (or **Marketplace**) → create / connect **Upstash Redis** / **KV**.
   - Apply it to the project so Vercel injects either:
     - `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel Marketplace / KV), **or**
     - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
   - The app accepts either pair.
5. **Set Environment Variables** (Project → Settings → Environment Variables) for Production (and Preview if you want):

| Variable | Required on Vercel? | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **Yes** | Your canonical URL, e.g. `https://your-app.vercel.app` (no trailing slash). Used for Stripe success/cancel redirects and share links. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | **Yes*** | From Vercel Marketplace Upstash/KV. *Or* use the `UPSTASH_REDIS_REST_*` pair below. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | **Yes*** | Alternate to `KV_*`. Only one pair is needed. |
| `SCAN_TTL_SECONDS` | No | Redis TTL for scan records (default `2592000` = 30 days). |
| `PAGESPEED_API_KEY` | No | Enables Lighthouse mobile metrics (15s timeout budget). |
| `STRIPE_SECRET_KEY` | No | Without Stripe, Launch Pack unlocks in demo mode. |
| `STRIPE_WEBHOOK_SECRET` | No | Point Stripe webhook to `https://YOUR_DOMAIN/api/webhook/stripe`. |
| `STRIPE_PRICE_ONE_OFF` | No | Price ID for $19 one-off. |
| `STRIPE_PRICE_MONITORING` | No | Price ID for $19/mo subscription. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Reserved for future client Stripe.js. |
| `DEMO_UNLOCKED_SCANS` | No | Comma-separated scan IDs force-unlocked (demos only). |

6. **Deploy.** After the first deploy, update `NEXT_PUBLIC_APP_URL` if you attach a custom domain, then redeploy.
7. **Stripe webhook (if using payments):** Stripe Dashboard → Webhooks → endpoint `https://YOUR_DOMAIN/api/webhook/stripe` → event `checkout.session.completed` (and optionally `checkout.session.async_payment_succeeded`) → paste signing secret into `STRIPE_WEBHOOK_SECRET`.

### Serverless limits

`vercel.json` and route `maxDuration` exports configure:

- `/api/scan` → **60s**, 1024 MB (needs [Vercel Pro](https://vercel.com/docs/functions/configuring-functions/duration) for 60s; Hobby caps lower — shorten or upgrade if scans time out)
- Crawl caps: ≤20 same-origin links, ≤12 JS bundles, tighter per-request timeouts (see `src/lib/limits.ts`)
- PageSpeed Insights capped at **15s** so it fits the scan budget

## How it works

1. **Landing** — URL input + builder picker + ownership checkbox + short Terms.
2. **`POST /api/scan`** — server-side passive fetches only (no exploitation / no writes).
3. **`/results/[id]`** — overall score, category scores, findings by severity, share link, SVG badge.
4. **`GET /api/badge/[id]`** — embeddable `Launch Score NN` SVG.
5. **`POST /api/checkout`** — Stripe Checkout when keys exist; otherwise demo unlock.

**Storage:** Upstash Redis when `KV_*` or `UPSTASH_REDIS_REST_*` are set; otherwise local `.data/scans/` JSON for local/dev.

GitHub repo scanning is stubbed as **coming soon** on the landing form. Recurring monitoring beyond Stripe subscription checkout is not implemented yet.

## Ethics / safety

- Only scan apps you own or are authorized to assess.
- All network checks are **GET/read-only**.
- Supabase/Firebase probes only attempt anonymous reads of discoverable data.
- Rotate any secrets Launch Score reports as exposed.

## License

MIT
