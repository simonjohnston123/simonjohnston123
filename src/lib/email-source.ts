// Map an inbound sender to a source "folder" label (eBay, Temu, …). Personal
// mailboxes (gmail/outlook/etc.) return null → they live in "General".

const KNOWN: { match: RegExp; label: string }[] = [
  { match: /(^|\.)ebay\./i, label: "eBay" },
  { match: /(^|\.)temu\.com$/i, label: "Temu" },
  { match: /(^|\.)etsy\.com$/i, label: "Etsy" },
  { match: /dropshipzone/i, label: "Dropshipzone" },
  { match: /(^|\.)amazon\./i, label: "Amazon" },
  { match: /(^|\.)shopify\.com$/i, label: "Shopify" },
  { match: /(^|\.)stripe\.com$/i, label: "Stripe" },
  { match: /(^|\.)paypal\./i, label: "PayPal" },
  { match: /(^|\.)tiktok(shop)?\./i, label: "TikTok" },
  { match: /(^|\.)square(up)?\./i, label: "Square" },
  { match: /(^|\.)auspost\.|australiapost/i, label: "Australia Post" },
];

const GENERIC = new Set(["gmail", "outlook", "hotmail", "yahoo", "icloud", "proton", "protonmail", "live", "me", "aol", "bigpond", "mail"]);

export function detectSource(email?: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return null;
  for (const k of KNOWN) if (k.match.test(domain)) return k.label;
  // Fallback: use the second-level domain, unless it's a personal mail provider.
  const parts = domain.split(".").filter(Boolean);
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
  if (!sld || GENERIC.has(sld)) return null;
  return sld.charAt(0).toUpperCase() + sld.slice(1);
}
