import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Shopping cart.
//
// Kept in a cookie rather than the database: a shopper has no account, and
// making them create one before they can hold an item is the oldest way to lose
// a sale. The cookie stores ids and quantities only — every price, stock level
// and delivery fact is re-read from the catalogue when the cart is rendered, so
// a stale cookie can never sell at yesterday's price.
// ---------------------------------------------------------------------------

const COOKIE = "pc_cart";
const MAX_LINES = 40;

export type CartCookieLine = { id: string; qty: number };
export type Cart = { lines: CartCookieLine[]; destination: string | null };

function read(): Cart {
  try {
    const raw = cookies().get(COOKIE)?.value;
    if (!raw) return { lines: [], destination: null };
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Cart>;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .filter((l) => typeof l?.id === "string" && Number.isFinite(l?.qty))
          .map((l) => ({ id: l.id, qty: Math.min(Math.max(1, Math.round(l.qty)), 99) }))
          .slice(0, MAX_LINES)
      : [];
    return { lines, destination: typeof parsed.destination === "string" ? parsed.destination : null };
  } catch {
    return { lines: [], destination: null };
  }
}

function write(cart: Cart) {
  cookies().set(COOKIE, encodeURIComponent(JSON.stringify(cart)), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function getCartCookie(): Cart {
  return read();
}

export function addToCart(productId: string, qty = 1, destination?: string) {
  const cart = read();
  const line = cart.lines.find((l) => l.id === productId);
  if (line) line.qty = Math.min(99, line.qty + qty);
  else cart.lines.push({ id: productId, qty: Math.max(1, qty) });
  if (destination) cart.destination = destination.toUpperCase();
  write(cart);
}

export function setQty(productId: string, qty: number) {
  const cart = read();
  if (qty <= 0) cart.lines = cart.lines.filter((l) => l.id !== productId);
  else {
    const line = cart.lines.find((l) => l.id === productId);
    if (line) line.qty = Math.min(99, Math.round(qty));
  }
  write(cart);
}

export function clearCart() {
  write({ lines: [], destination: read().destination });
}

export type CartLine = {
  id: string;
  name: string;
  image: string | null;
  unitCents: number;
  qty: number;
  lineCents: number;
  freeDelivery: boolean;
  shipsFrom: string | null;
  /** False when the destination changed after it was added. */
  deliverable: boolean;
};

export type CartView = {
  lines: CartLine[];
  destination: string | null;
  subtotalCents: number;
  /** Undeliverable lines are surfaced, never silently dropped. */
  hasUndeliverable: boolean;
};

/**
 * Turn the cookie into a priced cart, re-reading everything from the catalogue.
 *
 * A shopper can change destination after filling a basket, so deliverability is
 * re-checked per line and reported rather than quietly removed — being told
 * "we can't send this one to Spain" is far better than an item vanishing.
 */
export async function loadCart(locationId: string, destination?: string | null): Promise<CartView> {
  const cart = read();
  const to = (destination ?? cart.destination ?? "").toUpperCase();
  if (!cart.lines.length) {
    return { lines: [], destination: to || null, subtotalCents: 0, hasUndeliverable: false };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: cart.lines.map((l) => l.id) }, locationId },
    select: {
      id: true, name: true, imageUrl: true, priceCents: true, price: true,
      freightCents: true, warehouse: true, shipCountries: true,
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: CartLine[] = [];
  for (const l of cart.lines) {
    const p = byId.get(l.id);
    if (!p) continue; // product withdrawn since it was added
    const unit = p.priceCents ?? (p.price != null ? Math.round(p.price * 100) : 0);
    const ships = Array.isArray(p.shipCountries) ? (p.shipCountries as string[]) : [];
    lines.push({
      id: p.id,
      name: p.name,
      image: p.imageUrl,
      unitCents: unit,
      qty: l.qty,
      lineCents: unit * l.qty,
      freeDelivery: p.freightCents === 0,
      shipsFrom: p.warehouse,
      deliverable: to ? ships.includes(to) : true,
    });
  }

  return {
    lines,
    destination: to || null,
    subtotalCents: lines.filter((l) => l.deliverable).reduce((s, l) => s + l.lineCents, 0),
    hasUndeliverable: lines.some((l) => !l.deliverable),
  };
}

export function cartCount(): number {
  return read().lines.reduce((s, l) => s + l.qty, 0);
}
