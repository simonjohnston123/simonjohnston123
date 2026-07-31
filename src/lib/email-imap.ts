import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { detectSource } from "@/lib/email-source";
import type { ConnectionProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Email RECEIVE — pull a location's connected mailbox into its Inbox.
//
// Multi-tenant: every location that has connected email (the "Email (SMTP)"
// integration today; Gmail/Outlook later) syncs using ITS OWN stored creds.
// IMAP settings are derived from the same encrypted record the send side uses:
// host defaults to the SMTP host, port 993, SSL, same username/password.
//
// Idempotent + resumable: we track uidValidity + the last-seen UID per mailbox
// in Connection.meta and dedupe every message by its RFC822 Message-ID, so
// re-running never double-imports.
// ---------------------------------------------------------------------------

// Providers whose stored creds we can use for IMAP receive.
const EMAIL_PROVIDERS = ["SMTP"] as const;

const MAX_FIRST_IMPORT = 200; // cap the very first sync of a large mailbox
const MAX_BODY = 20000;
// Folders to pull in. Junk is included so the spam filter can't silently hide
// real business email — dedup by Message-ID keeps it from double-importing.
const SYNC_FOLDERS = ["INBOX", "Junk"];

export type ImapCreds = {
  host: string;
  port: number;
  user: string;
  pass: string;
  provider: string;
  connectionId: string;
  meta: Record<string, unknown>;
};

type FolderCursor = { uidValidity?: string; uidNext?: number; lastUid?: number };
type ImapState = {
  folders?: Record<string, FolderCursor>;
  // legacy flat INBOX cursor (pre multi-folder) — migrated on next sync
  uidValidity?: string;
  lastUid?: number;
  uidNext?: number;
  lastSyncedAt?: string;
  lastError?: string | null;
};

export type SyncResult = {
  ok: boolean;
  reason?: string;
  fetched: number;
  imported: number;
  skipped: number;
  lastUid: number;
};

/** Load + decrypt a location's email creds and derive IMAP settings. */
export async function getEmailImapCreds(locationId: string): Promise<ImapCreds | null> {
  const conn = await prisma.connection.findFirst({
    where: { locationId, provider: { in: EMAIL_PROVIDERS as unknown as ConnectionProvider[] }, status: "CONNECTED" },
  });
  if (!conn?.secretCipher) return null;
  let creds: Record<string, string>;
  try {
    creds = decryptJson<Record<string, string>>(conn.secretCipher);
  } catch {
    return null;
  }
  const host = (creds.imapHost || creds.host || "").trim();
  const user = (creds.username || creds.user || "").trim();
  const pass = creds.password || creds.pass || "";
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(creds.imapPort) || 993,
    user,
    pass,
    provider: conn.provider,
    connectionId: conn.id,
    meta: (conn.meta as Record<string, unknown>) || {},
  };
}

type FolderRule = { name: string; matchField: string; matchValue: string };
/** First user-defined folder whose rule matches the sender/subject, else null. */
function matchFolder(folders: FolderRule[], sender: string, subject: string): string | null {
  for (const f of folders) {
    const v = (f.matchValue || "").toLowerCase().trim();
    if (!v) continue;
    const hay = (f.matchField === "SUBJECT" ? subject : sender).toLowerCase();
    if (hay.includes(v)) return f.name;
  }
  return null;
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAddress(a?: AddressObject | AddressObject[]): { address: string; name: string } {
  const obj = Array.isArray(a) ? a[0] : a;
  const v = obj?.value?.[0];
  return { address: (v?.address || "").toLowerCase().trim(), name: (v?.name || "").trim() };
}

function normalizeMessageId(id?: string | null): string | null {
  if (!id) return null;
  const m = id.match(/<([^>]+)>/);
  return (m ? m[1] : id).trim() || null;
}

function refIds(parsed: ParsedMail): string[] {
  const out: string[] = [];
  const push = (v?: string | string[]) => {
    if (!v) return;
    for (const s of Array.isArray(v) ? v : [v]) {
      const n = normalizeMessageId(s);
      if (n) out.push(n);
    }
  };
  push(parsed.inReplyTo);
  push(parsed.references as string | string[] | undefined);
  return out;
}

/**
 * Import a single parsed message into the location's Inbox. Returns "imported"
 * or "skipped" (duplicate). Threads by References/In-Reply-To, then by sender.
 */
async function importMessage(
  locationId: string,
  parsed: ParsedMail,
  internalDate: Date | undefined,
  customFolders: FolderRule[] = [],
): Promise<"imported" | "skipped"> {
  const msgId = normalizeMessageId(parsed.messageId);

  // Dedup by Message-ID within this location.
  if (msgId) {
    const existing = await prisma.message.findFirst({
      where: { messageId: msgId, conversation: { locationId } },
      select: { id: true },
    });
    if (existing) return "skipped";
  }

  const from = firstAddress(parsed.from);
  if (!from.address) return "skipped";
  const subject = (parsed.subject || "").trim();
  const body =
    (parsed.text && parsed.text.trim()) || stripHtml(parsed.html || parsed.textAsHtml || "") || "(no content)";
  const receivedAt = parsed.date || internalDate || new Date();

  // Find or create the sender as a Contact.
  let contact = await prisma.contact.findFirst({ where: { locationId, email: from.address } });
  if (!contact) {
    const parts = from.name.split(" ").filter(Boolean);
    contact = await prisma.contact.create({
      data: {
        locationId,
        email: from.address,
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(" ") || null,
        source: "Email",
      },
    });
  }

  // Thread: match an existing message referenced by this one, else the latest
  // email thread for this contact, else open a new conversation.
  let conversationId: string | null = null;
  const refs = refIds(parsed);
  if (refs.length) {
    const ref = await prisma.message.findFirst({
      where: { messageId: { in: refs }, conversation: { locationId } },
      select: { conversationId: true },
      orderBy: { createdAt: "desc" },
    });
    if (ref) conversationId = ref.conversationId;
  }
  if (!conversationId) {
    const convo = await prisma.conversation.findFirst({
      where: { locationId, contactId: contact.id, channel: "EMAIL" },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    });
    if (convo) conversationId = convo.id;
  }
  if (!conversationId) {
    const created = await prisma.conversation.create({
      data: {
        locationId,
        contactId: contact.id,
        channel: "EMAIL",
        subject: subject || null,
        // User-defined folder rules win; fall back to the built-in source detection.
        sourceLabel: matchFolder(customFolders, from.address, subject) || detectSource(from.address),
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  await prisma.message.create({
    data: {
      conversationId,
      direction: "INBOUND",
      channel: "EMAIL",
      body: subject ? `Subject: ${subject}\n\n${body}`.slice(0, MAX_BODY) : body.slice(0, MAX_BODY),
      messageId: msgId,
      receivedAt,
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: receivedAt, unread: true },
  });
  return "imported";
}

/** Persist sync state (uid cursor / errors) onto the connection's meta blob. */
async function saveState(connectionId: string, meta: Record<string, unknown>, imap: ImapState, status?: "CONNECTED" | "ERROR") {
  await prisma.connection.update({
    where: { id: connectionId },
    data: { meta: { ...meta, imap }, ...(status ? { status } : {}) },
  });
}

/**
 * Sync one location's mailbox. Connects over IMAP, imports new INBOX messages,
 * dedupes by Message-ID, and advances the per-mailbox UID cursor.
 */
export async function syncLocationEmail(locationId: string): Promise<SyncResult> {
  const creds = await getEmailImapCreds(locationId);
  if (!creds) return { ok: false, reason: "no connected mailbox", fetched: 0, imported: 0, skipped: 0, lastUid: 0 };

  const prevState = (creds.meta.imap as ImapState) || {};
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    // Self-hosted mail servers often use their own hostname on the cert; the
    // mailbox is authenticated by login, so don't hard-fail on cert name.
    tls: { rejectUnauthorized: false },
  });

  let fetched = 0;
  let imported = 0;
  let skipped = 0;

  // Per-folder UID cursors, migrating any legacy flat INBOX cursor.
  const folders: Record<string, FolderCursor> = { ...(prevState.folders || {}) };
  if (!folders.INBOX && (prevState.lastUid || prevState.uidValidity)) {
    folders.INBOX = { uidValidity: prevState.uidValidity, uidNext: prevState.uidNext, lastUid: prevState.lastUid };
  }

  try {
    await client.connect();
  } catch (e) {
    await saveState(creds.connectionId, creds.meta, { ...prevState, lastError: `connect: ${errMsg(e)}` }, "ERROR");
    return { ok: false, reason: `connect failed: ${errMsg(e)}`, fetched, imported, skipped, lastUid: folders.INBOX?.lastUid || 0 };
  }

  // The business's own folder rules (applied to new conversations).
  const customFolders = await prisma.inboxFolder.findMany({
    where: { locationId },
    orderBy: { position: "asc" },
    select: { name: true, matchField: true, matchValue: true },
  });

  try {
    for (const folderName of SYNC_FOLDERS) {
      let lock;
      try {
        lock = await client.getMailboxLock(folderName);
      } catch {
        continue; // folder doesn't exist on this server — skip it
      }
      try {
        const mailbox = client.mailbox;
        const uidValidity = mailbox && typeof mailbox !== "boolean" ? String(mailbox.uidValidity) : undefined;
        const uidNext = mailbox && typeof mailbox !== "boolean" ? Number(mailbox.uidNext) : undefined;

        const cursor = folders[folderName] || {};
        let lastUid = cursor.lastUid || 0;
        // uidValidity changed → the server renumbered; reset this folder's cursor.
        if (cursor.uidValidity && uidValidity && cursor.uidValidity !== uidValidity) lastUid = 0;

        let startUid = lastUid > 0 ? lastUid + 1 : 1;
        if (lastUid === 0 && uidNext && uidNext - 1 > MAX_FIRST_IMPORT) startUid = uidNext - MAX_FIRST_IMPORT;

        const range = `${startUid}:*`;
        for await (const msg of client.fetch(range, { uid: true, source: true, internalDate: true }, { uid: true })) {
          if (msg.uid < startUid) continue; // `N:*` always yields the highest UID — guard
          fetched++;
          if (msg.uid > lastUid) lastUid = msg.uid;
          try {
            const parsed = await simpleParser(msg.source as Buffer);
            const internal = msg.internalDate ? new Date(msg.internalDate) : undefined;
            const outcome = await importMessage(locationId, parsed, internal, customFolders);
            if (outcome === "imported") imported++;
            else skipped++;
          } catch (e) {
            skipped++;
            console.error(`[email-imap] parse/import failed ${folderName} uid=${msg.uid}: ${errMsg(e)}`);
          }
        }
        folders[folderName] = { uidValidity, uidNext, lastUid };
      } finally {
        lock.release();
      }
    }

    await saveState(
      creds.connectionId,
      creds.meta,
      { folders, lastSyncedAt: new Date().toISOString(), lastError: null },
      "CONNECTED",
    );
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }

  const lastUid = folders.INBOX?.lastUid || 0;

  return { ok: true, fetched, imported, skipped, lastUid };
}

/** Sync every location that has a connected mailbox (used by the cron route). */
export async function syncAllEmail(): Promise<{ locationId: string; result: SyncResult }[]> {
  const conns = await prisma.connection.findMany({
    where: { provider: { in: EMAIL_PROVIDERS as unknown as ConnectionProvider[] }, status: { in: ["CONNECTED", "ERROR"] } },
    select: { locationId: true },
    distinct: ["locationId"],
  });
  const out: { locationId: string; result: SyncResult }[] = [];
  for (const c of conns) {
    try {
      out.push({ locationId: c.locationId, result: await syncLocationEmail(c.locationId) });
    } catch (e) {
      out.push({
        locationId: c.locationId,
        result: { ok: false, reason: errMsg(e), fetched: 0, imported: 0, skipped: 0, lastUid: 0 },
      });
    }
  }
  return out;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
