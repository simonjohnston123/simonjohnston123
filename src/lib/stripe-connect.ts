import "server-only";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/platform-settings";

// ---------------------------------------------------------------------------
// Embedded Stripe Connect — "Placid Connect payments".
//
// The business NEVER sees Stripe branding. Placid Connect creates a connected
// account for them (controller.stripe_dashboard = none) and drops Stripe's
// embedded onboarding component inside our own UI, styled with the Placid
// palette. Stripe still runs all KYC / compliance behind the scenes.
//
// Money from invoices & bookings is charged on the connected account with a
// platform application fee (PLATFORM_FEE_PERCENT) skimmed to Placid Connect.
//
// No SDK — plain REST so the Docker image needs no server-side Stripe package.
// ---------------------------------------------------------------------------

const API = "https://api.stripe.com/v1";

// Keys/fee come from the admin settings store first (set via /admin/payments),
// falling back to server env. So the super-admin can go live from the UI.
export async function stripeSecretKey(): Promise<string | null> {
  return (await getSetting(SETTING_KEYS.stripeSecretKey)) || process.env.STRIPE_SECRET_KEY || null;
}

/** Publishable key is safe to expose to the browser (needed by connect-js). */
export async function stripePublishableKey(): Promise<string | null> {
  return (await getSetting(SETTING_KEYS.stripePublishableKey)) || process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/** Both keys present → the embedded payments experience is live. */
export async function stripeConnectConfigured(): Promise<boolean> {
  const [sk, pk] = await Promise.all([stripeSecretKey(), stripePublishableKey()]);
  return Boolean(sk && pk);
}

/** The % Placid Connect adds on top of each charge. Defaults to 2%. */
export async function platformFeePercent(): Promise<number> {
  const raw = (await getSetting(SETTING_KEYS.platformFeePercent)) || process.env.PLATFORM_FEE_PERCENT;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 2;
}

async function secret(): Promise<string> {
  const k = await stripeSecretKey();
  if (!k) throw new Error("Stripe secret key is not set.");
  return k;
}

// Map a free-text country to an ISO-3166 alpha-2 for Stripe. Falls back to AU.
function isoCountry(country?: string | null): string {
  const c = (country || "").trim().toLowerCase();
  const map: Record<string, string> = {
    australia: "AU", au: "AU",
    "new zealand": "NZ", nz: "NZ",
    "united states": "US", usa: "US", us: "US", america: "US",
    "united kingdom": "GB", uk: "GB", gb: "GB", england: "GB",
    canada: "CA", ca: "CA",
  };
  return map[c] || "AU";
}

async function call(
  method: "GET" | "POST",
  path: string,
  params?: URLSearchParams,
  accountId?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await secret()}`,
      // Acting on behalf of a connected account (direct charge on their account).
      ...(accountId ? { "Stripe-Account": accountId } : {}),
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? params.toString() : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message ?? `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/**
 * Return the connected-account id for a location, creating it on first use.
 * The account is a white-label controller account: no Stripe dashboard, Stripe
 * collects requirements (so the embedded onboarding component works), and the
 * platform owns fees + loss liability.
 */
export async function ensureConnectedAccount(locationId: string): Promise<string> {
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc) throw new Error("Location not found");
  if (loc.stripeAccountId) return loc.stripeAccountId;

  const p = new URLSearchParams();
  p.set("country", isoCountry(loc.country));
  if (loc.email) p.set("email", loc.email);
  p.set("business_profile[name]", loc.name);
  if (loc.website) p.set("business_profile[url]", loc.website);
  // White-label controller config — the business sees only Placid Connect.
  // fees.payer=account + losses.payments=stripe → the connected business bears
  // Stripe's processing fee AND dispute liability, so Placid's application fee
  // (PLATFORM_FEE_PERCENT) is CLEAN margin, not eroded by Stripe's cut.
  p.set("controller[stripe_dashboard][type]", "none");
  p.set("controller[requirement_collection]", "stripe");
  p.set("controller[fees][payer]", "account");
  p.set("controller[losses][payments]", "stripe");
  p.set("capabilities[card_payments][requested]", "true");
  p.set("capabilities[transfers][requested]", "true");
  p.set("metadata[locationId]", loc.id);

  const acct = await call("POST", "/accounts", p);
  const accountId = String(acct.id);
  await prisma.location.update({ where: { id: locationId }, data: { stripeAccountId: accountId } });
  return accountId;
}

/**
 * Create an Account Session client secret for the embedded onboarding component.
 * The browser passes this to connect-js; it expires quickly, so the client
 * re-fetches on demand.
 */
export async function createOnboardingSession(locationId: string): Promise<string> {
  const accountId = await ensureConnectedAccount(locationId);
  const p = new URLSearchParams();
  p.set("account", accountId);
  p.set("components[account_onboarding][enabled]", "true");
  const session = await call("POST", "/account_sessions", p);
  return String(session.client_secret);
}

export type AccountStatus = {
  charges: boolean;
  details: boolean;
  payouts: boolean;
};

/** Pull fresh capability flags from Stripe and cache them on the location. */
export async function refreshAccountStatus(locationId: string): Promise<AccountStatus> {
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc?.stripeAccountId) return { charges: false, details: false, payouts: false };
  const acct = await call("GET", `/accounts/${loc.stripeAccountId}`);
  const status: AccountStatus = {
    charges: Boolean(acct.charges_enabled),
    details: Boolean(acct.details_submitted),
    payouts: Boolean(acct.payouts_enabled),
  };
  await prisma.location.update({
    where: { id: locationId },
    data: {
      stripeChargesEnabled: status.charges,
      stripeDetailsSubmitted: status.details,
      stripePayoutsEnabled: status.payouts,
    },
  });
  return status;
}

/**
 * The application fee (in the smallest currency unit) for a charge of
 * `amountMinor`, using PLATFORM_FEE_PERCENT. Used when creating PaymentIntents
 * on the connected account for invoices/bookings.
 */
export async function applicationFeeMinor(amountMinor: number): Promise<number> {
  return Math.round((amountMinor * (await platformFeePercent())) / 100);
}

function appUrl(): string {
  return process.env.APP_URL || "https://placidcrm.com";
}

/**
 * Create a shareable Stripe Checkout link that charges a customer on the
 * business's connected account, skimming the platform application fee to Placid
 * Connect. Returns the URL to send/copy. Throws if the business hasn't finished
 * payments onboarding.
 */
export async function createDirectCheckout(
  locationId: string,
  opts: { amountMinor: number; description: string; currency?: string; customerEmail?: string },
): Promise<{ url: string; feeMinor: number }> {
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc?.stripeAccountId) throw new Error("This business hasn't set up payments yet.");
  const status = await refreshAccountStatus(locationId);
  if (!status.charges) throw new Error("Payments setup isn't finished for this business yet.");
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor < 50) {
    throw new Error("Enter an amount of at least $0.50.");
  }

  const currency = (opts.currency || "aud").toLowerCase();
  const feeMinor = await applicationFeeMinor(opts.amountMinor);
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${appUrl()}/pay/success`);
  p.set("cancel_url", `${appUrl()}/pay/cancelled`);
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", currency);
  p.set("line_items[0][price_data][product_data][name]", opts.description || "Payment");
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(opts.amountMinor)));
  if (feeMinor > 0) p.set("payment_intent_data[application_fee_amount]", String(feeMinor));
  if (opts.customerEmail) p.set("customer_email", opts.customerEmail);
  p.set("metadata[locationId]", locationId);

  // Direct charge on the connected account (Stripe-Account header).
  const session = await call("POST", "/checkout/sessions", p, loc.stripeAccountId);
  return { url: String(session.url), feeMinor };
}
