import "server-only";
import { prisma } from "@/lib/db";
import { runStageActions } from "@/lib/stage-actions";

// Turns a freshly-synced marketplace order into a Success Track card. The location
// picks which track+stage on the Success Tracks page; if unset we do nothing (orders
// still land on the Orders page). Only NEW orders route — re-syncs never duplicate,
// because the callers only invoke this on the imported (not updated) path.

export type OrderRoute = { pipelineId: string; stageId: string };

/** Read a location's configured order-intake stage once (call before a sync loop). */
export async function getOrderRoute(locationId: string): Promise<OrderRoute | null> {
  const loc = await prisma.location.findUnique({
    where: { id: locationId },
    select: { ordersPipelineId: true, ordersStageId: true },
  });
  if (!loc?.ordersPipelineId || !loc?.ordersStageId) return null;
  return { pipelineId: loc.ordersPipelineId, stageId: loc.ordersStageId };
}

/** Create the opportunity card + fire the stage's automations. Fail-soft: a routing
 *  error must never abort the order import that triggered it. */
export async function routeOrderToTrack(
  locationId: string,
  route: OrderRoute | null,
  order: { contactId: string | null; title: string; value: number },
): Promise<void> {
  if (!route) return;
  try {
    const opp = await prisma.opportunity.create({
      data: {
        locationId,
        pipelineId: route.pipelineId,
        stageId: route.stageId,
        contactId: order.contactId,
        title: order.title,
        value: order.value,
        status: "OPEN",
      },
    });
    await runStageActions(opp.id, route.stageId);
  } catch (e) {
    console.error("[order-routing] failed:", e instanceof Error ? e.message : e);
  }
}
