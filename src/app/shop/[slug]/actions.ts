"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { addToCart, setQty, clearCart, loadCart } from "@/lib/cart";

export async function addToCartAction(slug: string, productId: string, destination: string, qty = 1) {
  addToCart(productId, qty, destination);
  revalidatePath(`/shop/${slug}`);
  return { ok: true };
}

export async function setQtyAction(slug: string, productId: string, qty: number) {
  setQty(productId, qty);
  revalidatePath(`/shop/${slug}/cart`);
  return { ok: true };
}

export type CheckoutResult = { ok: boolean; message: string; url?: string };

/**
 * Send the shopper to Stripe.
 *
 * Everything is re-priced from the catalogue here rather than trusting anything
 * the browser sent — a cart cookie is user-editable, and the amount charged has
 * to come from our own data.
 */
export async function checkoutAction(slug: string, email: string): Promise<CheckoutResult> {
  const location = await prisma.location.findUnique({
    where: { slug },
    select: { id: true, name: true, stripeAccountId: true, stripeChargesEnabled: true },
  });
  if (!location) return { ok: false, message: "Shop not found." };

  const cart = await loadCart(location.id);
  const sellable = cart.lines.filter((l) => l.deliverable && l.unitCents > 0);
  if (!sellable.length) return { ok: false, message: "Nothing in the basket we can send to that address." };

  if (!location.stripeAccountId || !location.stripeChargesEnabled) {
    return {
      ok: false,
      message: "Card payments aren't switched on for this shop yet. Finish Stripe onboarding in Payments and this will work immediately.",
    };
  }

  const { createStorefrontCheckout } = await import("@/lib/storefront-checkout");
  try {
    const url = await createStorefrontCheckout(location.id, slug, sellable, cart.destination, email);
    return { ok: true, message: "Redirecting to payment…", url };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't start checkout." };
  }
}

export async function clearCartAction(slug: string) {
  clearCart();
  redirect(`/shop/${slug}/cart`);
}
