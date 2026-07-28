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

  const storage = await provisionBusiness({
    agencyId: agency.id,
    ownerId: admin.id,
    slug: "placid-storage-solutions",
    name: "Placid Storage Solutions",
    industry: "Self storage",
    tagline: "Secure, affordable self storage.",
    color: "#1d5df5",
    heroSub: "Clean, secure, drive-up storage units in a range of sizes. Book a unit today.",
  });

  // Give Placid Storage Solutions a full, real self-storage website — all
  // managed from the CRM as a sub-account. Safe to re-run.
  await buildStorageWebsite(storage.id);

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

async function buildStorageWebsite(locationId: string) {
  const site = await prisma.site.findUnique({
    where: { locationId },
    include: { pages: true },
  });
  if (!site) return;
  const home = site.pages.find((p) => p.isHome);
  if (!home) return;

  await prisma.sitePage.update({
    where: { id: home.id },
    data: {
      blocks: [
        {
          type: "hero",
          heading: "Placid Storage Solutions",
          subheading: "Clean, secure, drive-up self storage in a range of sizes — with simple month-to-month terms and no lock-in contracts.",
          ctaLabel: "Check availability",
          ctaHref: "#contact",
        },
        {
          type: "features",
          heading: "Why store with Placid",
          items: [
            { icon: "🔒", title: "Gated & monitored", body: "Individual PIN access, CCTV and perimeter fencing keep your belongings safe around the clock." },
            { icon: "🚗", title: "Drive-up units", body: "Pull right up to your unit — load and unload straight from the car or trailer." },
            { icon: "📅", title: "Month-to-month", body: "Flexible terms with no long lock-in. Stay a month or stay for years." },
            { icon: "🕐", title: "24/7 access", body: "Reach your unit any time of day or night, seven days a week." },
            { icon: "📦", title: "Boxes & supplies", body: "Grab moving boxes, tape and locks on site so you're ready to pack." },
            { icon: "💬", title: "Local support", body: "A friendly local team on hand to help you pick the right size." },
          ],
        },
        {
          type: "pricing",
          heading: "Unit sizes & pricing",
          subheading: "Not sure what you need? Send an enquiry and we'll help you choose.",
          plans: [
            { name: "Small", size: "3 m² · ~1.5m × 2m", price: "$45/mo", features: ["Ideal for boxes & small furniture", "Fits the contents of a small room", "Ground-floor, drive-up"] },
            { name: "Medium", size: "9 m² · 3m × 3m", price: "$120/mo", features: ["A 1–2 bedroom home", "Appliances & furniture", "Drive-up access"] },
            { name: "Large", size: "18 m² · 3m × 6m", price: "$210/mo", features: ["A 3–4 bedroom home", "Business stock or tools", "Vehicle-height roller door"] },
          ],
        },
        {
          type: "faq",
          heading: "Frequently asked questions",
          items: [
            { q: "Do I need a long contract?", a: "No — storage is month-to-month. Give us a week's notice when you're ready to move out." },
            { q: "How do I pay?", a: "Rent is billed monthly. We can set up automatic card payments so you never miss one." },
            { q: "Is my unit insured?", a: "We recommend contents insurance; we can point you to affordable options that cover stored goods." },
            { q: "Can I access after hours?", a: "Yes. Your PIN gives you 24/7 gated access, 365 days a year." },
          ],
        },
        {
          type: "cta",
          heading: "Ready to reserve your unit?",
          subheading: "Tell us what you're storing and we'll confirm the right size and price.",
          ctaLabel: "Get a quote",
          ctaHref: "#contact",
        },
        {
          type: "contact",
          heading: "Check availability",
          body: "Send us a message and our team will get straight back to you with availability and pricing.",
        },
      ] as any,
    },
  });

  // Refresh the secondary page into a storage-relevant "Sizes & pricing" page.
  const services = site.pages.find((p) => p.slug === "services");
  if (services) {
    await prisma.sitePage.update({
      where: { id: services.id },
      data: {
        title: "Sizes & Pricing",
        blocks: [
          { type: "text", heading: "Find the right size", body: "Every unit is ground-floor and drive-up. Prices are per month with no lock-in contract. Reach out for current availability." },
          {
            type: "pricing",
            heading: "All unit sizes",
            plans: [
              { name: "Locker", size: "1 m²", price: "$25/mo", features: ["Documents & valuables", "Small boxes"] },
              { name: "Small", size: "3 m²", price: "$45/mo", features: ["A small room", "Boxes & furniture"] },
              { name: "Medium", size: "9 m²", price: "$120/mo", features: ["1–2 bedroom home"] },
              { name: "Large", size: "18 m²", price: "$210/mo", features: ["3–4 bedroom home", "Business stock"] },
              { name: "Vehicle / boat", size: "Outdoor bay", price: "from $90/mo", features: ["Cars, trailers, boats", "Secure gated yard"] },
            ],
          },
          { type: "contact", heading: "Enquire about a unit", body: "We'll confirm availability and pricing." },
        ] as any,
      },
    });
  }
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
