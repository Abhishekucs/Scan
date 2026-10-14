import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { unlockScan } from "@/lib/storage";

export const maxDuration = 30;

const bodySchema = z.object({
  scanId: z.string().min(4),
  sessionId: z.string().min(4),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { scanId, sessionId } = parsed.data;
    const stripe = getStripe();

    if (!stripe) {
      // Demo path
      const scan = await unlockScan(scanId, sessionId);
      return NextResponse.json({ unlocked: Boolean(scan) });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status === "paid" ||
      session.status === "complete"
    ) {
      if (session.metadata?.scanId && session.metadata.scanId !== scanId) {
        return NextResponse.json({ error: "Session mismatch" }, { status: 400 });
      }
      const scan = await unlockScan(scanId, sessionId);
      return NextResponse.json({ unlocked: Boolean(scan) });
    }

    return NextResponse.json({ unlocked: false, status: session.payment_status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
