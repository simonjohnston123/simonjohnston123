import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "simonjohnston123@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Simon Johnston";

async function main() {
  console.log("Seeding PlacidCRM…");

  const agency = await prisma.agency.upsert({
    where: { id: "seed-agency" },
    update: {},
    create: { id: "seed-agency", name: "Placid Group" },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, globalRole: "SUPER_ADMIN" },
    create: {
      agencyId: agency.id,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      globalRole: "SUPER_ADMIN",
    },
  });

  await provisionBusiness({
    agencyId: agency.id,
    ownerId: admin.id,
    slug: "placid-storage-solutions",
    name: "Placid Storage Solutions",
    industry: "Self storage",
    tagline: "Secure, affordable self storage.",
    color: "#1d5df5",
    heroSub: "Clean, secure, drive-up storage units in a range of sizes. Book a unit today.",
  });

  await provisionBusiness({
    agencyId: agency.id,
    ownerId: admin.id,
    slug: "placid-homestead",
    name: "Placid Homestead",
    industry: "Homestead / lifestyle",
    tagline: "Country living, done right.",
    color: "#16a34a",
    heroSub: "Welcome to Placid Homestead — your home for country living, produce and events.",
  });

  console.log("\nDone. Sign in at /login");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("  (change the password after first login)\n");
}

async function provisionBusiness(opts: {
  agencyId: string;
  ownerId: string;
  slug: string;
  name: string;
  industry: string;
  tagline: string;
  color: string;
  heroSub: string;
}) {
  const existing = await prisma.location.findUnique({ where: { slug: opts.slug } });
  if (existing) {
    console.log(`  · ${opts.name} already exists — skipping.`);
    return existing;
  }

  const location = await prisma.location.create({
    data: {
      agencyId: opts.agencyId,
      name: opts.name,
      slug: opts.slug,
      industry: opts.industry,
      email: `hello@${opts.slug}.com`,
      memberships: { create: { userId: opts.ownerId, role: "ADMIN" } },
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
        create: { name: "Consultations", slug: "consultations", durationMinutes: 30 },
      },
      site: {
        create: {
          published: true,
          primaryColor: opts.color,
          logoText: opts.name,
          tagline: opts.tagline,
          pages: {
            create: [
              {
                title: "Home",
                slug: "",
                isHome: true,
                position: 0,
                blocks: [
                  { type: "hero", heading: opts.name, subheading: opts.heroSub, ctaLabel: "Get in touch", ctaHref: "#contact" },
                  { type: "text", heading: "About us", body: `${opts.name} is part of the Placid Group. ${opts.tagline}` },
                  { type: "contact", heading: "Contact us", body: "Send us a message and we'll get right back to you." },
                ],
              },
              {
                title: "Services",
                slug: "services",
                position: 1,
                blocks: [
                  { type: "text", heading: "What we offer", body: "Describe your services here. Edit this page in PlacidCRM → Website." },
                  { type: "contact", heading: "Enquire", body: "Interested? Reach out below." },
                ],
              },
            ],
          },
        },
      },
    },
  });

  // A couple of sample contacts + an opportunity so the dashboard isn't empty.
  const pipeline = await prisma.pipeline.findFirst({
    where: { locationId: location.id },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  const contact = await prisma.contact.create({
    data: {
      locationId: location.id,
      firstName: "Sample",
      lastName: "Lead",
      email: `lead@${opts.slug}.com`,
      phone: "0400 000 000",
      source: "Seed",
    },
  });
  if (pipeline) {
    await prisma.opportunity.create({
      data: {
        locationId: location.id,
        pipelineId: pipeline.id,
        stageId: pipeline.stages[0].id,
        contactId: contact.id,
        title: `Enquiry — ${opts.name}`,
        value: 500,
      },
    });
  }

  console.log(`  · Created ${opts.name} (/sites/${opts.slug})`);
  return location;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
