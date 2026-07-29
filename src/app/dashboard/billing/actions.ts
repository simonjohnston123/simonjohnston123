"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { planByKey } from "@/lib/plans";
import { createCheckoutSession, createPortalSession, stripeConfigured } from "@/lib/stripe";

function appUrl(): string {
  return (process.env.APP_URL || "https://placidcrm.com").replace(/\/$/, "");
}

export async function startCheckoutAction(formData: FormData) {
  const user = await requireUser();
  const planKey = String(formData.get("plan") ?? "");
  const plan = planByKey(planKey);

  // Free is just a downgrade, no payment.
  if (plan.priceMonthly === 0) {
    await prisma.agency.update({ where: { id: user.agencyId }, data: { plan: "free" } });
    revalidatePath("/dashboard/billing");
    redirect("/dashboard/billing?checkout=downgraded");
  }

  if (!stripeConfigured()) redirect("/dashboard/billing?checkout=unconfigured");

  const url = await createCheckoutSession({
    agencyId: user.agencyId,
    plan,
    customerEmail: user.email,
    customerId: user.agency?.stripeCustomerId ?? null,
    successUrl: `${appUrl()}/dashboard/billing?checkout=success`,
    cancelUrl: `${appUrl()}/dashboard/billing?checkout=cancel`,
  });
  redirect(url);
}

export async function startPortalAction() {
  const user = await requireUser();
  const customerId = user.agency?.stripeCustomerId;
  if (!customerId || !stripeConfigured()) redirect("/dashboard/billing?checkout=unconfigured");
  const url = await createPortalSession(customerId, `${appUrl()}/dashboard/billing`);
  redirect(url);
}
