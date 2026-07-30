import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { NewConversationButton } from "@/components/new-conversation";
import { sendMessageAction } from "./actions";
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

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: { locationId: string };
  searchParams: { c?: string };
}) {
  await requireLocationAccess(params.locationId);

  const [conversations, contacts] = await Promise.all([
    prisma.conversation.findMany({
      where: { locationId: params.locationId },
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    prisma.contact.findMany({ where: { locationId: params.locationId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  const contactOptions = contacts.map((c) => ({ id: c.id, label: contactName(c) }));
  const base = `/dashboard/l/${params.locationId}`;
  const activeId = searchParams.c;

  const active = activeId
    ? await prisma.conversation.findFirst({
        where: { id: activeId, locationId: params.locationId },
        include: { contact: true, messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  if (conversations.length === 0) {
    return (
      <div>
        <PageHeader title="Inbox" subtitle="Every message in one place" />
        <EmptyState
          title="No conversations yet"
          body="Messages from SMS, email and web chat land here automatically — or start one."
          action={<NewConversationButton locationId={params.locationId} contacts={contactOptions} />}
        />
      </div>
    );
  }

  const avatar = (name: string) => (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
      {initials(name)}
    </span>
  );

  return (
    <div>
      {/* Page header — hidden on mobile while viewing a thread (native feel). */}
      <div className={cn(active ? "hidden lg:block" : "")}>
        <PageHeader
          title="Inbox"
          subtitle="Every message in one place"
          action={<NewConversationButton locationId={params.locationId} contacts={contactOptions} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation list — hidden on mobile when a thread is open. */}
        <div className={cn("card overflow-hidden p-1.5", active ? "hidden lg:block" : "block")}>
          {conversations.map((c) => {
            const name = c.contact ? contactName(c.contact) : "Unknown";
            return (
              <Link key={c.id} href={`${base}/conversations?c=${c.id}`} className={cn("list-row", c.id === activeId && "bg-brand-50")}>
                {avatar(name)}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{c.lastMessageAt ? formatDateTime(c.lastMessageAt) : ""}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-slate-500">{c.messages[0]?.body ?? "No messages yet"}</span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Thread — full-screen on mobile when active; empty prompt on desktop. */}
        <div className={cn("card flex min-h-[65vh] flex-col lg:min-h-[520px]", active ? "flex" : "hidden lg:flex")}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
              Select a conversation to read and reply.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <Link href={`${base}/conversations`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back">‹</Link>
                {avatar(active.contact ? contactName(active.contact) : "Unknown")}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{active.contact ? contactName(active.contact) : "Unknown"}</div>
                  <Badge color="blue">{active.channel}</Badge>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
                {active.messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">No messages yet — say hello 👋</p>
                ) : (
                  active.messages.map((m) => {
                    const out = m.direction === "OUTBOUND";
                    return (
                      <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", out ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-800")}>
                          <div className="whitespace-pre-line">{m.body}</div>
                          <div className={cn("mt-1 text-[10px]", out ? "text-white/70" : "text-slate-400")}>{formatDateTime(m.createdAt)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form action={sendMessageAction} className="flex items-center gap-2 border-t border-slate-100 p-3">
                <input type="hidden" name="locationId" value={params.locationId} />
                <input type="hidden" name="conversationId" value={active.id} />
                <input type="hidden" name="direction" value="OUTBOUND" />
                <input name="body" placeholder="Type a message…" className="input flex-1" autoComplete="off" required />
                <button className="btn-primary shrink-0" aria-label="Send">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
