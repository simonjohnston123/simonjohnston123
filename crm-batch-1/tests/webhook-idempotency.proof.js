// Simulate the webhook's two safeguards interacting, exactly as written in
// src/app/api/stripe/webhook/route.ts.
const seen = new Set();          // the StripeEvent table (unique primary key)
let ordersRecorded = 0;

function deliver(eventId, type, handlerThrows) {
  // 1. Claim by INSERT (line ~43). Duplicate -> acknowledge and stop.
  if (seen.has(eventId)) return { status: 200, body: "duplicate" };
  seen.add(eventId);

  // 2. Run the handler.
  try {
    if (handlerThrows) throw new Error("transient DB error mid-handler");
    ordersRecorded++;
    return { status: 200, body: "received" };
  } catch {
    // 3. paidThing -> 500 so Stripe retries (line ~336).
    const paidThing = type === "checkout.session.completed" || type === "invoice.payment_succeeded";
    if (paidThing) return { status: 500, body: "not recorded" };
    return { status: 200, body: "received" };
  }
  // NOTE: nothing removes the row claimed in step 1.
}

console.log("--- CONTROL: handler succeeds first time ---");
seen.clear(); ordersRecorded = 0;
console.log(" delivery 1:", deliver("evt_ok", "checkout.session.completed", false));
console.log(" orders recorded:", ordersRecorded, "(expected 1)");

console.log("\n--- CONTROL: a true replay of a SUCCEEDED event is correctly ignored ---");
console.log(" delivery 2:", deliver("evt_ok", "checkout.session.completed", false));
console.log(" orders recorded:", ordersRecorded, "(expected 1 — dedup working as intended)");

console.log("\n--- DEFECT: handler throws, Stripe retries ---");
seen.clear(); ordersRecorded = 0;
console.log(" delivery 1:", deliver("evt_bad", "checkout.session.completed", true));
console.log("   -> 500, so Stripe will retry. But the row is already claimed.");
console.log(" delivery 2:", deliver("evt_bad", "checkout.session.completed", false));
console.log(" delivery 3:", deliver("evt_bad", "checkout.session.completed", false));
console.log(" orders recorded:", ordersRecorded, "(expected 1, actual 0)");
console.log("\n => Money taken. Order never recorded. Every retry short-circuits");
console.log("    at the dedup, so the 500-retry path can never succeed.");
