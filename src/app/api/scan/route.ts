import { NextResponse } from "next/server";
import { z } from "zod";
import { BUILDERS } from "@/lib/types";
import { runScan } from "@/lib/scanner";
import { saveScan, storageBackend } from "@/lib/storage";

/** Keep under Vercel Pro function limit; see src/lib/limits.ts */
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(3).max(2048),
  builder: z.enum(BUILDERS),
  ownsApp: z.literal(true),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Provide a URL, builder, and confirm you own the app.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { url, builder } = parsed.data;

    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      const host = u.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host.endsWith(".local") ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return NextResponse.json(
          { error: "Please scan a publicly reachable deployed URL." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const scan = await runScan({ url, builder });
    await saveScan(scan);

    return NextResponse.json({
      id: scan.id,
      overall: scan.scores.overall,
      url: `/results/${scan.id}`,
      storage: storageBackend(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
