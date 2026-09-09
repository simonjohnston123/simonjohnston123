import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SocialStudio, type NetworkStatus, type QueuePost } from "@/components/social-studio";
import { googleStatus } from "@/lib/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Poster" };

export default async function SocialPage({ params }: { params: { locationId: string } }) {
  const locationId = params.locationId;
  await requireLocationAccess(locationId);

  const [connections, posts, products, renders] = await Promise.all([
    prisma.connection.findMany({ where: { locationId, provider: { in: ["FACEBOOK", "YOUTUBE"] } }, select: { provider: true, status: true, accountLabel: true, meta: true } }),
    prisma.socialPost.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.product.findMany({
      where: { locationId, active: true, imageUrl: { not: null } },
      orderBy: { updatedAt: "desc" }, take: 24,
      select: { id: true, name: true, imageUrl: true },
    }),
    prisma.renderJob.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const reelPriceCents = parseInt(process.env.REEL_RATE_CENTS ?? "", 10) || 1500;

  const fb = connections.find((c) => c.provider === "FACEBOOK" && c.status === "CONNECTED");
  const yt = connections.find((c) => c.provider === "YOUTUBE" && c.status === "CONNECTED");
  const fbPages = ((fb?.meta ?? {}) as { pages?: { id: string; name: string }[] }).pages ?? [];
  // "Ready" means genuinely postable: a connection with actual Pages granted —
  // a CONNECTED row with zero pages (e.g. "No pages granted") is NOT ready.
  const fbReady = !!fb && fbPages.length > 0;
  const hasGoogleApp = !!process.env.GOOGLE_CLIENT_ID;
  // Services granted on the unified Google connection (Business Profile, YouTube…).
  const gStatus = await googleStatus(locationId);
  const googleSvc: string[] = gStatus.connected ? gStatus.services : [];

  const networks: NetworkStatus[] = [
    { key: "facebook", label: "Facebook", brand: "facebook", ready: fbReady, detail: fbReady ? `${fbPages.length} Page${fbPages.length === 1 ? "" : "s"} connected` : fb ? "Connected but no Pages granted — reconnect in Integrations → Facebook" : "Connect in Integrations → Facebook" },
    { key: "instagram", label: "Instagram", brand: "instagram", ready: fbReady, detail: fbReady ? "Posts via your Facebook Page's linked IG Business account" : "Connect Facebook (with Pages) first" },
    { key: "youtube", label: "YouTube", brand: "youtube", ready: !!yt, detail: yt ? (yt.accountLabel ?? "Connected") : hasGoogleApp ? "Connect your channel" : "Needs Google app credentials (admin)", connectHref: !yt && hasGoogleApp ? `/api/integrations/youtube/connect?locationId=${locationId}` : undefined },
    { key: "tiktok", label: "TikTok", brand: "tiktok", ready: false, detail: "Needs our TikTok developer app approved — coming" },
    {
      key: "google_business", label: "Google Business", brand: "google_business",
      ready: googleSvc.includes("business"),
      detail: googleSvc.includes("business") ? "Posts to your Google listing" : "Connect Google and tick Business Profile",
      connectHref: googleSvc.includes("business") ? undefined : `/dashboard/l/${locationId}/google`,
    },
    { key: "snapchat", label: "Snapchat", brand: "snapchat", ready: false, detail: "No organic API — ads only (ads phase)" },
    { key: "spotify", label: "Spotify", brand: "spotify", ready: false, detail: "No posting API — podcasts distribute via RSS, ads via Ad Studio", never: true },
  ];

  const queue: QueuePost[] = posts.map((p) => ({
    id: p.id,
    body: p.body,
    mediaUrls: (p.mediaUrls as string[]) ?? [],
    mediaKind: p.mediaKind,
    networks: (p.networks as string[]) ?? [],
    results: (p.results as Record<string, { ok: boolean; id?: string; error?: string }>) ?? {},
    scheduledAt: p.scheduledAt?.toISOString() ?? null,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title="Social Poster" subtitle="Compose once — post and schedule everywhere" />
      <SocialStudio
        locationId={locationId}
        networks={networks}
        fbPages={fbPages}
        queue={queue}
        productImages={products.map((p) => ({ id: p.id, name: p.name, url: p.imageUrl! }))}
        reelJobs={renders.map((r) => ({ id: r.id, productName: r.productName, presenter: r.presenter, status: r.status, note: r.note, createdAt: r.createdAt.toISOString() }))}
        reelPrice={`$${(reelPriceCents / 100).toFixed(0)}`}
      />
    </div>
  );
}
