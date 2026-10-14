import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { unlockScan } from "@/lib/storage";

export const maxDuration = 30;

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(raw, signature, secret);

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const scanId = session.metadata?.scanId;
      if (scanId) {
        await unlockScan(scanId, session.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
