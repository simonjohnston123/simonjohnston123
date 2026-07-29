"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireLocationAccess } from "@/lib/auth";
import type { OrderStatus, OrderType, Prisma } from "@prisma/client";

type Item = { name: string; qty: number; price: number };

function parseItems(raw: string): Item[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        name: String(x.name ?? "").trim(),
        qty: Math.max(Number(x.qty) || 0, 0),
        price: Math.max(Number(x.price) || 0, 0),
      }))
      .filter((x) => x.name && x.qty > 0);
  } catch {
    return [];
  }
}

export async function createOrderAction(_prev: unknown, formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  await requireLocationAccess(locationId);

  const type = (String(formData.get("type") ?? "PRODUCT") as OrderType) || "PRODUCT";
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const deliveryAddress = String(formData.get("deliveryAddress") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (items.length === 0) return { error: "Add at least one item." };
  if (type === "DELIVERY" && !deliveryAddress) return { error: "Delivery orders need a delivery address." };

  const total = items.reduce((sum, it) => sum + it.qty * it.price, 0);

  // Link (or create) a customer contact when we have contact details.
  let contactId: string | null = null;
  if (customerEmail || customerPhone) {
    const existing =
      (customerEmail ? await prisma.contact.findFirst({ where: { locationId, email: customerEmail } }) : null) ||
      (customerPhone ? await prisma.contact.findFirst({ where: { locationId, phone: customerPhone } }) : null);
    if (existing) {
      contactId = existing.id;
    } else {
      const [firstName, ...rest] = customerName.split(" ");
      const c = await prisma.contact.create({
        data: {
          locationId,
          firstName: firstName || null,
          lastName: rest.join(" ") || null,
          email: customerEmail || null,
          phone: customerPhone || null,
          source: "Order",
        },
      });
      contactId = c.id;
    }
  }

  const last = await prisma.order.findFirst({ where: { locationId }, orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 1000) + 1;

  const order = await prisma.order.create({
    data: {
      locationId,
      contactId,
      number,
      type,
      status: "NEW",
      items: items as unknown as Prisma.InputJsonValue,
      total,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      deliveryAddress: deliveryAddress || null,
      notes: notes || null,
    },
  });

  revalidatePath(`/dashboard/l/${locationId}/orders`);
  redirect(`/dashboard/l/${locationId}/orders/${order.id}`);
}

export async function setOrderStatusAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  await requireLocationAccess(locationId);
  const valid = ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];
  if (!valid.includes(status)) return;
  await prisma.order.update({ where: { id: orderId, locationId }, data: { status } });
  revalidatePath(`/dashboard/l/${locationId}/orders/${orderId}`);
  revalidatePath(`/dashboard/l/${locationId}/orders`);
}

export async function deleteOrderAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await requireLocationAccess(locationId);
  await prisma.order.delete({ where: { id: orderId, locationId } });
  revalidatePath(`/dashboard/l/${locationId}/orders`);
  redirect(`/dashboard/l/${locationId}/orders`);
}

/** Post a delivery order to the Placid Deliveries driver board. */
export async function postDeliveryJobAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const fee = Math.max(Number(formData.get("fee")) || 0, 0);
  const { location } = await requireLocationAccess(locationId);

  const order = await prisma.order.findFirst({ where: { id: orderId, locationId } });
  if (!order || order.type !== "DELIVERY" || !order.deliveryAddress) return;

  // Don't double-post.
  const existing = await prisma.deliveryJob.findFirst({ where: { orderId, locationId } });
  if (existing) return;

  const pickup =
    [location.addressLine, location.city, location.state, location.postalCode].filter(Boolean).join(", ") || location.name;

  await prisma.deliveryJob.create({
    data: {
      locationId,
      orderId,
      status: "POSTED",
      scope: "SHARED",
      pickupAddress: pickup,
      dropoffAddress: order.deliveryAddress,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fee,
      notes: order.notes,
    },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: "OUT_FOR_DELIVERY" } });
  revalidatePath(`/dashboard/l/${locationId}/orders/${orderId}`);
}

export async function cancelDeliveryJobAction(formData: FormData) {
  const locationId = String(formData.get("locationId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  await requireLocationAccess(locationId);
  // Only pull it back if a driver hasn't accepted yet.
  await prisma.deliveryJob.deleteMany({ where: { id: jobId, locationId, status: "POSTED" } });
  revalidatePath(`/dashboard/l/${locationId}/orders/${orderId}`);
}
