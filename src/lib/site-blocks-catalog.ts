// Client-safe catalogue of website blocks. Drives the visual editor's
// "Add block" library and the per-block field forms. Rendering lives in
// components/site-blocks.tsx.

export type FieldKind = "text" | "textarea" | "url" | "select" | "items" | "checks" | "calendar";

export type BlockField = {
  k: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: { value: string; label: string }[];
  itemFields?: { k: string; label: string; kind: "text" | "textarea" }[];
};

export type BlockDef = {
  type: string;
  label: string;
  icon: string;
  category: "Layout" | "Content" | "Media" | "Convert";
  fields: BlockField[];
  default: Record<string, unknown>;
};

export const FORM_FIELD_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "message", label: "Message" },
];

export const BLOCK_DEFS: BlockDef[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "★",
    category: "Layout",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "subheading", label: "Subheading", kind: "textarea" },
      { k: "ctaLabel", label: "Button label", kind: "text" },
      { k: "ctaHref", label: "Button link", kind: "url" },
    ],
    default: { heading: "Your headline here", subheading: "A short supporting line.", ctaLabel: "Get started", ctaHref: "#contact" },
  },
  {
    type: "text",
    label: "Text",
    icon: "¶",
    category: "Content",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "body", label: "Body", kind: "textarea" },
    ],
    default: { heading: "Section heading", body: "Write something here." },
  },
  {
    type: "features",
    label: "Features",
    icon: "▦",
    category: "Content",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      {
        k: "items",
        label: "Items",
        kind: "items",
        itemFields: [
          { k: "title", label: "Title", kind: "text" },
          { k: "body", label: "Body", kind: "textarea" },
        ],
      },
    ],
    default: { heading: "What you get", items: [{ title: "Feature one", body: "Describe it." }, { title: "Feature two", body: "Describe it." }] },
  },
  {
    type: "pricing",
    label: "Pricing",
    icon: "$",
    category: "Content",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      {
        k: "plans",
        label: "Plans",
        kind: "items",
        itemFields: [
          { k: "name", label: "Name", kind: "text" },
          { k: "size", label: "Subtitle", kind: "text" },
          { k: "price", label: "Price", kind: "text" },
          { k: "featuresText", label: "Features (one per line)", kind: "textarea" },
        ],
      },
    ],
    default: { heading: "Pricing", plans: [{ name: "Standard", size: "Most popular", price: "$X/mo", featuresText: "Point one\nPoint two" }] },
  },
  {
    type: "faq",
    label: "FAQ",
    icon: "?",
    category: "Content",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      {
        k: "items",
        label: "Questions",
        kind: "items",
        itemFields: [
          { k: "q", label: "Question", kind: "text" },
          { k: "a", label: "Answer", kind: "textarea" },
        ],
      },
    ],
    default: { heading: "Frequently asked questions", items: [{ q: "A question?", a: "An answer." }] },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: "★",
    category: "Content",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      {
        k: "items",
        label: "Reviews",
        kind: "items",
        itemFields: [
          { k: "quote", label: "Quote", kind: "textarea" },
          { k: "author", label: "Name", kind: "text" },
          { k: "detail", label: "Detail (location / vehicle)", kind: "text" },
          { k: "rating", label: "Stars (1–5)", kind: "text" },
        ],
      },
    ],
    default: {
      heading: "What our customers say",
      items: [{ quote: "Add a real customer review here.", author: "Customer name", detail: "Lockyer Valley", rating: "5" }],
    },
  },
  {
    type: "image",
    label: "Image",
    icon: "▣",
    category: "Media",
    fields: [
      { k: "url", label: "Image URL", kind: "url", placeholder: "https://…" },
      { k: "alt", label: "Alt text", kind: "text" },
      { k: "caption", label: "Caption", kind: "text" },
    ],
    default: { url: "", alt: "", caption: "" },
  },
  {
    type: "video",
    label: "Video",
    icon: "▶",
    category: "Media",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "embedUrl", label: "Embed URL (YouTube/Vimeo)", kind: "url", placeholder: "https://www.youtube.com/embed/…" },
    ],
    default: { heading: "", embedUrl: "" },
  },
  {
    type: "liveshop",
    label: "Live Shop",
    icon: "📺",
    category: "Media",
    fields: [{ k: "heading", label: "Heading (optional)", kind: "text" }],
    default: { heading: "" },
  },
  {
    type: "button",
    label: "Button",
    icon: "⬛",
    category: "Content",
    fields: [
      { k: "label", label: "Label", kind: "text" },
      { k: "href", label: "Link", kind: "url" },
      { k: "align", label: "Align", kind: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }] },
    ],
    default: { label: "Click here", href: "#", align: "center" },
  },
  {
    type: "cta",
    label: "Call to action",
    icon: "➜",
    category: "Convert",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "subheading", label: "Subheading", kind: "textarea" },
      { k: "ctaLabel", label: "Button label", kind: "text" },
      { k: "ctaHref", label: "Button link", kind: "url" },
    ],
    default: { heading: "Ready to start?", subheading: "", ctaLabel: "Get in touch", ctaHref: "#contact" },
  },
  {
    type: "form",
    label: "Form",
    icon: "✎",
    category: "Convert",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "body", label: "Intro text", kind: "textarea" },
      { k: "fields", label: "Fields to collect", kind: "checks", options: FORM_FIELD_OPTIONS },
      { k: "submitLabel", label: "Submit button", kind: "text" },
      { k: "thankYou", label: "Thank-you message", kind: "text" },
    ],
    default: { heading: "Get in touch", body: "", fields: ["name", "email", "phone", "message"], submitLabel: "Send enquiry", thankYou: "Thanks — we'll be in touch shortly." },
  },
  {
    type: "booking",
    label: "Calendar",
    icon: "◷",
    category: "Convert",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      { k: "body", label: "Intro text", kind: "textarea" },
      { k: "calendarId", label: "Service", kind: "calendar" },
      { k: "submitLabel", label: "Submit button", kind: "text" },
      { k: "thankYou", label: "Thank-you message", kind: "text" },
    ],
    default: { heading: "Book a time", body: "Request a booking and we'll confirm.", calendarId: "", submitLabel: "Request booking", thankYou: "Thanks — we'll confirm your booking soon." },
  },
  {
    type: "products",
    label: "Products",
    icon: "🛍",
    category: "Convert",
    fields: [
      { k: "heading", label: "Heading", kind: "text" },
      {
        k: "items",
        label: "Products",
        kind: "items",
        itemFields: [
          { k: "name", label: "Name", kind: "text" },
          { k: "price", label: "Price (e.g. $49)", kind: "text" },
          { k: "imageUrl", label: "Image URL", kind: "text" },
          { k: "description", label: "Description", kind: "textarea" },
          { k: "buttonLabel", label: "Button label", kind: "text" },
          { k: "buttonHref", label: "Button link", kind: "text" },
        ],
      },
    ],
    default: {
      heading: "Our products",
      items: [
        { name: "Product name", price: "$49", imageUrl: "", description: "A short description of this product.", buttonLabel: "Buy now", buttonHref: "#" },
        { name: "Product name", price: "$79", imageUrl: "", description: "A short description of this product.", buttonLabel: "Buy now", buttonHref: "#" },
      ],
    },
  },
];

export function blockDef(type: string): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.type === type);
}
