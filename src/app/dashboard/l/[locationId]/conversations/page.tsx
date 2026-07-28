import Link from "next/link";
import { requireLocationAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { NewConversationButton } from "@/components/new-conversation";
import { sendMessageAction } from "./actions";
import { contactName, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle="Unified inbox for this business"
        action={<NewConversationButton locationId={params.locationId} contacts={contactOptions} />}
      />

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Start a conversation with a contact via SMS, email or web chat."
          action={<NewConversationButton locationId={params.locationId} contacts={contactOptions} />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`${base}/conversations?c=${c.id}`}
                className={cn(
                  "block px-4 py-3 hover:bg-slate-50",
                  c.id === activeId ? "bg-brand-50" : ""
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    {c.contact ? contactName(c.contact) : "Unknown"}
                  </span>
                  <Badge color="blue">{c.channel}</Badge>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {c.messages[0]?.body ?? "No messages yet"}
                </div>
              </Link>
            ))}
          </div>

          <div className="card flex min-h-[420px] flex-col">
            {!active ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 px-5 py-3">
                  <div className="font-semibold text-slate-900">
                    {active.contact ? contactName(active.contact) : "Unknown"}
                  </div>
                  <div className="text-xs text-slate-500">{active.channel}</div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {active.messages.length === 0 ? (
                    <p className="text-center text-sm text-slate-400">No messages yet.</p>
                  ) : (
                    active.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            m.direction === "OUTBOUND"
                              ? "bg-brand-600 text-white"
                              : "bg-slate-100 text-slate-800"
                          )}
                        >
                          <div>{m.body}</div>
                          <div className={cn("mt-1 text-[10px]", m.direction === "OUTBOUND" ? "text-brand-100" : "text-slate-400")}>
                            {formatDateTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form action={sendMessageAction} className="flex gap-2 border-t border-slate-100 p-3">
                  <input type="hidden" name="locationId" value={params.locationId} />
                  <input type="hidden" name="conversationId" value={active.id} />
                  <input type="hidden" name="direction" value="OUTBOUND" />
                  <input name="body" placeholder="Type a message…" className="input" autoComplete="off" required />
                  <button className="btn-primary">Send</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
