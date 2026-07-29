import "server-only";
import crypto from "crypto";
import type { Plan } from "@/lib/plans";

// Stripe subscription billing via the REST API (no SDK, so the Docker build needs
// no new dependency). Prices are sent inline as price_data, so no pre-created
// Products/Prices are required in the Stripe dashboard.

const API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set.");
  return k;
}

/**
 * The Stripe secret key a given sub-account connected under Payments → Gateways.
 * Returns null if this location hasn't connected its own Stripe. Payment
 * features should prefer this (each business gets paid into its OWN account)
 * and only fall back to the platform key for platform-level billing.
 */
export async function getLocationStripeKey(locationId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const { decryptJson } = await import("@/lib/crypto");
  const conn = await prisma.connection.findUnique({
    where: { locationId_provider: { locationId, provider: "STRIPE" } },
  });
  if (!conn?.secretCipher || conn.status !== "CONNECTED") return null;
  try {
    const creds = decryptJson<{ secretKey?: string }>(conn.secretCipher);
    return creds.secretKey ?? null;
  } catch {
    return null;
  }
}

export async function locationStripeConnected(locationId: string): Promise<boolean> {
  return (await getLocationStripeKey(locationId)) !== null;
}

async function post(path: string, params: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string })?.message ?? `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function createCheckoutSession(opts: {
  agencyId: string;
  plan: Plan;
  customerEmail: string;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const p = new URLSearchParams();
  p.set("mode", "subscription");
  p.set("success_url", opts.successUrl);
  p.set("cancel_url", opts.cancelUrl);
  if (opts.customerId) p.set("customer", opts.customerId);
  else p.set("customer_email", opts.customerEmail);
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", "aud");
  p.set("line_items[0][price_data][product_data][name]", `PlacidCRM ${opts.plan.name}`);
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(opts.plan.priceMonthly * 100)));
  p.set("line_items[0][price_data][recurring][interval]", "month");
  p.set("metadata[agencyId]", opts.agencyId);
  p.set("metadata[plan]", opts.plan.key);
  p.set("subscription_data[metadata][agencyId]", opts.agencyId);
  p.set("subscription_data[metadata][plan]", opts.plan.key);

  const session = await post("/checkout/sessions", p);
  return String(session.url);
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const p = new URLSearchParams();
  p.set("customer", customerId);
  p.set("return_url", returnUrl);
  const session = await post("/billing_portal/sessions", p);
  return String(session.url);
}

/** Verify a Stripe webhook signature (t=…,v1=…) against the signing secret. */
export function verifyWebhook(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}
