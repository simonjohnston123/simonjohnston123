// Clean, safe channel classifier for the live shopping experience. Supplier
// product_type data is messy (a mouse trap typed under "Baby"), so we classify
// each product by keywords in its name + category rather than trusting the raw
// department. Ordered most-specific → most-general; first match wins.

export type LiveChannel = { slug: string; label: string; icon: string };

// Products matching this are DROPPED from the family-facing storefront entirely.
export const EXCLUDE_RE =
  /\b(adult(\s+(toy|product|store|shop|novelty))?|sex|sexual|vibrator|dildo|butt\s?plug|anal|masturbat\w*|lingerie|bondage|fetish|erotic|lubricant|condom|penis|vagina|nipple\s+clamp|orgasm|g-?spot|strap-?on)\b/i;

type Rule = LiveChannel & { re: RegExp };

const RULES: Rule[] = [
  { slug: "baby-kids", label: "Baby & Kids", icon: "🧸", re: /\b(baby|babies|infant|toddler|newborn|nursery|pram|stroller|cot|crib|bassinet|nappy|nappies|diaper|teether|pacifier|dummy|onesie|maternity|breast\s?pump|high\s?chair|playpen)\b/i },
  { slug: "toys-games", label: "Toys & Games", icon: "🎮", re: /\b(toy|toys|lego|doll|jigsaw|puzzle|board\s?game|figurine|playset|plush|teddy|rc\s?car|remote\s?control\s?car|trampoline|scooter\s?kids|play\s?tent)\b/i },
  { slug: "pet-supplies", label: "Pet Supplies", icon: "🐾", re: /\b(pet|dog|puppy|cat|kitten|aquarium|fish\s?tank|bird\s?cage|rabbit|hamster|guinea\s?pig|kennel|leash|harness|litter|chew\s?toy|coop|hutch|hen\s?house|chicken|reptile)\b/i },
  { slug: "kitchen", label: "Kitchen & Dining", icon: "🍳", re: /\b(kitchen|cookware|cook\s?set|frypan|fry\s?pan|frying|air\s?fryer|saucepan|stockpot|knife\s?set|cutlery|utensil|blender|mixer|toaster|kettle|coffee|espresso|dinnerware|dinner\s?set|plate\s?set|bowl\s?set|glassware|bakeware|food\s?storage|cutting\s?board|thermos)\b/i },
  { slug: "appliances", label: "Appliances", icon: "🔌", re: /\b(appliance|vacuum|washing\s?machine|clothes\s?dryer|fridge|refrigerator|freezer|dishwasher|microwave|space\s?heater|air\s?con|pedestal\s?fan|tower\s?fan|humidifier|air\s?purifier|dehumidifier|garment\s?steamer|steam\s?iron)\b/i },
  { slug: "electronics", label: "Electronics", icon: "📱", re: /\b(electronic|smart\s?phone|mobile\s?phone|tablet|laptop|desktop\s?pc|monitor|headphone|earbud|earphone|ear\s?pods?|bluetooth\s?speaker|soundbar|charger|usb\s?cable|dash\s?cam|security\s?camera|drone|smart\s?watch|smartwatch|game\s?console|router|projector|power\s?bank)\b/i },
  { slug: "tools", label: "Tools & DIY", icon: "🔧", re: /\b(power\s?tool|cordless\s?drill|impact\s?driver|angle\s?grinder|circular\s?saw|jigsaw\s?tool|hammer|wrench|spanner|screwdriver|socket\s?set|tool\s?kit|tool\s?box|workbench|welding|ladder|generator|air\s?compressor|fastener|mouse\s?trap|mousetrap|rat\s?trap|rodent|pest\s?control|insect\s?killer|bug\s?zapper)\b/i },
  { slug: "garden", label: "Garden & Outdoor", icon: "🌿", re: /\b(garden|outdoor|patio|gazebo|bbq|barbecue|lawn\s?mower|planter|greenhouse|garden\s?shed|hose\s?reel|solar\s?light|camping|swag|tent|hiking|fishing|esky|cooler\s?box|pool|spa)\b/i },
  { slug: "furniture", label: "Furniture", icon: "🛋️", re: /\b(furniture|sofa|couch|armchair|recliner|dining\s?table|coffee\s?table|bedside|desk|office\s?chair|bed\s?frame|mattress|wardrobe|chest\s?of\s?drawers|bookshelf|bookcase|cabinet|bar\s?stool|ottoman|tv\s?unit)\b/i },
  { slug: "beauty", label: "Health & Beauty", icon: "💄", re: /\b(beauty|cosmetic|makeup|make\s?up|skincare|skin\s?care|hair\s?dryer|hair\s?straightener|nail|fragrance|perfume|electric\s?shaver|grooming|massage\s?gun|wellness|supplement|vitamin|first\s?aid|dental|toothbrush|epilator)\b/i },
  { slug: "fashion", label: "Fashion & Accessories", icon: "👕", re: /\b(clothing|apparel|shoe|shoes|footwear|sneaker|boots?|jacket|hoodie|dress|t-?shirt|shirt|pants|jeans|hat|cap\b|handbag|backpack|wallet|wrist\s?watch|jewell?ery|necklace|earrings?|bracelet|sunglass|scarf|belt|socks)\b/i },
  { slug: "sports", label: "Sports & Fitness", icon: "⚽", re: /\b(sport|fitness|gym\b|exercise|workout|dumbbell|kettlebell|weight\s?bench|yoga\s?mat|treadmill|exercise\s?bike|bicycle|cycling|swim|surf|soccer|basketball|boxing|golf)\b/i },
  { slug: "auto", label: "Auto & Accessories", icon: "🚗", re: /\b(car\s|automotive|vehicle|tyre|tire\b|motorbike|motorcycle|seat\s?cover|floor\s?mat\s?car|number\s?plate|caravan|trailer|jump\s?starter|car\s?cover)\b/i },
  { slug: "office", label: "Office & Stationery", icon: "🖊️", re: /\b(office\s|stationery|printer|shredder|laminator|whiteboard|notebook|filing|binder|label\s?maker)\b/i },
  { slug: "home", label: "Home & Living", icon: "🏠", re: /\b(home|decor|homeware|bedding|bed\s?sheet|quilt|doona|duvet|pillow|cushion|curtain|blind|rug|door\s?mat|towel|bathroom|storage\s?box|organiser|cleaning|laundry|lighting|table\s?lamp|floor\s?lamp|mirror|wall\s?clock|vase|candle)\b/i },
];

export const CHANNELS: LiveChannel[] = RULES.map(({ slug, label, icon }) => ({ slug, label, icon }));
const OTHER: LiveChannel = { slug: "everything-else", label: "Everything Else", icon: "🛍️" };

/** Classify a product into one clean channel. Returns null if it should be excluded. */
export function classify(name: string | null, category: string | null): LiveChannel | null {
  const text = `${name ?? ""} ${category ?? ""}`;
  if (EXCLUDE_RE.test(text)) return null;
  for (const r of RULES) if (r.re.test(text)) return { slug: r.slug, label: r.label, icon: r.icon };
  return OTHER;
}
