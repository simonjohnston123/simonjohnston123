import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Capability manifest. An AI agent lands here first and learns what it can do
// without anyone writing an integration — which is the point of an open API.

export async function GET() {
  return NextResponse.json(
    {
      name: "Placid Connect Commerce API",
      version: "1.0",
      description:
        "Search and buy real stock across multiple suppliers and warehouses. Every result is filtered by whether it can actually be delivered to the destination you give.",
      conventions: {
        currency: "AUD",
        money: "All amounts are integer cents.",
        destination:
          "Required on every call as an ISO-3166-1 alpha-2 country code. Results are restricted to products deliverable there.",
        honesty:
          "stock: null means unknown, not zero. delivery.freeToDestination is only true when the supplier has confirmed it. Nothing is estimated silently.",
      },
      endpoints: [
        { method: "GET", path: "/api/commerce/v1/destinations", purpose: "Countries we hold stock for, with product counts." },
        {
          method: "GET",
          path: "/api/commerce/v1/search",
          purpose: "Filtered catalogue search.",
          query: {
            to: "ISO-2 destination (required)",
            q: "free text",
            min: "minimum price in cents",
            max: "maximum price in cents",
            inStock: "true to exclude items with no confirmed stock",
            freeDelivery: "true for confirmed free delivery only",
            page: "1-based",
            pageSize: "up to 60",
          },
        },
        { method: "GET", path: "/api/commerce/v1/products/{id}?to=XX", purpose: "One product, with deliverability and description." },
        {
          method: "POST",
          path: "/api/commerce/v1/ask",
          purpose: "Describe what you want in plain language; get an interpretation plus matching products.",
          body: { to: "ISO-2 destination (required)", message: "e.g. 'a quiet cordless vacuum under $200'" },
        },
      ],
      agentNotes: [
        "Always pass `to`. A product that cannot reach the customer is never a valid answer.",
        "Treat stock: null as 'confirm before promising'.",
        "Postage is quoted per destination at checkout, not embedded in the price.",
      ],
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
