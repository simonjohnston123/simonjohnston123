// Marketing/sales channels a product can be listed to, and which countries each
// serves. The geo-gate: a product may only be marketed to a channel that serves
// a country the product can ship to (its shipCountries). "worldwide" channels
// skip the gate. Actual posting to each channel wires in as its app is approved.

export type Channel = {
  key: string;
  label: string;
  icon: string;
  worldwide?: boolean;
  countries?: string[]; // ISO codes this channel markets to
  live?: boolean; // true once real posting is wired; false = tag-only (queued)
};

export const CHANNELS: Channel[] = [
  { key: "placid_connect", label: "Placid Connect", icon: "🟣", countries: ["AU"], live: false },
  { key: "facebook", label: "Facebook", icon: "📘", worldwide: true, live: false },
  { key: "tiktok", label: "TikTok Shop", icon: "🎵", countries: ["AU", "US", "GB", "NZ", "CA"], live: false },
  { key: "ebay", label: "eBay", icon: "🏷️", countries: ["AU", "US", "GB", "CA", "NZ"], live: false },
  { key: "shopify", label: "Shopify", icon: "🛍️", worldwide: true, live: true },
];

export const CHANNEL_BY_KEY: Record<string, Channel> = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

/** Can this channel market a product that ships to `shipCountries`? */
export function channelAllowsShipCountries(channel: Channel, shipCountries: string[]): boolean {
  if (channel.worldwide) return true;
  if (!channel.countries) return false;
  return shipCountries.some((c) => channel.countries!.includes(c));
}
