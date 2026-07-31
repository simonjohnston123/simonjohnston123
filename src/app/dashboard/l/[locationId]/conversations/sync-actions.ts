"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth";
import { syncLocationEmail } from "@/lib/email-imap";

export type SyncNowResult = { ok: boolean; message: string };

/** On-demand "Sync now" — pull the location's mailbox into the Inbox. */
export async function syncEmailNowAction(locationId: string): Promise<SyncNowResult> {
  await requireLocationAccess(locationId);
  const r = await syncLocationEmail(locationId);
  revalidatePath(`/dashboard/l/${locationId}/conversations`);
  if (!r.ok) {
    return { ok: false, message: r.reason === "no connected mailbox" ? "No mailbox connected — add the Email integration first." : `Sync failed: ${r.reason}` };
  }
  if (r.imported === 0 && r.skipped === 0) return { ok: true, message: "No new email." };
  const bits = [`${r.imported} new`];
  if (r.skipped) bits.push(`${r.skipped} already in inbox`);
  return { ok: true, message: `Synced — ${bits.join(", ")}.` };
}
