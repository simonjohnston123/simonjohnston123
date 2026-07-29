import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhook } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe subscription webhook — keeps each business's plan/status in sync with
// its subscription. Configure the endpoint URL + signing secret in Stripe.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  if (!verifyWebhook(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const obj = (event.data?.object ?? {}) as Record<string, unknown>;
  const meta = (obj.metadata ?? {}) as Record<string, string>;
  const agencyId = meta.agencyId;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        if (agencyId) {
          await prisma.agency.update({
            where: { id: agencyId },
            data: {
              plan: meta.plan || undefined,
              stripeCustomerId: obj.customer ? String(obj.customer) : undefined,
              stripeSubscriptionId: obj.subscription ? String(obj.subscription) : undefined,
              status: "ACTIVE",
            },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        if (agencyId) {
          const active = obj.status === "active" || obj.status === "trialing";
          await prisma.agency.update({
            where: { id: agencyId },
            data: {
              plan: meta.plan || undefined,
              stripeSubscriptionId: String(obj.id),
              ...(active ? { status: "ACTIVE" as const } : {}),
            },
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        if (agencyId) {
          await prisma.agency.update({
            where: { id: agencyId },
            data: { plan: "free", stripeSubscriptionId: null },
          });
        }
        break;
      }
    }
  } catch {
    /* never fail the webhook on a downstream error */
  }

  return NextResponse.json({ received: true });
}
