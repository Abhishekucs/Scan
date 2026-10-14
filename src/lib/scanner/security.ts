import type { Builder, Finding } from "../types";
import { buildFixPrompt } from "../prompts";
import { LIMITS } from "../limits";
import type { FetchedResource } from "./fetch";
import { fetchResource } from "./fetch";
import {
  detectFirebaseConfig,
  detectSecrets,
  detectSupabaseConfig,
} from "./secrets";

function finding(
  builder: Builder,
  partial: Omit<Finding, "fixPrompt"> & { fixPrompt?: string }
): Finding {
  return {
    ...partial,
    fixPrompt:
      partial.fixPrompt ??
      buildFixPrompt(builder, partial.title, partial.explanation, partial.evidence),
  };
}

async function checkExposedPaths(
  origin: string,
  builder: Builder
): Promise<Finding[]> {
  const paths = [
    "/.env",
    "/.env.local",
    "/.git/config",
    "/.git/HEAD",
    "/.DS_Store",
  ];
  const out: Finding[] = [];

  await Promise.all(
    paths.map(async (p) => {
      try {
        const res = await fetchResource(new URL(p, origin).toString(), {
          timeoutMs: LIMITS.probeTimeoutMs,
          maxBytes: LIMITS.probeMaxBytes,
        });
        if (!res.ok) return;
        const looksSensitive =
          p.includes(".env")
            ? /=/.test(res.body) || /SECRET|KEY|TOKEN/i.test(res.body)
            : p.includes(".git")
              ? /\[core\]|ref:/.test(res.body)
              : res.bytes > 0;
        if (!looksSensitive) return;
        out.push(
          finding(builder, {
            id: `exposed-path-${p.replace(/[^\w]+/g, "-")}`,
            category: "security",
            severity: "critical",
            title: `Sensitive path publicly reachable: ${p}`,
            explanation:
              "Attackers can download configuration or source history from publicly exposed paths. Remove these files from the deploy artifact and block them at the CDN/edge.",
            evidence: `${res.status} ${res.finalUrl} (${res.bytes} bytes)`,
          })
        );
      } catch {
        // unreachable is fine
      }
    })
  );

  return out;
}

async function checkSupabaseRls(
  builder: Builder,
  bundleText: string
): Promise<Finding[]> {
  const cfg = detectSupabaseConfig(bundleText);
  if (!cfg) return [];

  const findings: Finding[] = [
    finding(builder, {
      id: "supabase-anon-in-bundle",
      category: "security",
      severity: "info",
      title: "Supabase project URL + anon key found in client bundle",
      explanation:
        "Publishing the anon key is expected for client apps, but tables must be protected with Row Level Security. We ran a read-only probe next.",
      evidence: cfg.url,
    }),
  ];

  try {
    const openApi = await fetchResource(`${cfg.url}/rest/v1/`, {
      timeoutMs: LIMITS.probeTimeoutMs,
      maxBytes: 200_000,
    });
    // Prefer PostgREST OpenAPI via Accept header
    const schemaRes = await fetch(`${cfg.url}/rest/v1/`, {
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: "application/openapi+json",
      },
      signal: AbortSignal.timeout(LIMITS.probeTimeoutMs),
    });

    let tableNames: string[] = [];
    if (schemaRes.ok) {
      const schema = (await schemaRes.json()) as {
        paths?: Record<string, unknown>;
      };
      tableNames = Object.keys(schema.paths ?? {})
        .map((p) => p.replace(/^\//, ""))
        .filter((n) => n && !n.includes("{") && n !== "rpc")
        .slice(0, 8);
    } else if (openApi.ok) {
      tableNames = [];
    }

    // Fallback: try common table names if OpenAPI unavailable
    if (tableNames.length === 0) {
      tableNames = ["users", "profiles", "orders", "posts", "messages", "todos"];
    }

    for (const table of tableNames) {
      try {
        const probe = await fetch(
          `${cfg.url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
          {
            headers: {
              apikey: cfg.anonKey,
              Authorization: `Bearer ${cfg.anonKey}`,
              Prefer: "count=exact",
            },
            signal: AbortSignal.timeout(LIMITS.probeTimeoutMs),
          }
        );
        if (probe.status === 200) {
          const body = await probe.text();
          if (body.trim().startsWith("[")) {
            findings.push(
              finding(builder, {
                id: `supabase-rls-${table}`,
                category: "security",
                severity: "critical",
                title: `Supabase table "${table}" readable without auth`,
                explanation:
                  "Anonymous clients can read rows from this table. Enable Row Level Security and add policies that restrict SELECT to authenticated owners (or the intended audience).",
                evidence: `GET /rest/v1/${table} → ${probe.status}`,
              })
            );
          }
        }
      } catch {
        // ignore individual table failures
      }
    }
  } catch {
    findings.push(
      finding(builder, {
        id: "supabase-probe-failed",
        category: "security",
        severity: "low",
        title: "Could not complete Supabase RLS probe",
        explanation:
          "We found Supabase credentials but could not finish the read-only table probe. Manually verify RLS is enabled on every table.",
        evidence: cfg.url,
      })
    );
  }

  return findings;
}

async function checkFirebaseOpenReads(
  builder: Builder,
  bundleText: string
): Promise<Finding[]> {
  const cfg = detectFirebaseConfig(bundleText);
  if (!cfg) return [];

  const findings: Finding[] = [
    finding(builder, {
      id: "firebase-config-in-bundle",
      category: "security",
      severity: "info",
      title: "Firebase web config found in client bundle",
      explanation:
        "Firebase web config is normally public. Security depends on Firestore/Realtime Database rules. We attempted a read-only open-read check where feasible.",
      evidence: `projectId=${cfg.projectId}`,
    }),
  ];

  if (cfg.databaseURL) {
    try {
      const res = await fetchResource(`${cfg.databaseURL}/.json?shallow=true`, {
        timeoutMs: LIMITS.probeTimeoutMs,
        maxBytes: 100_000,
      });
      if (res.ok && res.body.trim() !== "null" && res.body.trim() !== "{}") {
        findings.push(
          finding(builder, {
            id: "firebase-rtdb-open",
            category: "security",
            severity: "critical",
            title: "Firebase Realtime Database appears openly readable",
            explanation:
              "Unauthenticated clients can read database data. Lock down Realtime Database rules so reads require auth (or explicit public paths only).",
            evidence: `${cfg.databaseURL}/.json → ${res.status}`,
          })
        );
      }
    } catch {
      // ignore
    }
  }

  // Firestore REST open rules are harder without collection IDs; note as guidance.
  findings.push(
    finding(builder, {
      id: "firebase-firestore-rules-review",
      category: "security",
      severity: "medium",
      title: "Review Firestore security rules before launch",
      explanation:
        "Confirm no rule grants open read/write (`allow read, write: if true`). Prefer auth-scoped ownership checks.",
      evidence: `project ${cfg.projectId}`,
    })
  );

  return findings;
}

function checkHeaders(page: FetchedResource, builder: Builder): Finding[] {
  const h = page.headers;
  const findings: Finding[] = [];

  const required: Array<{
    header: string;
    severity: Finding["severity"];
    title: string;
    explanation: string;
  }> = [
    {
      header: "content-security-policy",
      severity: "medium",
      title: "Missing Content-Security-Policy header",
      explanation:
        "CSP reduces XSS impact by restricting script sources. Add a CSP at your host/CDN or Next.js headers config.",
    },
    {
      header: "x-frame-options",
      severity: "low",
      title: "Missing X-Frame-Options / frame-ancestors protection",
      explanation:
        "Without clickjacking protection, your app can be embedded in malicious iframes. Set X-Frame-Options: DENY or CSP frame-ancestors.",
    },
    {
      header: "x-content-type-options",
      severity: "low",
      title: "Missing X-Content-Type-Options: nosniff",
      explanation:
        "This header prevents MIME sniffing attacks. Add `X-Content-Type-Options: nosniff`.",
    },
    {
      header: "referrer-policy",
      severity: "low",
      title: "Missing Referrer-Policy header",
      explanation:
        "Control how much URL data is sent on navigations. Prefer `strict-origin-when-cross-origin` or stricter.",
    },
    {
      header: "strict-transport-security",
      severity: "medium",
      title: "Missing Strict-Transport-Security (HSTS)",
      explanation:
        "HSTS forces HTTPS on return visits and helps prevent downgrade attacks.",
    },
  ];

  for (const item of required) {
    if (!h[item.header]) {
      // frame protection can also come from CSP
      if (
        item.header === "x-frame-options" &&
        h["content-security-policy"]?.includes("frame-ancestors")
      ) {
        continue;
      }
      findings.push(
        finding(builder, {
          id: `header-${item.header}`,
          category: "security",
          severity: item.severity,
          title: item.title,
          explanation: item.explanation,
        })
      );
    }
  }

  return findings;
}

function checkHttps(page: FetchedResource, builder: Builder): Finding[] {
  const url = new URL(page.finalUrl);
  if (url.protocol === "https:") return [];
  return [
    finding(builder, {
      id: "no-https",
      category: "security",
      severity: "critical",
      title: "Site is not served over HTTPS",
      explanation:
        "Launching without HTTPS exposes users to interception and breaks modern browser features. Enable TLS at your host (Vercel/Netlify/Cloudflare).",
      evidence: page.finalUrl,
    }),
  ];
}

function checkSourceMaps(
  builder: Builder,
  html: string,
  scriptBodies: string[]
): Finding[] {
  const findings: Finding[] = [];
  const mapRefs = [
    ...html.matchAll(/\/\/[#@]\s*sourceMappingURL=(\S+)/g),
    ...scriptBodies.flatMap((b) => [
      ...b.matchAll(/\/\/[#@]\s*sourceMappingURL=(\S+)/g),
    ]),
  ];
  if (mapRefs.length > 0) {
    findings.push(
      finding(builder, {
        id: "source-maps-referenced",
        category: "security",
        severity: "medium",
        title: "JavaScript source maps referenced in production",
        explanation:
          "Public source maps make reverse-engineering and finding secrets easier. Disable source map upload/publish for production builds.",
        evidence: mapRefs
          .slice(0, 3)
          .map((m) => m[1])
          .join(", "),
      })
    );
  }
  return findings;
}

export async function runSecurityChecks(opts: {
  page: FetchedResource;
  scriptBodies: string[];
  builder: Builder;
}): Promise<Finding[]> {
  const { page, scriptBodies, builder } = opts;
  const corpus = [page.body, ...scriptBodies].join("\n");
  const findings: Finding[] = [];

  findings.push(...checkHttps(page, builder));
  findings.push(...checkHeaders(page, builder));

  for (const hit of detectSecrets(corpus)) {
    findings.push(
      finding(builder, {
        id: `secret-${hit.id}-${hit.sample}`,
        category: "security",
        severity: hit.severity,
        title: hit.title,
        explanation:
          "Secrets in client-served HTML/JS can be copied by anyone. Move them to server-only env vars, rotate the exposed credentials immediately, and scrub git history if they were committed.",
        evidence: `${hit.patternName}: ${hit.sample}`,
      })
    );
  }

  findings.push(...checkSourceMaps(builder, page.body, scriptBodies));
  findings.push(...(await checkExposedPaths(new URL(page.finalUrl).origin, builder)));
  findings.push(...(await checkSupabaseRls(builder, corpus)));
  findings.push(...(await checkFirebaseOpenReads(builder, corpus)));

  return findings;
}
