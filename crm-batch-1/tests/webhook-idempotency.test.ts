import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { claimEvent, completeEvent, LEASE_MS } from "@/lib/webhook-claim";

// Against the real staging Postgres, per docs/TESTING.md — mocks have no
// unique constraints, and the unique constraint IS the mechanism under test.
// A mocked client would pass every case below while production double-granted.

const ids: string[] = [];
const newId = () => {
  // Unique per run. A fixed id billed on the first run this database ever saw
  // and deduplicated correctly on every run after — which reads as "broken".
  const id = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ids.push(id);
  return id;
};
const ago = (ms: number) => new Date(Date.now() - ms);

afterAll(async () => {
  await prisma.stripeEvent.deleteMany({ where: { id: { in: ids } } });
});

describe("stripe webhook event claiming", () => {
  it("claims an unseen event", async () => {
    expect(await claimEvent(newId(), "checkout.session.completed")).toBe("claimed");
  });

  it("treats a completed event as a duplicate", async () => {
    const id = newId();
    expect(await claimEvent(id, "checkout.session.completed")).toBe("claimed");
    await completeEvent(id);
    expect(await claimEvent(id, "checkout.session.completed")).toBe("duplicate");
  });

  it("recovers a claim whose lease expired — the defect this fixes", async () => {
    const id = newId();
    // A previous attempt claimed it and died without completing.
    await prisma.stripeEvent.create({
      data: { id, type: "checkout.session.completed", startedAt: ago(LEASE_MS + 60_000), completedAt: null },
    });
    expect(await claimEvent(id, "checkout.session.completed")).toBe("recovered");
  });

  it("does NOT steal a claim that is still in flight", async () => {
    const id = newId();
    await prisma.stripeEvent.create({
      data: { id, type: "checkout.session.completed", startedAt: new Date(), completedAt: null },
    });
    expect(await claimEvent(id, "checkout.session.completed")).toBe("in_flight");
  });

  it("lets exactly one of two simultaneous deliveries through", async () => {
    const id = newId();
    const results = await Promise.all([
      claimEvent(id, "checkout.session.completed"),
      claimEvent(id, "checkout.session.completed"),
    ]);
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r === "claimed" || r === "recovered")).toHaveLength(1);
  });

  it("lets exactly one of two recoverers take over a stale claim", async () => {
    const id = newId();
    await prisma.stripeEvent.create({
      data: { id, type: "checkout.session.completed", startedAt: ago(LEASE_MS + 60_000), completedAt: null },
    });
    const results = await Promise.all([
      claimEvent(id, "checkout.session.completed"),
      claimEvent(id, "checkout.session.completed"),
    ]);
    expect(results.filter((r) => r === "recovered")).toHaveLength(1);
  });

  // The control docs/TESTING.md asks for: without it, a claimEvent that
  // returned "in_flight" unconditionally would pass every refusal above.
  it("CONTROL: a fresh id is always processable", async () => {
    const outcomes = await Promise.all(
      [newId(), newId(), newId()].map((id) => claimEvent(id, "checkout.session.completed")),
    );
    expect(outcomes).toEqual(["claimed", "claimed", "claimed"]);
  });
});
