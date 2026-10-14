import { describe, expect, it } from "vitest";
import {
  detectFirebaseConfig,
  detectSecrets,
  detectSupabaseConfig,
} from "./secrets";

describe("detectSecrets", () => {
  it("finds OpenAI and Stripe secret keys", () => {
    const text = `
      const key = "sk-abcdefghijklmnopqrstuvwxyz012345";
      const stripe = "sk_live_51ABCDEFghijklmnopQR";
    `;
    const hits = detectSecrets(text);
    expect(hits.some((h) => h.id === "openai-key")).toBe(true);
    expect(hits.some((h) => h.id === "stripe-secret")).toBe(true);
  });

  it("detects AWS access key IDs", () => {
    const hits = detectSecrets('AWS_KEY=AKIAIOSFODNN7EXAMPLE');
    expect(hits.some((h) => h.id === "aws-key")).toBe(true);
  });

  it("detects service_role JWTs only", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url"
    );
    const servicePayload = Buffer.from(
      JSON.stringify({ role: "service_role", ref: "abc" })
    ).toString("base64url");
    const anonPayload = Buffer.from(
      JSON.stringify({ role: "anon", ref: "abc" })
    ).toString("base64url");
    const sig = "signature";

    const service = `${header}.${servicePayload}.${sig}`;
    const anon = `${header}.${anonPayload}.${sig}`;

    expect(detectSecrets(service).some((h) => h.id === "supabase-service-role")).toBe(
      true
    );
    expect(detectSecrets(anon).some((h) => h.id === "supabase-service-role")).toBe(
      false
    );
  });
});

describe("detectSupabaseConfig", () => {
  it("extracts project URL and anon key", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
    const anonKey = `${header}.${payload}.sig`;
    const text = `
      const url = "https://abcdef.supabase.co";
      const anonKey = "${anonKey}";
    `;
    const cfg = detectSupabaseConfig(text);
    expect(cfg?.url).toContain("supabase.co");
    expect(cfg?.anonKey).toBe(anonKey);
  });
});

describe("detectFirebaseConfig", () => {
  it("parses firebase web config", () => {
    const text = `
      firebase.initializeApp({
        apiKey: "AIzaSyA-test-key-abcdefghijklmnopqrst",
        projectId: "my-app-123",
        databaseURL: "https://my-app-123.firebaseio.com"
      });
    `;
    const cfg = detectFirebaseConfig(text);
    expect(cfg?.projectId).toBe("my-app-123");
    expect(cfg?.databaseURL).toContain("firebaseio.com");
  });
});
