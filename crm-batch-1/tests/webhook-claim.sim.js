// Executable model of claimEvent/completeEvent, mirroring webhook-claim.ts
// line for line, so the state machine can be exercised without Postgres.
// The DB-backed equivalents are in webhook-idempotency.test.ts.
const LEASE_MS = 5 * 60_000;

function makeDb() {
  const rows = new Map();
  return {
    create(id, type, startedAt) {                    // unique PK
      if (rows.has(id)) throw new Error("unique violation");
      rows.set(id, { id, type, startedAt, completedAt: null });
    },
    find: (id) => rows.get(id) ?? null,
    updateMany(id, cutoff, startedAt) {              // conditional takeover
      const r = rows.get(id);
      if (!r || r.completedAt || !(r.startedAt <= cutoff)) return { count: 0 };
      r.startedAt = startedAt;
      return { count: 1 };
    },
    complete(id, at) { rows.get(id).completedAt = at; },
  };
}

function claimEvent(db, id, type, now) {
  try { db.create(id, type, now); return "claimed"; } catch {}
  const row = db.find(id);
  if (!row) return "in_flight";
  if (row.completedAt) return "duplicate";
  const cutoff = now - LEASE_MS;
  if (row.startedAt > cutoff) return "in_flight";
  return db.updateMany(id, cutoff, now).count === 1 ? "recovered" : "in_flight";
}

// The route, as it will be after the patch.
function deliver(db, world, { id, type, now, handlerThrows }) {
  const claim = claimEvent(db, id, type, now);
  if (claim === "duplicate") return { http: 200, body: "duplicate", claim };
  if (claim === "in_flight") return { http: 500, body: "in flight", claim };
  try {
    if (handlerThrows) throw new Error("transient failure mid-handler");
    world.ordersRecorded++;
    world.creditsGranted += 100;
    db.complete(id, now);
    return { http: 200, body: "received", claim };
  } catch {
    const paid = type === "checkout.session.completed" || type === "invoice.payment_succeeded";
    return { http: paid ? 500 : 200, body: "not recorded", claim };
  }
}

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log("ok    " + name); pass++; }
  catch (e) { console.log("FAIL  " + name + " :: " + e.message); fail++; } };
const eq = (a, b, w) => { if (a !== b) throw new Error(`${w}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
const T = 1_000_000_000;
const fresh = () => [makeDb(), { ordersRecorded: 0, creditsGranted: 0 }];

t("1. first success records once and completes", () => {
  const [db, w] = fresh();
  const r = deliver(db, w, { id: "evt_1", type: "checkout.session.completed", now: T });
  eq(r.claim, "claimed", "claim"); eq(r.http, 200, "http");
  eq(w.ordersRecorded, 1, "orders");
  if (!db.find("evt_1").completedAt) throw new Error("not marked complete");
});

t("2. failed first attempt, then a successful retry after the lease", () => {
  const [db, w] = fresh();
  const a = deliver(db, w, { id: "evt_2", type: "checkout.session.completed", now: T, handlerThrows: true });
  eq(a.http, 500, "first attempt must ask for a retry");
  eq(w.ordersRecorded, 0, "nothing recorded yet");
  const b = deliver(db, w, { id: "evt_2", type: "checkout.session.completed", now: T + LEASE_MS + 1 });
  eq(b.claim, "recovered", "claim");
  eq(b.http, 200, "http");
  eq(w.ordersRecorded, 1, "the retry must record the order");   // the whole point
});

t("3. true replay after completion is deduplicated", () => {
  const [db, w] = fresh();
  deliver(db, w, { id: "evt_3", type: "checkout.session.completed", now: T });
  const r = deliver(db, w, { id: "evt_3", type: "checkout.session.completed", now: T + 86_400_000 });
  eq(r.claim, "duplicate", "claim"); eq(r.http, 200, "http");
  eq(w.ordersRecorded, 1, "must not record twice");
  eq(w.creditsGranted, 100, "must not grant twice");
});

t("4. no double grant: concurrent delivery of the same event", () => {
  const [db, w] = fresh();
  const a = deliver(db, w, { id: "evt_4", type: "checkout.session.completed", now: T });
  const b = deliver(db, w, { id: "evt_4", type: "checkout.session.completed", now: T + 50 });
  eq(a.claim, "claimed", "first");
  eq(b.claim, "duplicate", "second");
  eq(w.creditsGranted, 100, "credits granted exactly once");
});

t("5. a live in-flight attempt is NOT stolen mid-run", () => {
  const [db, w] = fresh();
  db.create("evt_5", "checkout.session.completed", T);          // attempt 1 running
  const r = deliver(db, w, { id: "evt_5", type: "checkout.session.completed", now: T + 1000 });
  eq(r.claim, "in_flight", "claim");
  eq(r.http, 500, "ask Stripe to come back rather than run in parallel");
  eq(w.ordersRecorded, 0, "must not process alongside the live attempt");
});

t("6. two recoverers race for one stale claim; exactly one wins", () => {
  const [db, w] = fresh();
  db.create("evt_6", "checkout.session.completed", T);          // attempt 1 died
  const now = T + LEASE_MS + 1;
  const a = claimEvent(db, "evt_6", "checkout.session.completed", now);
  const b = claimEvent(db, "evt_6", "checkout.session.completed", now);
  eq([a, b].filter((x) => x === "recovered").length, 1, "exactly one recoverer");
  eq([a, b].filter((x) => x === "in_flight").length, 1, "the loser backs off");
});

t("CONTROL: the OLD logic fails case 2 — proving these tests measure something", () => {
  const seen = new Set(); let orders = 0;
  const old = (id, throws) => {
    if (seen.has(id)) return 200;
    seen.add(id);
    try { if (throws) throw new Error("x"); orders++; return 200; } catch { return 500; }
  };
  eq(old("evt_x", true), 500, "old first attempt");
  eq(old("evt_x", false), 200, "old retry is swallowed");
  eq(orders, 0, "old code never records the order — this is the defect");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
