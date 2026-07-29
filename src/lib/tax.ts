// Country-aware tax identifiers. Client-safe. Some countries have two
// (e.g. Australia: ABN + ACN; NZ: GST + NZBN; UK: VAT + Company number).

type Field = { label: string; placeholder?: string };

export function taxFields(country?: string | null): { primary: Field; secondary?: Field } {
  const c = (country ?? "").trim().toLowerCase();
  if (["australia", "au", "aus"].includes(c))
    return { primary: { label: "ABN", placeholder: "12 345 678 901" }, secondary: { label: "ACN", placeholder: "123 456 789" } };
  if (["new zealand", "nz"].includes(c))
    return { primary: { label: "GST number", placeholder: "" }, secondary: { label: "NZBN", placeholder: "" } };
  if (["united kingdom", "uk", "gb", "britain", "england", "scotland", "wales"].includes(c))
    return { primary: { label: "VAT number", placeholder: "GB123456789" }, secondary: { label: "Company number", placeholder: "Companies House no." } };
  if (["united states", "usa", "us", "america"].includes(c))
    return { primary: { label: "EIN (Tax ID)", placeholder: "12-3456789" } };
  if (["canada", "ca"].includes(c))
    return { primary: { label: "GST/HST number", placeholder: "" }, secondary: { label: "Business Number (BN)", placeholder: "" } };
  if (["ireland", "germany", "france", "spain", "italy", "netherlands", "belgium", "portugal", "austria", "sweden", "denmark", "finland", "poland", "eu"].some((x) => c.includes(x)))
    return { primary: { label: "VAT number", placeholder: "" } };
  if (["singapore", "sg"].includes(c)) return { primary: { label: "GST number", placeholder: "" }, secondary: { label: "UEN", placeholder: "" } };
  if (["india", "in"].includes(c)) return { primary: { label: "GSTIN", placeholder: "" } };
  return { primary: { label: "Tax ID / VAT", placeholder: "" } };
}

export const COUNTRIES = [
  "Australia", "New Zealand", "United Kingdom", "United States", "Canada",
  "Ireland", "Singapore", "India", "Germany", "France",
];
