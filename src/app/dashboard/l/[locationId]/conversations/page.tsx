import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui";
import { NewConversationButton } from "@/components/new-conversation";
import { EmailSyncButton } from "@/components/email-sync-button";
import { DeleteConversationButton } from "@/components/delete-conversation-button";
import { SelectionProvider, RowCheckbox, SelectAllCheckbox, BulkActionBar } from "@/components/inbox-selection";
import { locationSendStatus } from "@/lib/comms-location";
import { Linkify } from "@/components/linkify";
import { sendMessageAction, deleteConversationAction, toggleStarAction, sendToTrackAction, bulkDeleteConversations } from "./actions";
import { contactName, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const CHANNEL_META: Record<string, { icon: string; label: string }> = {
  EMAIL: { icon: "✉️", label: "Email" },
  SMS: { icon: "💬", label: "SMS" },
  WHATSAPP: { icon: "🟢", label: "WhatsApp" },
  FACEBOOK: { icon: "📘", label: "Facebook" },
  INSTAGRAM: { icon: "📷", label: "Instagram" },
  WEBCHAT: { icon: "💻", label: "Web chat" },
  NOTE: { icon: "📝", label: "Note" },
};
function channelMeta(channel: string) {
  return CHANNEL_META[channel] ?? { icon: "💬", label: channel };
}
function ChannelChip({ channel }: { channel: string }) {
  const m = channelMeta(channel);
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { c?: string; sendfail?: string; filter?: string; q?: string; source?: string };
}) {
  await requireLocationAccess(params.locationId);

  const locationId = params.locationId;
  const base = `/dashboard/l/${locationId}`;
  const activeId = searchParams.c;
  const filter = searchParams.filter === "unread" || searchParams.filter === "starred" ? searchParams.filter : "all";
  const q = (searchParams.q || "").trim();
  const source = searchParams.source; // a source folder label, or "General" for null

  // Build the filtered list query (filter tab + source folder + search).
  const listWhere: Record<string, unknown> = { locationId };
  if (filter === "unread") listWhere.unread = true;
  if (filter === "starred") listWhere.starred = true;
  if (source) listWhere.sourceLabel = source === "General" ? null : source;
  if (q) {
    listWhere.contact = {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [conversations, contacts, unreadCount, starredCount, allCount, emailConn] = await Promise.all([
    prisma.conversation.findMany({
      where: listWhere,
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    prisma.contact.findMany({ where: { locationId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.conversation.count({ where: { locationId, unread: true } }),
    prisma.conversation.count({ where: { locationId, starred: true } }),
    prisma.conversation.count({ where: { locationId } }),
    prisma.connection.findFirst({ where: { locationId, provider: "SMTP", status: "CONNECTED" }, select: { id: true } }),
  ]);

  // Source "folders" — one per distinct sender source, with a count.
  const folderGroups = await prisma.conversation.groupBy({
    by: ["sourceLabel"],
    where: { locationId },
    _count: { _all: true },
    orderBy: { _count: { sourceLabel: "desc" } },
  });
  const folders = folderGroups.map((g) => ({
    key: g.sourceLabel ?? "General",
    label: g.sourceLabel ?? "General",
    count: g._count._all,
  }));

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const hasEmail = Boolean(emailConn);

  const active = activeId
    ? await prisma.conversation.findFirst({
        where: { id: activeId, locationId },
        include: {
          contact: { include: { tags: { include: { tag: true } } } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  // Opening a conversation marks it read.
  if (active?.unread) {
    await prisma.conversation.update({ where: { id: active.id }, data: { unread: false } });
    active.unread = false;
  }

  // Success Tracks this conversation can be pushed into.
  const trackList = active
    ? await prisma.pipeline.findMany({ where: { locationId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } })
    : [];

  const sendStatus = await locationSendStatus(locationId);
  const activeSend =
    active && (active.channel === "EMAIL" || active.channel === "SMS") ? sendStatus[active.channel] : null;
  const sendFail = searchParams.sendfail;

  const withParams = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (q) p.set("q", q);
    if (source) p.set("source", source);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `${base}/conversations${qs ? `?${qs}` : ""}`;
  };
  const tabHref = (f: string) => {
    const p = new URLSearchParams();
    if (f !== "all") p.set("filter", f);
    if (q) p.set("q", q);
    if (source) p.set("source", source);
    if (activeId) p.set("c", activeId);
    const qs = p.toString();
    return `${base}/conversations${qs ? `?${qs}` : ""}`;
  };
  const sourceHref = (s?: string) => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (q) p.set("q", q);
    if (activeId) p.set("c", activeId);
    if (s) p.set("source", s);
    const qs = p.toString();
    return `${base}/conversations${qs ? `?${qs}` : ""}`;
  };

  const avatar = (name: string, size = "h-11 w-11 text-sm") => (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-brand-gradient font-semibold text-white", size)}>
      {initials(name)}
    </span>
  );

  const tabs: { key: string; label: string; count?: number }[] = [
    { key: "all", label: "All", count: allCount },
    { key: "unread", label: "Unread", count: unreadCount },
    { key: "starred", label: "Starred", count: starredCount },
  ];

  if (allCount === 0) {
    return (
      <div>
        <PageHeader title="Inbox" subtitle="Every message in one place" />
        <EmptyState
          title="No conversations yet"
          body="Messages from SMS, email and web chat land here automatically — or start one."
          action={
            <div className="flex items-center gap-2">
              {hasEmail ? <EmailSyncButton locationId={locationId} /> : null}
              <NewConversationButton locationId={locationId} contacts={contactOptions} />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header — hidden on mobile while viewing a thread. */}
      <div className={cn(active ? "hidden lg:block" : "")}>
        <PageHeader
          title="Inbox"
          subtitle="Every message in one place"
          action={
            <div className="flex items-center gap-2">
              {hasEmail ? <EmailSyncButton locationId={locationId} /> : null}
              <NewConversationButton locationId={locationId} contacts={contactOptions} />
            </div>
          }
        />
      </div>

      <div
        className={cn(
          "grid gap-4",
          active ? "lg:grid-cols-[300px_minmax(0,1fr)_290px]" : "lg:grid-cols-[340px_1fr]",
        )}
      >
        {/* Conversation list */}
        <div className={cn("flex flex-col", active ? "hidden lg:flex" : "flex")}>
          <SelectionProvider allIds={conversations.map((c) => c.id)}>
          {/* Filter tabs + search */}
          <div className="mb-2 space-y-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {tabs.map((t) => {
                const activeTab = filter === t.key;
                return (
                  <Link
                    key={t.key}
                    href={tabHref(t.key)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition",
                      activeTab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {t.label}
                    {typeof t.count === "number" && t.count > 0 ? (
                      <span
                        className={cn(
                          "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          t.key === "unread" ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {t.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <form action={`${base}/conversations`} method="get" className="flex items-center gap-1">
              {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
              {source ? <input type="hidden" name="source" value={source} /> : null}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search name or email…"
                className="input h-9 flex-1 text-sm"
              />
              {q ? (
                <Link href={withParams({ q: undefined })} className="btn-secondary h-9 px-2 text-xs">
                  Clear
                </Link>
              ) : null}
            </form>

            {/* Source folders — auto-sorted by who the conversation is from */}
            <div className="flex flex-wrap items-center gap-1.5">
              {folders.length > 0 ? (
                <Link
                  href={sourceHref(undefined)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    !source ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  📥 All
                </Link>
              ) : null}
              {folders.map((f) => (
                <Link
                  key={f.key}
                  href={sourceHref(f.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    source === f.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {f.label} <span className="text-slate-400">{f.count}</span>
                </Link>
              ))}
              <Link
                href={`${base}/conversations/folders`}
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                ⚙ Folders
              </Link>
            </div>
          </div>

          {conversations.length > 0 ? (
            <div className="mb-1.5 flex items-center justify-between px-1">
              <SelectAllCheckbox />
              <span className="text-[11px] text-slate-400">Tick rows to delete in bulk</span>
            </div>
          ) : null}

          <div className="card overflow-hidden p-1.5">
            {conversations.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                {q ? "No conversations match your search." : "Nothing here yet."}
              </p>
            ) : (
              conversations.map((c) => {
                const name = c.contact ? contactName(c.contact) : "Unknown";
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={cn("group flex items-center rounded-xl", isActive && "bg-brand-50")}
                  >
                    <RowCheckbox id={c.id} />
                    <Link
                      href={withParams({ c: c.id })}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50"
                    >
                      <span className="relative">
                        {avatar(name)}
                        {c.unread ? (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm text-slate-800", c.unread ? "font-bold" : "font-semibold")}>
                            {name}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {c.lastMessageAt ? formatDateTime(c.lastMessageAt) : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <ChannelChip channel={c.channel} />
                          <span className={cn("truncate text-xs", c.unread ? "font-medium text-slate-700" : "text-slate-500")}>
                            {c.messages[0]?.body ?? "No messages yet"}
                          </span>
                        </span>
                      </span>
                    </Link>
                    <form action={toggleStarAction} className="pr-1.5">
                      <input type="hidden" name="locationId" value={locationId} />
                      <input type="hidden" name="conversationId" value={c.id} />
                      <input type="hidden" name="starred" value={String(c.starred)} />
                      <button
                        type="submit"
                        aria-label={c.starred ? "Unstar" : "Star"}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-lg text-base hover:bg-slate-100",
                          c.starred ? "text-amber-400" : "text-slate-300",
                        )}
                      >
                        {c.starred ? "★" : "☆"}
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
          <BulkActionBar locationId={locationId} action={bulkDeleteConversations} />
          </SelectionProvider>
        </div>

        {/* Thread */}
        <div className={cn("card flex min-h-[65vh] min-w-0 flex-col overflow-hidden lg:min-h-[560px]", active ? "flex" : "hidden lg:flex")}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <Link href={withParams({ c: undefined })} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back">‹</Link>
                {avatar(active.contact ? contactName(active.contact) : "Unknown")}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{active.contact ? contactName(active.contact) : "Unknown"}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <ChannelChip channel={active.channel} />
                    {active.contact?.email && active.channel === "EMAIL" ? (
                      <span className="truncate text-xs text-slate-400">{active.contact.email}</span>
                    ) : null}
                  </div>
                </div>
                <form action={toggleStarAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="conversationId" value={active.id} />
                  <input type="hidden" name="starred" value={String(active.starred)} />
                  <button
                    type="submit"
                    aria-label={active.starred ? "Unstar" : "Star"}
                    className={cn("grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-slate-100", active.starred ? "text-amber-400" : "text-slate-300")}
                  >
                    {active.starred ? "★" : "☆"}
                  </button>
                </form>
                <form action={deleteConversationAction}>
                  <input type="hidden" name="locationId" value={locationId} />
                  <input type="hidden" name="conversationId" value={active.id} />
                  <DeleteConversationButton />
                </form>
              </div>

              <div className="min-w-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden px-4 py-4">
                {active.messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">No messages yet — say hello 👋</p>
                ) : (
                  active.messages.map((m) => {
                    const out = m.direction === "OUTBOUND";
                    return (
                      <div key={m.id} className={cn("flex min-w-0", out ? "justify-end" : "justify-start")}>
                        <div className={cn("min-w-0 max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", out ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-800")}>
                          <div className="overflow-hidden whitespace-pre-line break-words [overflow-wrap:anywhere]"><Linkify text={m.body} /></div>
                          <div className={cn("mt-1 text-[10px]", out ? "text-white/70" : "text-slate-400")}>{formatDateTime(m.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {sendFail ? (
                <div className="mx-3 mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  ⚠ Last message was saved but <span className="font-medium">not delivered</span>: {sendFail}
                </div>
              ) : null}
              {activeSend && !activeSend.canSend ? (
                <div className="mx-3 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {active.channel === "SMS"
                    ? "📵 No SMS provider connected — texts you send won't be delivered. "
                    : "✉️ No email account connected — messages you send won't be delivered. "}
                  <a href={`${base}/integrations`} className="font-medium underline">
                    Connect it in Integrations
                  </a>
                </div>
              ) : null}
              <form action={sendMessageAction} className="flex items-center gap-2 border-t border-slate-100 p-3">
                <input type="hidden" name="locationId" value={locationId} />
                <input type="hidden" name="conversationId" value={active.id} />
                <input type="hidden" name="direction" value="OUTBOUND" />
                <input name="body" placeholder="Type a message…" className="input flex-1" autoComplete="off" required />
                <button className="btn-primary shrink-0" aria-label="Send">Send</button>
              </form>
            </>
          )}
        </div>

        {/* Contact detail panel — desktop, when a thread is open */}
        {active ? (
          <aside className="hidden lg:block">
            <div className="card p-4">
              {active.contact ? (
                <>
                  <div className="flex flex-col items-center text-center">
                    {avatar(contactName(active.contact), "h-14 w-14 text-base")}
                    <div className="mt-2 font-semibold text-slate-900">{contactName(active.contact)}</div>
                    {active.contact.companyName ? (
                      <div className="text-xs text-slate-500">{active.contact.companyName}</div>
                    ) : null}
                  </div>

                  <dl className="mt-4 space-y-2.5 text-sm">
                    {active.contact.email ? (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Email</dt>
                        <dd className="break-all text-slate-700">
                          <a href={`mailto:${active.contact.email}`} className="text-brand-600 hover:underline">
                            {active.contact.email}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {active.contact.phone ? (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Phone</dt>
                        <dd className="text-slate-700">
                          <a href={`tel:${active.contact.phone}`} className="text-brand-600 hover:underline">
                            {active.contact.phone}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                    {active.contact.source ? (
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-slate-400">Source</dt>
                        <dd className="text-slate-700">{active.contact.source}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">Added</dt>
                      <dd className="text-slate-700">{formatDateTime(active.contact.createdAt)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Tags</div>
                    {active.contact.tags.length === 0 ? (
                      <p className="text-xs text-slate-400">No tags yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {active.contact.tags.map((ct) => (
                          <span
                            key={ct.tagId}
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                            style={{ backgroundColor: ct.tag.color }}
                          >
                            {ct.tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {trackList.length > 0 ? (
                    <form action={sendToTrackAction} className="mt-4 border-t border-slate-100 pt-4">
                      <input type="hidden" name="locationId" value={locationId} />
                      <input type="hidden" name="conversationId" value={active.id} />
                      <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
                        Send to a Success Track
                      </label>
                      <div className="flex gap-1.5">
                        <select name="pipelineId" className="input h-9 flex-1 text-sm">
                          {trackList.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn-primary shrink-0 text-sm">Send</button>
                      </div>
                    </form>
                  ) : (
                    <Link href={`${base}/pipelines`} className="mt-4 block text-center text-xs text-brand-600 hover:underline">
                      Create a Success Track to route deals →
                    </Link>
                  )}

                  <Link href={`${base}/contacts`} className="btn-secondary mt-4 block w-full text-center text-sm">
                    Open in Contacts
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-400">No contact linked to this conversation.</p>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
