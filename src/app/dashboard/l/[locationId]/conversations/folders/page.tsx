import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import {
  createInboxFolderAction,
  deleteInboxFolderAction,
  seedSuggestedFoldersAction,
} from "../folder-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox folders" };

export default async function InboxFoldersPage({ params }: { params: { locationId: string } }) {
  await requireLocationAccess(params.locationId);
  const base = `/dashboard/l/${params.locationId}`;

  const folders = await prisma.inboxFolder.findMany({
    where: { locationId: params.locationId },
    orderBy: { position: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Inbox folders"
        subtitle="Auto-sort incoming email into folders by your own rules"
        action={
          <Link href={`${base}/conversations`} className="btn-secondary text-sm">
            ← Back to Inbox
          </Link>
        }
      />

      {/* Create folder */}
      <form action={createInboxFolderAction} className="card mb-6 p-5">
        <input type="hidden" name="locationId" value={params.locationId} />
        <h3 className="mb-3 font-semibold text-slate-900">New folder</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Folder name</label>
            <input name="name" placeholder="e.g. eBay" required className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">When the</label>
            <select name="matchField" className="input">
              <option value="SENDER">sender</option>
              <option value="SUBJECT">subject</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">contains…</label>
            <input name="matchValue" placeholder="e.g. ebay" required className="input w-full" />
          </div>
          <button className="btn-primary">Add folder</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Example: sender contains <span className="font-mono">ebay</span> → all eBay email lands in the eBay folder.
          Applies to new mail and re-files matching existing conversations.
        </p>
      </form>

      {/* Existing folders */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your folders</h3>
        {folders.length === 0 ? (
          <form action={seedSuggestedFoldersAction}>
            <input type="hidden" name="locationId" value={params.locationId} />
            <button className="btn-secondary text-xs">✨ Add common folders</button>
          </form>
        ) : null}
      </div>

      {folders.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No folders yet. Add one above, or tap <span className="font-medium">“Add common folders”</span> to start with
          eBay, Temu, Etsy, Dropshipzone, Stripe &amp; Amazon.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {folders.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: f.color }}>
                📁
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{f.name}</div>
                <div className="text-xs text-slate-500">
                  {f.matchField === "SUBJECT" ? "Subject" : "Sender"} contains “<span className="font-mono">{f.matchValue}</span>”
                </div>
              </div>
              <form action={deleteInboxFolderAction}>
                <input type="hidden" name="locationId" value={params.locationId} />
                <input type="hidden" name="folderId" value={f.id} />
                <button className="text-xs text-slate-400 hover:text-rose-600">Delete</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
