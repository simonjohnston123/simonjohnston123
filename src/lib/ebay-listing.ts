import "server-only";
import { getValidToken } from "@/lib/ebay-sync";

// Real eBay listing push (Sell Inventory API): inventory_item → offer → publish.
// NOT YET TESTED against live eBay — build only. eBay listing is strict: it needs
// business policies (fulfillment/payment/return), a merchant location, a LEAF
// category, and category-required item aspects. This module resolves the policies
// + location automatically and suggests a category; the likely first thing to fix
// in live testing is category-required aspects (item specifics) per category.

const API = "https://api.ebay.com";
const MARKETPLACE_ID = "EBAY_AU";
const CONTENT_LANGUAGE = "en-AU";
const CURRENCY = "AUD";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    // eBay's Inventory API validates BOTH Content-Language and Accept-Language;
    // omitting Accept-Language 400s with errorId 25709.
    "Content-Language": CONTENT_LANGUAGE,
    "Accept-Language": CONTENT_LANGUAGE,
    "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
  };
}

export type ListingProductInput = {
  id: string;
  externalId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  inventory: number | null;
  sku: string | null;
  category: string | null;
};

export type ListingResult = { ok: boolean; productId: string; listingId?: string; offerId?: string; reason?: string };

type ListingContext = {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
};

async function firstPolicyId(token: string, kind: "fulfillment_policy" | "payment_policy" | "return_policy"): Promise<string | null> {
  const res = await fetch(`${API}/sell/account/v1/${kind}?marketplace_id=${MARKETPLACE_ID}`, { headers: headers(token), cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, Array<Record<string, string>>>;
  const arr = json[`${kind.replace("_policy", "")}Policies`] || json.fulfillmentPolicies || json.paymentPolicies || json.returnPolicies || [];
  const id = arr[0]?.fulfillmentPolicyId || arr[0]?.paymentPolicyId || arr[0]?.returnPolicyId;
  return id ?? null;
}

/** Find (or create) the merchant inventory location eBay requires on every offer. */
async function merchantLocationKey(token: string): Promise<string | null> {
  const res = await fetch(`${API}/sell/inventory/v1/location`, { headers: headers(token), cache: "no-store" });
  if (res.ok) {
    const json = (await res.json()) as { locations?: Array<{ merchantLocationKey?: string }> };
    const key = json.locations?.[0]?.merchantLocationKey;
    if (key) return key;
  }
  // None yet — create a minimal one.
  const key = "placid-default";
  const create = await fetch(`${API}/sell/inventory/v1/location/${key}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      location: { address: { country: "AU" } },
      locationInstructions: "Default location",
      merchantLocationStatus: "ENABLED",
      locationTypes: ["WAREHOUSE"],
    }),
  });
  return create.ok || create.status === 409 ? key : null;
}

/** Resolve the store-wide bits every offer needs, once per push run. */
export async function resolveListingContext(token: string): Promise<{ ok: boolean; ctx?: ListingContext; reason?: string }> {
  const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId, locKey] = await Promise.all([
    firstPolicyId(token, "fulfillment_policy"),
    firstPolicyId(token, "payment_policy"),
    firstPolicyId(token, "return_policy"),
    merchantLocationKey(token),
  ]);
  if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
    return { ok: false, reason: "Set up eBay business policies (postage, payment, returns) first — Seller Hub → Business Policies." };
  }
  if (!locKey) return { ok: false, reason: "Could not resolve an eBay inventory location." };
  return { ok: true, ctx: { fulfillmentPolicyId, paymentPolicyId, returnPolicyId, merchantLocationKey: locKey } };
}

async function suggestCategoryId(token: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/commerce/taxonomy/v1/category_tree/15/get_category_suggestions?q=${encodeURIComponent(title.slice(0, 60))}`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { categorySuggestions?: Array<{ category?: { categoryId?: string } }> };
    return json.categorySuggestions?.[0]?.category?.categoryId ?? null;
  } catch {
    return null;
  }
}

/** Push a single product live to eBay: inventory item → offer → publish. */
export async function pushProductToEbay(locationId: string, p: ListingProductInput, ctx: ListingContext, token: string): Promise<ListingResult> {
  const sku = (p.sku || `PDCRM-${p.externalId || p.id}`).slice(0, 50);
  const quantity = Math.max(p.inventory ?? 1, 1);
  const priceValue = ((p.priceCents ?? 0) / 100).toFixed(2);

  // 1) Inventory item
  const inv = await fetch(`${API}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity } },
      condition: "NEW",
      product: {
        title: p.name.slice(0, 80),
        description: (p.description || p.name).slice(0, 4000),
        imageUrls: p.imageUrl ? [p.imageUrl] : [],
        aspects: { Brand: ["Unbranded"] }, // TODO: category-required aspects in live testing
      },
    }),
  });
  if (!inv.ok && inv.status !== 204) {
    return { ok: false, productId: p.id, reason: `inventory_item ${inv.status}: ${(await inv.text()).slice(0, 160)}` };
  }

  const categoryId = await suggestCategoryId(token, p.name);
  if (!categoryId) return { ok: false, productId: p.id, reason: "Could not resolve an eBay category." };

  // 2) Offer
  const offerRes = await fetch(`${API}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      sku,
      marketplaceId: MARKETPLACE_ID,
      format: "FIXED_PRICE",
      availableQuantity: quantity,
      categoryId,
      listingDescription: (p.description || p.name).slice(0, 4000),
      pricingSummary: { price: { value: priceValue, currency: CURRENCY } },
      listingPolicies: {
        fulfillmentPolicyId: ctx.fulfillmentPolicyId,
        paymentPolicyId: ctx.paymentPolicyId,
        returnPolicyId: ctx.returnPolicyId,
      },
      merchantLocationKey: ctx.merchantLocationKey,
    }),
  });
  if (!offerRes.ok) return { ok: false, productId: p.id, reason: `offer ${offerRes.status}: ${(await offerRes.text()).slice(0, 160)}` };
  const offerId = ((await offerRes.json()) as { offerId?: string }).offerId;
  if (!offerId) return { ok: false, productId: p.id, reason: "no offerId returned" };

  // 3) Publish
  const pub = await fetch(`${API}/sell/inventory/v1/offer/${offerId}/publish`, { method: "POST", headers: headers(token) });
  if (!pub.ok) return { ok: false, productId: p.id, offerId, reason: `publish ${pub.status}: ${(await pub.text()).slice(0, 160)}` };
  const listingId = ((await pub.json()) as { listingId?: string }).listingId;
  return { ok: true, productId: p.id, offerId, listingId };
}

export { getValidToken };
