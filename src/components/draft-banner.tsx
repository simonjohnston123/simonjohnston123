import Link from "next/link";
import { publishSiteAction } from "@/app/dashboard/l/[locationId]/website/actions";

/**
 * Shown at the top of a site when the viewer is its owner previewing an
 * unpublished draft. Public visitors never see this (they get a 404 for drafts).
 */
export function DraftBanner({ locationId }: { locationId: string }) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>🔒 Draft preview — only you can see this. It won&rsquo;t be public until you publish.</span>
      <div className="flex items-center gap-2">
        <form action={publishSiteAction}>
          <input type="hidden" name="locationId" value={locationId} />
          <button className="rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-900">Publish now</button>
        </form>
        <Link href={`/dashboard/l/${locationId}/website`} className="rounded-md bg-white/70 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-white">
          Edit
        </Link>
      </div>
    </div>
  );
}
