import { NextResponse } from "next/server";
import { z } from "zod";
import { getScan, unlockScan } from "@/lib/storage";
import { appUrl, getStripe, stripeConfigured } from "@/lib/stripe";

const bodySchema = z.object({
  scanId: z.string().min(4),
  plan: z.enum(["one_off", "monitoring"]),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    const { scanId, plan } = parsed.data;
    const scan = await getScan(scanId);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (!stripeConfigured()) {
      // Graceful degrade: unlock locally for demo when Stripe isn't configured
      await unlockScan(scanId, "demo-no-stripe");
      return NextResponse.json({
        mode: "demo",
        url: `${appUrl()}/results/${scanId}?unlocked=1`,
        message:
          "Stripe is not configured. Unlocked this scan locally for demo purposes.",
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe unavailable" }, { status: 500 });
    }

    const price =
      plan === "one_off"
        ? process.env.STRIPE_PRICE_ONE_OFF!
        : process.env.STRIPE_PRICE_MONITORING!;

    const session = await stripe.checkout.sessions.create({
      mode: plan === "one_off" ? "payment" : "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl()}/results/${scanId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/results/${scanId}?checkout=cancel`,
      metadata: { scanId, plan },
    });

    return NextResponse.json({ mode: "stripe", url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
