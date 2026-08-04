import "server-only";
import { prisma } from "@/lib/db";
import { cjToken } from "@/lib/cj";

// ---------------------------------------------------------------------------
// Placing and paying CJ orders from inside the CRM.
//
// CJ is the one supplier whose API allows the whole loop — Dropshipzone's
// orders endpoint is GET-only. The flow is deliberately two steps:
//
//   1. create the order with payType 3 ("create, do not pay")
//   2. pay from the CJ wallet, only on an explicit click
//
// Payment is irreversible and spends real money, so it never happens as a side
// effect of placing.
// ---------------------------------------------------------------------------

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

type CjEnvelope<T> = { code?: number; result?: boolean; message?: string; data?: T };

async function cjCall<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = await cjToken();
  if (!token) return { ok: false, error: "CJ isn't connected (no API key)." };

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "CJ-Access-Token": token, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as CjEnvelope<T>;
  // CJ answers 200 with result:false for business errors, so status isn't enough.
  if (json.result === false || json.code !== 200) {
    return { ok: false, error: json.message || `CJ error ${json.code ?? res.status}` };
  }
  return { ok: true, data: json.data };
}

// --- Balance ---------------------------------------------------------------

export type CjBalance = { amount: number; frozen: number };

export async function cjBalance(): Promise<{ ok: boolean; balance?: CjBalance; error?: string }> {
  const r = await cjCall<{ amount?: number; freezeAmount?: number }>("/shopping/pay/getBalance");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, balance: { amount: Number(r.data?.amount ?? 0), frozen: Number(r.data?.freezeAmount ?? 0) } };
}

// --- Variants --------------------------------------------------------------

export type CjVariant = { vid: string; variantSku?: string; variantSellPrice?: number };

/** An order needs a variant id, not a product id. */
export async function cjVariants(pid: string): Promise<CjVariant[]> {
  const r = await cjCall<CjVariant[]>(`/product/variant/query?pid=${encodeURIComponent(pid)}`);
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// --- Freight ---------------------------------------------------------------

export type CjFreightOption = { logisticName: string; logisticPrice: number; logisticAging?: string };

export async function cjFreight(input: {
  startCountryCode: string;
  endCountryCode: string;
  zip?: string;
  products: { vid: string; quantity: number }[];
}): Promise<{ ok: boolean; options?: CjFreightOption[]; error?: string }> {
  const r = await cjCall<CjFreightOption[]>("/logistic/freightCalculate", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!r.ok) return { ok: false, error: r.error };
  const options = (Array.isArray(r.data) ? r.data : []).map((o) => ({
    logisticName: String(o.logisticName ?? ""),
    logisticPrice: Number(o.logisticPrice ?? 0),
    logisticAging: o.logisticAging,
  }));
  return { ok: true, options };
}

// --- Address ---------------------------------------------------------------

export type PostalAddress = {
  line1: string; city: string; province: string; postcode: string; countryCode: string;
};

/**
 * Split the single delivery-address string back into the parts CJ needs.
 *
 * Orders are stored as one line because that's what the marketplaces give us,
 * built as "line1, [line2,] city, state, postcode, COUNTRY". Parsing from the
 * END is the reliable direction — the street can contain any number of commas.
 * Returns null rather than guessing when it doesn't fit, so a bad address stops
 * the order instead of shipping somewhere wrong.
 */
export function parseAddress(address: string | null): PostalAddress | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 4) return null;

  const countryCode = (parts[parts.length - 1] ?? "").toUpperCase();
  const postcode = parts[parts.length - 2] ?? "";
  const province = parts[parts.length - 3] ?? "";
  const city = parts[parts.length - 4] ?? "";
  const line1 = parts.slice(0, Math.max(1, parts.length - 4)).join(", ");

  if (!/^[A-Z]{2,3}$/.test(countryCode) || !line1) return null;
  return { line1, city, province, postcode, countryCode };
}

const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia", US: "United States", GB: "United Kingdom", NZ: "New Zealand",
  CA: "Canada", DE: "Germany", FR: "France", ES: "Spain", IE: "Ireland", SG: "Singapore",
};

// --- Place -----------------------------------------------------------------

export type CjPlaceResult = { ok: boolean; cjOrderId?: string; freight?: number; logistic?: string; error?: string };

/**
 * Create (but do not pay) a CJ order for one of our supplier orders.
 *
 * Everything is resolved live from CJ: the variant id, then the cheapest
 * logistics option for the real destination — so the freight quoted is the one
 * that will actually be charged.
 */
export async function placeCjOrder(supplierOrderId: string): Promise<CjPlaceResult> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: { order: { select: { number: true, deliveryAddress: true, customerName: true, customerPhone: true, customerEmail: true } } },
  });
  if (!so) return { ok: false, error: "Supplier order not found." };
  if (so.supplierRef) return { ok: false, error: `Already placed with CJ (${so.supplierRef}).` };

  const addr = parseAddress(so.order.deliveryAddress);
  if (!addr) return { ok: false, error: "Delivery address couldn't be read — check the order before sending it to CJ." };

  const items = (Array.isArray(so.items) ? so.items : []) as { productId?: string; qty?: number; sku?: string }[];
  if (!items.length) return { ok: false, error: "Nothing to order." };

  // Resolve each line to a CJ variant.
  const products: { vid: string; quantity: number }[] = [];
  for (const it of items) {
    if (!it.productId) return { ok: false, error: `Line "${it.sku ?? "?"}" isn't linked to a catalogue product.` };
    const product = await prisma.product.findUnique({
      where: { id: it.productId },
      select: { externalId: true, name: true, warehouse: true },
    });
    const pid = (product?.externalId ?? "").split(":")[0];
    if (!pid) return { ok: false, error: `"${product?.name ?? it.sku}" has no CJ product id.` };

    const variants = await cjVariants(pid);
    // Match the exact variant where we know its SKU; otherwise a single-variant
    // product is unambiguous.
    const match = variants.find((v) => it.sku && v.variantSku === it.sku) ?? (variants.length === 1 ? variants[0] : undefined);
    if (!match?.vid) {
      return { ok: false, error: `Couldn't pick a variant for "${product?.name ?? it.sku}" — it has ${variants.length} options.` };
    }
    products.push({ vid: match.vid, quantity: Number(it.qty ?? 1) || 1 });
  }

  const fromCountryCode = (await prisma.product.findUnique({
    where: { id: items[0]!.productId! }, select: { warehouse: true },
  }))?.warehouse || "CN";

  const freight = await cjFreight({
    startCountryCode: fromCountryCode,
    endCountryCode: addr.countryCode,
    zip: addr.postcode,
    products,
  });
  if (!freight.ok || !freight.options?.length) {
    return { ok: false, error: freight.error ?? "CJ returned no shipping options for that address." };
  }
  const cheapest = [...freight.options].sort((a, b) => a.logisticPrice - b.logisticPrice)[0]!;

  const created = await cjCall<{ orderId?: string }>("/shopping/order/createOrderV2", {
    method: "POST",
    body: JSON.stringify({
      orderNumber: `PCRM-${so.order.number}-${so.id.slice(-6)}`,
      shippingCustomerName: so.order.customerName ?? "Customer",
      shippingPhone: so.order.customerPhone ?? undefined,
      email: so.order.customerEmail ?? undefined,
      shippingCountry: COUNTRY_NAMES[addr.countryCode] ?? addr.countryCode,
      shippingCountryCode: addr.countryCode,
      shippingProvince: addr.province,
      shippingCity: addr.city,
      shippingAddress: addr.line1,
      shippingZip: addr.postcode,
      logisticName: cheapest.logisticName,
      fromCountryCode,
      products,
      payType: 3, // create only — paying is a separate, explicit step
      platform: "placidcrm",
    }),
  });
  if (!created.ok) return { ok: false, error: created.error };

  const cjOrderId = created.data?.orderId ? String(created.data.orderId) : undefined;
  await prisma.supplierOrder.update({
    where: { id: so.id },
    data: {
      status: "PLACED",
      supplierRef: cjOrderId ?? null,
      placedAt: new Date(),
      carrier: cheapest.logisticName,
      error: null,
    },
  });

  return { ok: true, cjOrderId, freight: cheapest.logisticPrice, logistic: cheapest.logisticName };
}

// --- Pay -------------------------------------------------------------------

export type CjPayResult = { ok: boolean; error?: string };

/** Pay a created CJ order from the wallet. Irreversible — explicit click only. */
export async function payCjOrder(supplierOrderId: string): Promise<CjPayResult> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: { id: true, supplierRef: true, status: true },
  });
  if (!so?.supplierRef) return { ok: false, error: "This order hasn't been created with CJ yet." };

  const r = await cjCall("/shopping/pay/payBalance", {
    method: "POST",
    body: JSON.stringify({ orderId: so.supplierRef }),
  });
  if (!r.ok) {
    await prisma.supplierOrder.update({ where: { id: so.id }, data: { error: r.error ?? "payment failed" } });
    return { ok: false, error: r.error };
  }

  await prisma.supplierOrder.update({ where: { id: so.id }, data: { error: null } });
  return { ok: true };
}

// --- Tracking --------------------------------------------------------------

export type CjOrderDetail = { orderStatus?: string; trackNumber?: string; logisticName?: string };

/** Pull status + tracking back so the customer can be told where their parcel is. */
export async function refreshCjOrder(supplierOrderId: string): Promise<{ ok: boolean; tracking?: string; status?: string; error?: string }> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: { id: true, supplierRef: true },
  });
  if (!so?.supplierRef) return { ok: false, error: "Not placed with CJ." };

  const r = await cjCall<CjOrderDetail>(`/shopping/order/getOrderDetail?orderId=${encodeURIComponent(so.supplierRef)}`);
  if (!r.ok) return { ok: false, error: r.error };

  const tracking = r.data?.trackNumber || undefined;
  if (tracking) {
    await prisma.supplierOrder.update({
      where: { id: so.id },
      data: { tracking, carrier: r.data?.logisticName ?? undefined, status: "SHIPPED" },
    });
  }
  return { ok: true, tracking, status: r.data?.orderStatus };
}
