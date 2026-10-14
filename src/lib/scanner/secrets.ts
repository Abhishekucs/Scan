export interface SecretHit {
  id: string;
  title: string;
  patternName: string;
  sample: string;
  severity: "critical" | "high";
}

const PATTERNS: Array<{
  id: string;
  title: string;
  patternName: string;
  severity: "critical" | "high";
  re: RegExp;
  redact: (m: string) => string;
}> = [
  {
    id: "openai-key",
    title: "OpenAI API key exposed in client bundle",
    patternName: "OpenAI",
    severity: "critical",
    re: /sk-[a-zA-Z0-9]{20,}/g,
    redact: (m) => `${m.slice(0, 7)}…${m.slice(-4)}`,
  },
  {
    id: "stripe-secret",
    title: "Stripe secret key exposed in client bundle",
    patternName: "Stripe secret",
    severity: "critical",
    re: /sk_live_[a-zA-Z0-9]{16,}|sk_test_[a-zA-Z0-9]{16,}/g,
    redact: (m) => `${m.slice(0, 10)}…${m.slice(-4)}`,
  },
  {
    id: "aws-key",
    title: "AWS access key ID exposed in client bundle",
    patternName: "AWS",
    severity: "critical",
    re: /AKIA[0-9A-Z]{16}/g,
    redact: (m) => `${m.slice(0, 6)}…${m.slice(-4)}`,
  },
  {
    id: "github-token",
    title: "GitHub token exposed in client bundle",
    patternName: "GitHub",
    severity: "critical",
    re: /gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}/g,
    redact: (m) => `${m.slice(0, 8)}…${m.slice(-4)}`,
  },
  {
    id: "supabase-service-role",
    title: "Supabase service_role JWT likely exposed",
    patternName: "Supabase service_role",
    severity: "critical",
    re: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    redact: (m) => `${m.slice(0, 12)}…${m.slice(-6)}`,
  },
  {
    id: "private-key",
    title: "Private key material found in served content",
    patternName: "PEM private key",
    severity: "critical",
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    redact: () => "[PEM PRIVATE KEY]",
  },
  {
    id: "generic-secret",
    title: "Hard-coded secret-like value in client code",
    patternName: "Generic secret assignment",
    severity: "high",
    re: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
    redact: (m) => m.replace(/(['"])[^'"]{8,}(['"])/g, "$1…$2"),
  },
];

function isLikelyServiceRoleJwt(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { role?: string; ref?: string };
    return json.role === "service_role";
  } catch {
    return false;
  }
}

export function detectSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const seen = new Set<string>();

  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = p.re.exec(text)) !== null) {
      const raw = match[0];
      if (p.id === "supabase-service-role" && !isLikelyServiceRoleJwt(raw)) {
        continue;
      }
      // Skip common OpenAI-looking false positives that are too short after sk-
      if (p.id === "openai-key" && raw.includes("sk_live")) continue;

      const key = `${p.id}:${raw.slice(0, 24)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        id: p.id,
        title: p.title,
        patternName: p.patternName,
        sample: p.redact(raw),
        severity: p.severity,
      });
      if (hits.length >= 20) return hits;
    }
  }

  return hits;
}

export interface SupabaseCreds {
  url: string;
  anonKey: string;
}

export function detectSupabaseConfig(text: string): SupabaseCreds | null {
  const urlMatch = text.match(
    /https:\/\/[a-z0-9-]+\.supabase\.co(?:\/[^\s"'`]*)?/i
  );
  const anonMatch =
    text.match(
      /(?:supabaseAnonKey|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY|anonKey|anon)\s*[:=]\s*['"](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['"]/i
    ) ||
    text.match(
      /(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
    );

  if (!urlMatch || !anonMatch) return null;

  const url = urlMatch[0].replace(/\/$/, "").replace(/\/rest\/v1.*/, "");
  const anonKey = anonMatch[1] ?? anonMatch[0];

  // Prefer anon-looking tokens (role=anon) when we can decode
  try {
    const payload = anonKey.split(".")[1];
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { role?: string };
    if (json.role === "service_role") return null;
  } catch {
    // keep candidate
  }

  return { url, anonKey };
}

export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  databaseURL?: string;
}

export function detectFirebaseConfig(text: string): FirebaseConfig | null {
  const apiKey = text.match(/apiKey\s*:\s*['"](AIza[0-9A-Za-z_-]{20,})['"]/);
  const projectId = text.match(/projectId\s*:\s*['"]([a-z0-9-]+)['"]/);
  const databaseURL = text.match(
    /databaseURL\s*:\s*['"](https:\/\/[a-z0-9-]+\.firebaseio\.com)['"]/
  );
  if (!apiKey || !projectId) return null;
  return {
    apiKey: apiKey[1],
    projectId: projectId[1],
    databaseURL: databaseURL?.[1],
  };
}
