// Catalogue of column-level ELEMENTS (GHL "Elements"). These live inside a
// Row → Column, unlike the full-width section blocks in site-blocks-catalog.
// Rendering is shared by the builder preview and the public site via
// components/site-element.tsx.

import { type BlockField } from "@/lib/site-blocks-catalog";

export type ElementDef = {
  type: string;
  label: string;
  icon: string;
  group: "Text" | "Media" | "Buttons" | "Layout";
  fields: BlockField[];
  default: Record<string, unknown>;
};

const ALIGN: BlockField = {
  k: "align",
  label: "Align",
  kind: "select",
  options: [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
  ],
};

export const ELEMENT_DEFS: ElementDef[] = [
  {
    type: "heading",
    label: "Headline",
    icon: "H",
    group: "Text",
    fields: [
      { k: "text", label: "Text", kind: "text" },
      ALIGN,
      { k: "size", label: "Size", kind: "select", options: [
        { value: "md", label: "Medium" }, { value: "lg", label: "Large" }, { value: "xl", label: "Extra large" },
      ] },
    ],
    default: { text: "Headline", align: "left", size: "xl" },
  },
  {
    type: "subheading",
    label: "Sub-headline",
    icon: "T",
    group: "Text",
    fields: [{ k: "text", label: "Text", kind: "text" }, ALIGN],
    default: { text: "Sub-headline", align: "left" },
  },
  {
    type: "paragraph",
    label: "Paragraph",
    icon: "¶",
    group: "Text",
    fields: [{ k: "text", label: "Text", kind: "textarea" }, ALIGN],
    default: { text: "Write something here.", align: "left" },
  },
  {
    type: "bulletlist",
    label: "Bullet list",
    icon: "≔",
    group: "Text",
    fields: [
      { k: "items", label: "Items", kind: "items", itemFields: [{ k: "text", label: "Item", kind: "text" }] },
    ],
    default: { items: [{ text: "Point one" }, { text: "Point two" }, { text: "Point three" }] },
  },
  {
    type: "button",
    label: "Button",
    icon: "⬛",
    group: "Buttons",
    fields: [
      { k: "label", label: "Label", kind: "text" },
      { k: "href", label: "Link", kind: "url" },
      ALIGN,
      { k: "style", label: "Style", kind: "select", options: [
        { value: "solid", label: "Solid" }, { value: "outline", label: "Outline" },
      ] },
    ],
    default: { label: "Click here", href: "#", align: "left", style: "solid" },
  },
  {
    type: "image",
    label: "Image",
    icon: "▣",
    group: "Media",
    fields: [
      { k: "url", label: "Image URL", kind: "url", placeholder: "https://…" },
      { k: "alt", label: "Alt text", kind: "text" },
      { k: "rounded", label: "Corners", kind: "select", options: [
        { value: "none", label: "Square" }, { value: "md", label: "Rounded" }, { value: "full", label: "Circle" },
      ] },
    ],
    default: { url: "", alt: "", rounded: "md" },
  },
  {
    type: "video",
    label: "Video",
    icon: "▶",
    group: "Media",
    fields: [{ k: "embedUrl", label: "Embed URL (YouTube/Vimeo)", kind: "url", placeholder: "https://www.youtube.com/embed/…" }],
    default: { embedUrl: "" },
  },
  {
    type: "divider",
    label: "Divider",
    icon: "―",
    group: "Layout",
    fields: [],
    default: {},
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: "↕",
    group: "Layout",
    fields: [{ k: "size", label: "Height", kind: "select", options: [
      { value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" },
    ] }],
    default: { size: "md" },
  },
];

export function elementDef(type: string): ElementDef | undefined {
  return ELEMENT_DEFS.find((e) => e.type === type);
}
