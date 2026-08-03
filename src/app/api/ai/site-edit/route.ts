import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

async function claude(prompt: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI isn't configured yet (no Anthropic API key on the server).");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && text.includes("credit")) {
      throw new Error("The Anthropic account is out of credit — top it up and try again.");
    }
    throw new Error(`AI request failed (${res.status}).`);
  }
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((b: { text?: string }) => b?.text ?? "").join("")
    : "";
  if (!text.trim()) throw new Error("AI returned nothing — try rephrasing.");
  return text.trim();
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI response wasn't valid JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const BLOCK_SCHEMA = `Block types and their fields (only these):
- hero: heading, subheading, ctaLabel, ctaHref
- text: heading, body (\\n\\n for paragraphs)
- image: url, alt, caption
- video: heading, embedUrl
- button: label, href, align (left|center|right)
- features: heading, items[{icon (emoji), title, body}]
- pricing: heading, plans[{name, size, price, featuresText (newline separated)}]
- faq: heading, items[{q, a}]
- testimonials: heading, items[{quote, author, detail, rating (1-5)}]
- cta: heading, subheading, ctaLabel, ctaHref
- contact: heading, body, fields (array from: name,email,phone,message), submitLabel, thankYou
- booking: heading, body, calendarId (keep existing value), submitLabel, thankYou
- products: heading, items[{name, price, description, imageUrl, buttonLabel, buttonHref}]
Every block keeps/gets an "id" string and a "type" string.
IMAGES: "url"/"imageUrl" values MUST come from the media library or the attached
uploads listed in the prompt — NEVER invent an image URL or hotlink an external site.`;

type Attachment = { url?: string; filename?: string };

// POST /api/ai/site-edit { locationId, instruction, attachments? }
// Natural-language website editing:
//  - site-builder sites: Claude can rewrite ANY page, create new pages, delete
//    pages, and place images from the location's media library / fresh uploads.
//  - the storage location (external custom site): Claude patches the live
//    content keys via the storage app's admin content API.
export async function POST(req: NextRequest) {
  let body: { locationId?: string; instruction?: string; attachments?: Attachment[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const locationId = String(body.locationId ?? "");
  const instruction = String(body.instruction ?? "").trim().slice(0, 2000);
  const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
    .filter((a) => typeof a?.url === "string" && a.url.startsWith("http"))
    .slice(0, 8)
    .map((a) => ({ url: String(a.url), filename: String(a.filename ?? "upload") }));
  if (!locationId || !instruction) {
    return NextResponse.json({ error: "Missing instruction." }, { status: 422 });
  }
  try {
    await requireLocationAccess(locationId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // ---- External custom site (Placid Storage) -----------------------------
    const storage = await prisma.storageSettings.findUnique({ where: { locationId } });
    const storageUrl = process.env.STORAGE_URL;
    const storageToken = process.env.STORAGE_ADMIN_TOKEN;
    if (storage && storageUrl && storageToken) {
      const currentRes = await fetch(`${storageUrl}/api/admin/content`, {
        headers: { "x-admin-token": storageToken },
        signal: AbortSignal.timeout(10_000),
      });
      if (!currentRes.ok) throw new Error("Couldn't reach the live site's content API.");
      const { content, keys } = (await currentRes.json()) as {
        content: Record<string, string>;
        keys: string[];
      };

      const raw = await claude(
        `You edit the marketing copy of a live storage-business website. ` +
          `These are the ONLY editable keys and their current values:\n` +
          `${JSON.stringify(content, null, 1)}\n\n` +
          `Key notes: "announcement" is a site-wide banner (empty string hides it); ` +
          `hero_heading_pre + hero_heading_gradient form one headline (gradient part is highlighted); ` +
          `facebook_url / instagram_url are full URLs shown as footer links (empty hides them — if the owner asks to add a social link but gives no URL, set nothing and use "summary" to ask them to paste the link). ` +
          `Australian English. Keep the confident, no-nonsense tone.\n\n` +
          `Instruction from the owner: ${instruction}\n\n` +
          `Return ONLY a JSON object with two fields: "patch" (object containing ONLY the keys from ${JSON.stringify(
            keys
          )} that should change, with their full new values) and "summary" (one short sentence saying what you changed). ` +
          `If the instruction asks for something these keys cannot express (new pages, images, layout, pricing tables), return {"patch":{},"summary":"<explain briefly that this change needs the developer>"}.`,
        1500
      );
      const parsed = extractJson(raw) as { patch?: Record<string, string>; summary?: string };
      const patch = parsed.patch ?? {};
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({
          ok: true,
          summary: parsed.summary || "That change is beyond the live-editable copy — it needs a developer deploy.",
        });
      }
      const patchRes = await fetch(`${storageUrl}/api/admin/content`, {
        method: "PATCH",
        headers: { "x-admin-token": storageToken, "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!patchRes.ok) throw new Error("The live site rejected the update.");
      return NextResponse.json({ ok: true, summary: parsed.summary || "Done — live site updated." });
    }

    // ---- Site-builder site -------------------------------------------------
    const site = await prisma.site.findUnique({
      where: { locationId },
      include: { pages: { orderBy: { position: "asc" } } },
    });
    if (!site) return NextResponse.json({ error: "No website configured for this business." }, { status: 404 });

    // The location's image library (uploaded via the media endpoint) + any
    // fresh attachments from the editor — the only image sources the AI may use.
    const base = process.env.APP_URL || "https://placidcrm.com";
    const library = await prisma.mediaAsset.findMany({
      where: { locationId, kind: "image" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, filename: true },
    });
    const images = [
      ...attachments,
      ...library.map((m) => ({ url: `${base}/api/media/f/${m.id}`, filename: m.filename })),
    ];

    const pagesForPrompt = site.pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      isHome: p.isHome,
      blocks: p.blocks,
    }));

    const raw = await claude(
      `You edit a small-business website built from JSON content blocks.\n\n${BLOCK_SCHEMA}\n\n` +
        `Site settings: ${JSON.stringify({
          logoText: site.logoText,
          tagline: site.tagline,
          primaryColor: site.primaryColor,
          theme: (site as { theme?: string }).theme ?? "light",
        })}\n` +
        `(theme "noir" = dark glass look, "light" = clean white look; primaryColor is any hex.)\n\n` +
        `ALL current pages (slug "" = the home page; every page automatically appears in the nav):\n` +
        `${JSON.stringify(pagesForPrompt, null, 1)}\n\n` +
        (images.length
          ? `Available images (use these exact URLs in image blocks / product imageUrl; the owner just uploaded any marked NEW):\n` +
            images
              .map((im, i) => `- ${attachments.includes(im as never) || i < attachments.length ? "NEW " : ""}${im.filename}: ${im.url}`)
              .join("\n") +
            `\n\n`
          : `No images are available — if the instruction needs a picture, use "summary" to ask the owner to attach one (📎 button).\n\n`) +
        `Instruction from the owner: ${instruction}\n\n` +
        `Rules: keep existing block ids where a block survives; keep facts (phone numbers, prices, certifications) unless told to change them; NEVER invent testimonials, reviews, prices, credentials or image URLs; Australian English.\n\n` +
        `Return ONLY a JSON object:\n` +
        `{"pages": [ONLY the pages you changed or created, each as {"slug", "title", "blocks": <full blocks array>, "seoTitle"?, "seoDescription"?} — a new slug creates a new page (lowercase-hyphen slug)],\n` +
        ` "deleteSlugs": [slugs of pages to delete, if any — never "" (home)],\n` +
        ` "siteMeta": {<only logoText/tagline/primaryColor/theme if they should change>},\n` +
        ` "summary": "<one short sentence saying what you changed>"}`,
      8000
    );
    const parsed = extractJson(raw) as {
      pages?: Array<{
        slug?: string;
        title?: string;
        blocks?: unknown;
        seoTitle?: string;
        seoDescription?: string;
      }>;
      deleteSlugs?: string[];
      siteMeta?: Record<string, string>;
      summary?: string;
    };

    const pageOps = (Array.isArray(parsed.pages) ? parsed.pages : []).filter(
      (p) => p && typeof p.slug === "string" && Array.isArray(p.blocks)
    );
    const deleteSlugs = (Array.isArray(parsed.deleteSlugs) ? parsed.deleteSlugs : [])
      .map((s) => String(s))
      .filter((s) => s !== "");
    if (pageOps.length === 0 && deleteSlugs.length === 0 && !parsed.siteMeta) {
      return NextResponse.json({ error: "AI didn't produce a valid change — try rephrasing." }, { status: 422 });
    }

    const meta = parsed.siteMeta ?? {};
    const siteData: Record<string, unknown> = {};
    if (typeof meta.logoText === "string") siteData.logoText = meta.logoText.slice(0, 80);
    if (typeof meta.tagline === "string") siteData.tagline = meta.tagline.slice(0, 160);
    if (typeof meta.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(meta.primaryColor))
      siteData.primaryColor = meta.primaryColor;
    if (meta.theme === "light" || meta.theme === "noir") siteData.theme = meta.theme;

    const maxPos = site.pages.reduce((m, p) => Math.max(m, p.position), 0);
    let created = 0;
    const ops = [];
    if (Object.keys(siteData).length) {
      ops.push(prisma.site.update({ where: { id: site.id }, data: siteData }));
    }
    for (const p of pageOps) {
      const slug = String(p.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
      const blocks = (p.blocks as Record<string, unknown>[]).filter(
        (b) => b && typeof b === "object" && typeof b.type === "string"
      );
      const existing = site.pages.find((x) => x.slug === slug);
      const data: Record<string, unknown> = { blocks };
      if (typeof p.title === "string" && p.title.trim()) data.title = p.title.slice(0, 60);
      if (typeof p.seoTitle === "string") data.seoTitle = p.seoTitle.slice(0, 120);
      if (typeof p.seoDescription === "string") data.seoDescription = p.seoDescription.slice(0, 200);
      if (existing) {
        ops.push(prisma.sitePage.update({ where: { id: existing.id }, data }));
      } else {
        created++;
        ops.push(
          prisma.sitePage.create({
            data: {
              siteId: site.id,
              slug,
              title: (data.title as string) ?? slug.replace(/-/g, " "),
              isHome: false,
              position: maxPos + created,
              blocks: blocks as never,
              seoTitle: (data.seoTitle as string) ?? null,
              seoDescription: (data.seoDescription as string) ?? null,
            },
          })
        );
      }
    }
    for (const slug of deleteSlugs) {
      const existing = site.pages.find((x) => x.slug === slug && !x.isHome);
      if (existing) ops.push(prisma.sitePage.delete({ where: { id: existing.id } }));
    }
    await prisma.$transaction(ops);

    return NextResponse.json({ ok: true, summary: parsed.summary || "Done — site updated." });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 502 }
    );
  }
}
