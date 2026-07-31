"use server";

import { requireLocationAccess } from "@/lib/auth";
import { createOnboardingSession, refreshAccountStatus, createDirectCheckout } from "@/lib/stripe-connect";

/**
 * Called by the embedded onboarding component to (lazily create and) fetch a
 * fresh Account Session client secret. Never exposes any secret key — only the
 * short-lived session secret Stripe's own embedded UI needs.
 */
export async function startOnboardingAction(
  locationId: string,
): Promise<{ clientSecret: string } | { error: string }> {
  await requireLocationAccess(locationId);
  try {
    const clientSecret = await createOnboardingSession(locationId);
    return { clientSecret };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start payments setup." };
  }
}

/** Re-pull capability flags after the user finishes (or exits) onboarding. */
export async function refreshStatusAction(locationId: string): Promise<void> {
  await requireLocationAccess(locationId);
  try {
    await refreshAccountStatus(locationId);
  } catch {
    // Non-fatal — the page will just show the last-known status.
  }
}

/** Create a shareable payment link for a given dollar amount. */
export async function createPaymentLinkAction(
  locationId: string,
  amountDollars: number,
  description: string,
): Promise<{ url: string; feeCents: number } | { error: string }> {
  await requireLocationAccess(locationId);
  try {
    const amountMinor = Math.round(Number(amountDollars) * 100);
    const { url, feeMinor } = await createDirectCheckout(locationId, {
      amountMinor,
      description: description?.trim() || "Payment",
    });
    return { url, feeCents: feeMinor };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the payment link." };
  }
}
