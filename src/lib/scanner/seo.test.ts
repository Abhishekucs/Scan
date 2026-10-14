import { describe, expect, it, vi } from "vitest";
import { runSeoChecks } from "./seo";
import type { FetchedResource } from "./fetch";

function page(body: string): FetchedResource {
  return {
    url: "https://example.com",
    finalUrl: "https://example.com",
    status: 200,
    ok: true,
    headers: {},
    body,
    bytes: body.length,
    ttfbMs: 100,
  };
}

describe("runSeoChecks", () => {
  it("flags missing title and description", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const { findings } = await runSeoChecks({
      page: page("<html><head></head><body><p>Hi</p></body></html>"),
      builder: "Cursor",
    });

    expect(findings.some((f) => f.id === "seo-title-missing")).toBe(true);
    expect(findings.some((f) => f.id === "seo-description-missing")).toBe(true);
    expect(findings.some((f) => f.id === "seo-h1-missing")).toBe(true);
    vi.restoreAllMocks();
  });

  it("accepts a reasonably complete head", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n");
      }
      if (url.endsWith("/sitemap.xml")) {
        return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      }
      return new Response("Not Found", { status: 404 });
    });

    const html = `
      <html><head>
        <title>My Launch Ready App</title>
        <meta name="description" content="A polished app ready for customers." />
        <meta property="og:title" content="My Launch Ready App" />
        <meta property="og:description" content="A polished app ready for customers." />
        <meta property="og:image" content="https://example.com/og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="My Launch Ready App" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href="https://example.com/" />
      </head><body><h1>Ship it</h1></body></html>
    `;

    const { findings, title } = await runSeoChecks({
      page: page(html),
      builder: "v0",
    });

    expect(title).toBe("My Launch Ready App");
    expect(findings.some((f) => f.id === "seo-title-missing")).toBe(false);
    expect(findings.some((f) => f.id === "seo-description-missing")).toBe(false);
    vi.restoreAllMocks();
  });
});
