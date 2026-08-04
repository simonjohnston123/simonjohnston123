import "server-only";

// ---------------------------------------------------------------------------
// Pre-listing compliance screen.
//
// Built from the policies eBay AU actually enforced against this account:
// 81 takedown notices in 120 days across 15 policies. Bulk-listing an
// unfiltered dropship catalogue keeps tripping automated detection, and
// repeated breaches put the whole channel at risk — so nothing is published
// until it has been screened.
//
// Rules are deliberately keyword-based on title + description. False positives
// are acceptable (a product waits for a human); false negatives are not.
// ---------------------------------------------------------------------------

export type Marketplace = "EBAY_AU" | "EBAY_US" | "EBAY_GB" | "AMAZON_US" | "TEMU" | "SHOPIFY" | "*";

export type Rule = {
  policy: string;
  /** Which marketplaces this applies to. "*" = everywhere. */
  markets: Marketplace[];
  pattern: RegExp;
  reason: string;
};

// `\b` boundaries matter — "gun" must not match "shotgun mic" or "Burgundy".
export const RULES: Rule[] = [
  {
    policy: "Weapons",
    markets: ["*"],
    pattern: /\b(knuckle ?dusters?|brass knuckles|butterfly knife|balisong|flick knife|switchblade|push dagger|telescopic baton|expandable baton|taser|stun gun|cattle prod|slingshot|crossbow|blow ?gun|throwing (?:stars?|knives|knife))\b/i,
    reason: "Restricted weapon — illegal to sell in most AU states.",
  },
  {
    policy: "Firearms and accessories",
    markets: ["*"],
    pattern: /\b(gel ?blaster|airsoft|air rifle|bb gun|pellet gun|silencer|suppressor|gun holster|rifle scope|ammunition|ammo box|bump stock|trigger kit)\b/i,
    reason: "Firearm or firearm accessory.",
  },
  {
    policy: "Tobacco and e-cigarettes",
    markets: ["*"],
    pattern: /\b(vape|vapes|vaping|e-?cigarette|e-?cig|e-?liquid|e-?juice|nicotine|shisha|hookah|bong|water pipe|rolling papers|cigarette case|smoking pipe)\b/i,
    reason: "Vaping/tobacco product — banned outright on eBay AU.",
  },
  {
    policy: "Medical devices and equipment",
    markets: ["*"],
    pattern: /\b(nebuli[sz]er|pulse oximeter|blood pressure monitor|sphygmomanometer|hearing aid|surgical|scalpel|syringe|needles? kit|catheter|defibrillator|stethoscope|contact lens|glucose meter|dental (?:drill|scaler)|otoscope|infrared thermometer)\b/i,
    reason: "Regulated medical device — needs TGA approval to sell in AU.",
  },
  {
    policy: "Emissions control defeat devices",
    markets: ["*"],
    pattern: /\b(o2 sensor (?:spacer|simulator|eliminator)|cat(?:alytic)? ?delete|decat|dpf delete|egr delete|adblue (?:emulator|delete)|def delete|emissions? defeat|lambda (?:spacer|simulator))\b/i,
    reason: "Emissions defeat device — illegal to sell.",
  },
  {
    policy: "Single-use plastic products",
    markets: ["EBAY_AU", "AMAZON_US"],
    pattern: /\b(plastic straws?|disposable (?:cutlery|plates?|bowls?)|polystyrene (?:cups?|containers?|foam)|expanded polystyrene|plastic stem cotton buds?)\b/i,
    reason: "Single-use plastic — banned in most AU states.",
  },
  {
    policy: "Product safety",
    markets: ["*"],
    pattern: /\b(button batter(?:y|ies)|magnetic balls?|buckyballs|water beads?|baby walker|cot bumper|infant sleep positioner|self-?balancing scooter|hoverboard)\b/i,
    reason: "Known AU product-safety ban or mandatory standard.",
  },
  {
    policy: "Hazardous materials",
    markets: ["*"],
    pattern: /\b(pepper spray|mace spray|fireworks?|flammable liquid|butane refill|lighter fluid|mercury|asbestos|loose lithium cells?)\b/i,
    reason: "Hazardous or dangerous goods — cannot be posted.",
  },
  {
    policy: "Police-related items",
    markets: ["*"],
    pattern: /\b(police (?:badge|uniform|id|identification)|handcuffs?|law enforcement badge|security badge replica)\b/i,
    reason: "Police or law-enforcement item.",
  },
  {
    policy: "Counterfeit / intellectual property",
    markets: ["*"],
    // Brand names on cheap dropship goods are what triggers counterfeit
    // detection. "Compatible with X" is legitimate and handled below.
    pattern: /\b(apple|airpods|airtag|samsung|dyson|nike|adidas|gucci|prada|louis vuitton|rolex|ray-?ban|oakley|lego|disney|marvel|pok[eé]mon|supreme|yeezy|north face|stanley cup|bose|jbl|gopro|playstation|xbox|nintendo)\b/i,
    reason: "Brand name in the listing — high counterfeit-detection risk.",
  },
  {
    policy: "Laser pointers",
    markets: ["EBAY_AU"],
    pattern: /\b(laser pointer|burning laser|green laser \d+mw)\b/i,
    reason: "Laser pointer — prohibited weapon in several AU states.",
  },
];

/** "Compatible with Dyson V8" is legitimate; "Dyson V8 Vacuum" is not. */
const COMPATIBILITY = /\b(compatible (?:with|for)|replacement for|suits?|fits|for use with|aftermarket|non-?genuine)\b/i;

export type Violation = { policy: string; reason: string; matched: string };

export type ScreenResult = {
  ok: boolean;
  violations: Violation[];
};

/**
 * Screen a product for a marketplace. Returns every violation, not just the
 * first, so a human sees the whole picture rather than fixing one at a time.
 */
export function screenProduct(
  product: { name?: string | null; description?: string | null; category?: string | null },
  marketplace: Marketplace = "EBAY_AU",
): ScreenResult {
  const title = product.name ?? "";
  const body = (product.description ?? "").replace(/<[^>]+>/g, " ");
  const haystack = `${title} ${product.category ?? ""}`;
  const violations: Violation[] = [];

  for (const rule of RULES) {
    if (!rule.markets.includes("*") && !rule.markets.includes(marketplace)) continue;

    const hit = haystack.match(rule.pattern) ?? body.match(rule.pattern);
    if (!hit) continue;

    // A brand mentioned purely as compatibility info is allowed — that's how
    // legitimate spare parts are described.
    if (rule.policy.startsWith("Counterfeit") && COMPATIBILITY.test(title)) continue;

    violations.push({ policy: rule.policy, reason: rule.reason, matched: hit[0] });
  }

  return { ok: violations.length === 0, violations };
}

/** One-line summary for logs and the desk. */
export function violationSummary(v: Violation[]): string {
  return v.map((x) => `${x.policy} ("${x.matched}")`).join("; ");
}
