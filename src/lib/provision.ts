import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

/**
 * Ensure a location has a unique slug within the platform.
 */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "business";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.location.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

export interface NewBusinessInput {
  agencyId: string;
  ownerUserId: string;
  name: string;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Create a new sub-account (business) and provision sensible defaults so it is
 * immediately usable: a sales pipeline, a booking calendar and a draft website.
 */
export async function createBusiness(input: NewBusinessInput) {
  const slug = await uniqueSlug(input.name);

  const location = await prisma.location.create({
    data: {
      agencyId: input.agencyId,
      name: input.name,
      slug,
      industry: input.industry || null,
      email: input.email || null,
      phone: input.phone || null,
      memberships: {
        create: { userId: input.ownerUserId, role: "ADMIN" },
      },
      pipelines: {
        create: {
          name: "Sales Pipeline",
          stages: {
            create: [
              { name: "New Lead", position: 0 },
              { name: "Contacted", position: 1 },
              { name: "Quote Sent", position: 2 },
              { name: "Won", position: 3 },
            ],
          },
        },
      },
      calendars: {
        create: {
          name: "Consultations",
          slug: "consultations",
          durationMinutes: 30,
        },
      },
      site: {
        create: {
          published: false,
          logoText: input.name,
          tagline: `Welcome to ${input.name}`,
          pages: {
            create: {
              title: "Home",
              slug: "",
              isHome: true,
              position: 0,
              blocks: [
                {
                  type: "hero",
                  heading: input.name,
                  subheading: `Welcome to ${input.name}. We're glad you're here.`,
                  ctaLabel: "Get in touch",
                  ctaHref: "#contact",
                },
                {
                  type: "text",
                  heading: "About us",
                  body: "Tell your customers who you are and what you do. Edit this page from the Website tab in PlacidCRM.",
                },
                {
                  type: "contact",
                  heading: "Contact us",
                  body: "Reach out and we'll get back to you shortly.",
                },
              ],
            },
          },
        },
      },
    },
  });

  return location;
}
