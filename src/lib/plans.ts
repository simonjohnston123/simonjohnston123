// Subscription plans + feature gating for Placid Connect. Client-safe (no secrets).
// Prices are defined here and passed to Stripe Checkout as inline price_data, so
// there's no need to pre-create Products/Prices in the Stripe dashboard.

export type FeatureKey =
  | "automations"
  | "calendar_booking"
  | "forms"
  | "integrations"
  | "orders"
  | "deliveries"
  | "unlimited_subaccounts";

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  automations: "Automations",
  calendar_booking: "Calendar & booking",
  forms: "Website forms",
  integrations: "Integrations (email/SMS/social)",
  orders: "Orders",
  deliveries: "Placid Deliveries",
  unlimited_subaccounts: "Unlimited sub-accounts",
};

export type Plan = {
  key: string;
  name: string;
  priceMonthly: number; // AUD/month; 0 = free
  blurb: string;
  features: FeatureKey[];
  subAccountLimit: number;
};

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    blurb: "Get started — CRM, one business, website builder.",
    features: [],
    subAccountLimit: 1,
  },
  {
    key: "starter",
    name: "Starter",
    priceMonthly: 49,
    blurb: "For a solo business ready to automate.",
    features: ["automations", "calendar_booking", "forms"],
    subAccountLimit: 3,
  },
  {
    key: "pro",
    name: "Pro",
    priceMonthly: 99,
    blurb: "Everything to run and grow, connected.",
    features: ["automations", "calendar_booking", "forms", "integrations", "orders", "unlimited_subaccounts"],
    subAccountLimit: 9999,
  },
  {
    key: "agency",
    name: "Agency",
    priceMonthly: 199,
    blurb: "Run many businesses + Placid Deliveries.",
    features: ["automations", "calendar_booking", "forms", "integrations", "orders", "deliveries", "unlimited_subaccounts"],
    subAccountLimit: 9999,
  },
];

export function planByKey(key: string | null | undefined): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

export function planHasFeature(planKey: string, feature: FeatureKey): boolean {
  return planByKey(planKey).features.includes(feature);
}
