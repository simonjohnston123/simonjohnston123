import "server-only";
import { prisma } from "@/lib/db";
import { dzFactsForSkus } from "@/lib/dropshipzone";
import { usdToAudCents } from "@/lib/fx";

// ---------------------------------------------------------------------------
// What will it actually cost to send THIS product to THIS address?
//
// One entry point for every supplier, because a storefront and an AI answering
// "how much is postage to Cairns" both need the same truthful number.
//
// What each supplier can actually tell us (probed against the live accounts):
//   CJ Dropshipping — real live quote per destination. Exact.
//   Dropshipzone    — no freight API at all. /postage answers "No Data" for
//                     every SKU and postcode tried, metro through to Christmas
//                     Island. They do flag limited_au_free_shipping per product,
//                     which is the only freight signal they give us.
//
// So a quote is either exact (supplier priced it) or it is not, and the caller
// is always told which. Never present an estimate as a real postage price.
// ---------------------------------------------------------------------------

export type FreightSource = "cj" | "dz-free-shipping" | "unavailable" | "unknown";

export type FreightQuote = {
  /** Null when we genuinely cannot price it — never guess a number. */
  cents: number | null;
  /** True only when the supplier priced this exact destination. */
  exact: boolean;
  source: FreightSource;
  service?: string;
  eta?: string;
  /** Plain-English reason, safe to show a customer or feed to the AI. */
  note: string;
};

export type FreightRequest = {
  locationId: string;
  productId: string;
  qty?: number;
  countryCode: string;
  postcode?: string;
};

const unavailable = (note: string): FreightQuote => ({ cents: null, exact: false, source: "unavailable", note });
const unknown = (note: string): FreightQuote => ({ cents: null, exact: false, source: "unknown", note });

export async function quoteFreight(req: FreightRequest): Promise<FreightQuote> {
  const qty = Math.max(1, req.qty ?? 1);
  const country = req.countryCode.toUpperCase();

  const product = await prisma.product.findFirst({
    where: { id: req.productId, locationId: req.locationId },
    select: { id: true, name: true, sku: true, supplier: true, warehouse: true, externalId: true, shipCountries: true, inventory: true, freightCents: true },
  });
  if (!product) return unknown("Product not found.");

  // The gate comes first: if it can't go there, no price is meaningful.
  const ships = Array.isArray(product.shipCountries) ? (product.shipCountries as string[]) : [];
  if (ships.length && !ships.includes(country)) {
    return unavailable(`We can't send this one to ${country}.`);
  }

  // Known-free postage is already recorded, so no supplier call is needed.
  if (product.freightCents === 0 && country === "AU") {
    return { cents: 0, exact: true, source: "dz-free-shipping", note: "Free delivery within Australia." };
  }

  if (product.supplier === "CJ Dropshipping") return quoteCj(product, qty, country, req.postcode);
  if (product.supplier === "Dropshipzone") return quoteDz(product, country);

  return unknown("No freight source for this supplier yet.");
}

type ProductRow = { id: string; name: string; sku: string | null; supplier: string | null; warehouse: string | null; externalId: string | null };

/** CJ prices the real destination, so this is an exact number. */
async function quoteCj(product: ProductRow, qty: number, country: string, postcode?: string): Promise<FreightQuote> {
  const pid = (product.externalId ?? "").split(":")[0];
  if (!pid) return unknown("This CJ product has no product id.");

  const { cjVariants, cjFreight } = await import("@/lib/cj-orders");
  const variants = await cjVariants(pid);
  const variant = variants.find((v) => product.sku && v.variantSku === product.sku) ?? (variants.length === 1 ? variants[0] : undefined);
  if (!variant?.vid) return unknown(`Couldn't pick a variant (${variants.length} options) — needs choosing before postage can be priced.`);

  const r = await cjFreight({
    startCountryCode: product.warehouse || "CN",
    endCountryCode: country,
    zip: postcode,
    products: [{ vid: variant.vid, quantity: qty }],
  });
  if (!r.ok || !r.options?.length) return unavailable(r.error ?? `No shipping option to ${country}.`);

  const cheapest = [...r.options].sort((a, b) => a.logisticPrice - b.logisticPrice)[0]!;
  // CJ prices freight in USD as well.
  return {
    cents: await usdToAudCents(cheapest.logisticPrice),
    exact: true,
    source: "cj",
    service: cheapest.logisticName,
    eta: cheapest.logisticAging,
    note: `${cheapest.logisticName}${cheapest.logisticAging ? `, about ${cheapest.logisticAging}` : ""}.`,
  };
}

/**
 * Dropshipzone gives no freight API. The one signal they publish is a per
 * product free-shipping flag, so an AU delivery on a flagged product is free
 * and anything else we simply don't know — said plainly rather than guessed.
 */
async function quoteDz(product: ProductRow, country: string): Promise<FreightQuote> {
  if (country !== "AU") return unavailable("Dropshipzone stock ships within Australia only.");
  if (!product.sku) return unknown("No SKU to look up.");

  const facts = await dzFactsForSkus([product.sku]);
  const f = facts.get(product.sku);
  if (!f) return unknown("Supplier no longer lists this item.");

  if (f.freeShipping) {
    return { cents: 0, exact: true, source: "dz-free-shipping", note: "Free delivery within Australia." };
  }
  if (f.limitedFreeShipping) {
    return unknown("Free to most of Australia, but the supplier surcharges some areas and won't say which — confirm for this address.");
  }
  return unknown("The supplier doesn't publish a postage price for this item — confirm before quoting.");
}

/** Quote a whole basket, one line at a time. Suppliers ship separately. */
export async function quoteBasket(
  locationId: string,
  lines: { productId: string; qty?: number }[],
  destination: { countryCode: string; postcode?: string },
): Promise<{ totalCents: number | null; exact: boolean; lines: (FreightQuote & { productId: string })[] }> {
  const quotes = [];
  for (const l of lines) {
    const q = await quoteFreight({ locationId, productId: l.productId, qty: l.qty, ...destination });
    quotes.push({ ...q, productId: l.productId });
  }
  // One unpriceable line makes the basket total untrustworthy — say so rather
  // than quietly under-quoting the customer.
  const allPriced = quotes.every((q) => typeof q.cents === "number");
  return {
    totalCents: allPriced ? quotes.reduce((s, q) => s + (q.cents ?? 0), 0) : null,
    exact: allPriced && quotes.every((q) => q.exact),
    lines: quotes,
  };
}
