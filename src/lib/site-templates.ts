// Starter page templates — a business can apply one to skip the blank page.
// Each is an array of blocks matching site-blocks-catalog shapes.

export type Template = { key: string; name: string; description: string; blocks: Record<string, unknown>[] };

export const TEMPLATES: Template[] = [
  {
    key: "service",
    name: "Local service business",
    description: "Hero, services, FAQ and an enquiry form.",
    blocks: [
      { type: "hero", heading: "Trusted local service you can count on", subheading: "Friendly, reliable and fully insured. Get a fast, free quote today.", ctaLabel: "Get a quote", ctaHref: "#contact" },
      { type: "features", heading: "What we do", items: [
        { title: "Fast response", body: "We get back to you quickly and turn up on time." },
        { title: "Fair pricing", body: "Clear, upfront quotes with no surprises." },
        { title: "Quality work", body: "Done right the first time, guaranteed." },
      ] },
      { type: "faq", heading: "Common questions", items: [
        { q: "What areas do you cover?", a: "We service the local region — get in touch to confirm." },
        { q: "How do I get a quote?", a: "Fill in the form below and we'll be in touch shortly." },
      ] },
      { type: "form", heading: "Get in touch", body: "Tell us what you need and we'll get straight back to you.", fields: ["name", "email", "phone", "message"], submitLabel: "Send enquiry", thankYou: "Thanks — we'll be in touch shortly." },
    ],
  },
  {
    key: "bookings",
    name: "Bookings / appointments",
    description: "Hero, why-us, and a live booking calendar.",
    blocks: [
      { type: "hero", heading: "Book your appointment online", subheading: "Choose a time that suits you — it only takes a minute.", ctaLabel: "Book now", ctaHref: "#booking" },
      { type: "features", heading: "Why book with us", items: [
        { title: "Instant confirmation", body: "Pick an open slot and you're booked." },
        { title: "Reminders", body: "We'll remind you so nothing's missed." },
        { title: "Easy rescheduling", body: "Need to change? Just get in touch." },
      ] },
      { type: "booking", heading: "Pick a time", body: "Select an available slot below and we'll confirm.", calendarId: "", submitLabel: "Request booking", thankYou: "Thanks — we'll confirm your booking soon." },
    ],
  },
  {
    key: "storage",
    name: "Storage / rentals",
    description: "Hero, features, pricing, FAQ and enquiry.",
    blocks: [
      { type: "hero", heading: "Secure storage, sorted", subheading: "Clean, secure units and bays available now. Book online in minutes.", ctaLabel: "Check availability", ctaHref: "#contact" },
      { type: "features", heading: "Why choose us", items: [
        { title: "24/7 access", body: "Get to your things whenever you need them." },
        { title: "Secure & monitored", body: "Gated, well-lit and monitored around the clock." },
        { title: "Flexible terms", body: "Short or long term — pay by the month." },
      ] },
      { type: "pricing", heading: "Simple pricing", plans: [
        { name: "Locker", size: "Small items", price: "$X/mo", featuresText: "Ideal for boxes\nMonth to month\nBring your own padlock" },
        { name: "Unit", size: "Room of furniture", price: "$Y/mo", featuresText: "Drive-up access\nMonth to month\n24/7 entry" },
        { name: "Car bay", size: "Vehicles", price: "$Z/mo", featuresText: "Secure parking\nMonth to month\n24/7 entry" },
      ] },
      { type: "form", heading: "Enquire now", body: "Tell us what you'd like to store and we'll help you pick the right space.", fields: ["name", "email", "phone", "message"], submitLabel: "Send enquiry", thankYou: "Thanks — we'll be in touch shortly." },
    ],
  },
  {
    key: "landing",
    name: "Simple landing page",
    description: "Hero, a punchy CTA and a form.",
    blocks: [
      { type: "hero", heading: "Your big headline goes here", subheading: "One clear sentence about what you offer and why it matters.", ctaLabel: "Get started", ctaHref: "#contact" },
      { type: "cta", heading: "Ready when you are", subheading: "Join the businesses already growing with us.", ctaLabel: "Get in touch", ctaHref: "#contact" },
      { type: "form", heading: "Contact us", body: "", fields: ["name", "email", "message"], submitLabel: "Send", thankYou: "Thanks — we'll be in touch shortly." },
    ],
  },
];
