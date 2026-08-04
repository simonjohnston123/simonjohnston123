import "server-only";
import { prisma } from "@/lib/db";
import { stripeSecretKey, applicationFeeMinor } from "@/lib/stripe-connect";
import type { CartLine } from "@/lib/cart";

// ---------------------------------------------------------------------------
// Storefront checkout.
//
// A real basket, not the single-line payment link the CRM uses for invoices:
// several products, a shipping address collected by Stripe, and the order
// written back into the CRM so the ordering desk can buy the stock.
//
// The charge lands on the business's connected account with the platform fee
// taken automatically, so this works the same for Placid Deals and for any
// business that later runs its own shop on the platform.
// ---------------------------------------------------------------------------

const API = "https://api.stripe.com/v1";

function appUrl(): string {
  return process.env.APP_URL || "https://placidcrm.com";
}

/** Countries we're prepared to take a delivery address for. */
const SHIPPING_COUNTRIES = ["AU", "NZ", "US", "GB", "DE", "ES", "CA", "IE", "SG", "FR"];

export async function createStorefrontCheckout(
  locationId: string,
  slug: string,
  lines: CartLine[],
  destination: string | null,
  email?: string,
): Promise<string> {
  const key = await stripeSecretKey();
  const loc = await prisma.location.findUnique({
    where: { id: locationId },
    select: { stripeAccountId: true },
  });
  if (!key) throw new Error("Payments aren't configured on the platform.");
  if (!loc?.stripeAccountId) throw new Error("This shop hasn't set up payments yet.");

  const totalMinor = lines.reduce((s, l) => s + l.lineCents, 0);
  if (totalMinor < 50) throw new Error("Basket total is too small to charge.");

  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${appUrl()}/shop/${slug}/thanks?session={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${appUrl()}/shop/${slug}/cart`);
  if (email) p.set("customer_email", email);

  lines.forEach((l, i) => {
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, "aud");
    p.set(`line_items[${i}][price_data][product_data][name]`, l.name.slice(0, 120));
    p.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitCents));
  });

  // We have to know where it's going in order to fulfil it, so Stripe collects
  // the address rather than us asking for it twice.
  const allowed = destination && SHIPPING_COUNTRIES.includes(destination) ? [destination] : SHIPPING_COUNTRIES;
  allowed.forEach((c, i) => p.set(`shipping_address_collection[allowed_countries][${i}]`, c));
  p.set("phone_number_collection[enabled]", "true");

  const fee = await applicationFeeMinor(totalMinor);
  if (fee > 0) p.set("payment_intent_data[application_fee_amount]", String(fee));

  // Carried through so the webhook can rebuild the order without guessing.
  p.set("metadata[locationId]", locationId);
  p.set("metadata[source]", "Placid Deals website");
  p.set("metadata[items]", JSON.stringify(lines.map((l) => ({ id: l.id, n: l.name.slice(0, 60), q: l.qty, c: l.unitCents }))).slice(0, 480));

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "Stripe-Account": loc.stripeAccountId,
    },
    body: p.toString(),
  });

  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) throw new Error(json.error?.message ?? "Stripe refused the checkout.");
  return json.url;
}
