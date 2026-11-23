/**
 * WedPlan - vendor dashboard API
 * Place at: lib/vendor-api.ts   (needs lib/bookings-api.ts, which exports the authenticated `api` helper)
 *
 * Every call sends the Better Auth JWT. The checks in this file (ownership, pending-only, free limit)
 * make the mock API behave and give good UX, but they are NOT a security boundary.
 * The real Express API must, from the verified JWT (never from the request body):
 *   - allow only role "vendor" (and not blocked) on these routes
 *   - set vendorId itself when creating a service
 *   - verify the vendor owns a service / booking before reading, changing or deleting it
 *   - enforce the Free plan limit (max 3 active services) and "pending only" for accept / reject
 *   - create the Stripe Checkout session for the CALLER only, and activate Premium only from a
 *     verified Stripe webhook event
 */

import type { BookingStatus } from "@/lib/bookings-api";
import { api, ApiError } from "@/lib/bookings-api";

export { ApiError };

export const FREE_LIMIT = 3;

// services
export type ServiceStatus = "pending" | "approved" | "rejected";

export interface VendorService {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  priceType: string;
  location: string;
  image: string;
  images: string[];
  status: ServiceStatus;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
}

export interface ServiceInput {
  name: string;
  category: string;
  description: string;
  price: number;
  priceType: string;
  location: string;
  images: string[];
}

interface RawService {
  id?: string;
  _id?: string;
  vendorId: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  priceType?: string;
  location: string;
  image: string;
  images?: string[];
  status: ServiceStatus;
  isActive: boolean;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
}

const norm = (s: RawService): VendorService => ({
  id: String(s.id ?? s._id),
  vendorId: String(s.vendorId),
  name: s.name,
  category: s.category,
  description: s.description ?? "",
  price: s.price,
  priceType: s.priceType ?? "per event",
  location: s.location,
  image: s.image,
  images: s.images?.length ? s.images : s.image ? [s.image] : [],
  status: s.status,
  isActive: s.isActive,
  rating: s.rating ?? 0,
  reviewCount: s.reviewCount ?? 0,
  createdAt: s.createdAt ?? new Date(0).toISOString(),
});

const enc = encodeURIComponent;

/** All services of the signed-in vendor (every status), newest first. */
export async function getVendorServices(
  vendorId: string,
  signal?: AbortSignal,
): Promise<VendorService[]> {
  const rows = await api<RawService[]>(`/services?vendorId=${enc(vendorId)}`, {
    signal,
  });
  return rows
    .filter((s) => String(s.vendorId) === String(vendorId))
    .map(norm)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

async function owned(id: string, vendorId: string): Promise<RawService> {
  const s = await api<RawService>(`/services/${enc(id)}`);
  if (String(s.vendorId) !== String(vendorId))
    throw new ApiError(403, "This service belongs to another vendor.");
  return s;
}

export async function getVendorService(
  id: string,
  vendorId: string,
): Promise<VendorService> {
  return norm(await owned(id, vendorId));
}

/** New services always start as "pending" until an admin approves them. */
export async function createService(
  vendorId: string,
  input: ServiceInput,
): Promise<VendorService> {
  const body = {
    vendorId,
    name: input.name,
    category: input.category,
    description: input.description,
    price: input.price,
    priceType: input.priceType,
    location: input.location,
    image: input.images[0],
    images: input.images,
    status: "pending",
    isActive: true,
    rating: 0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  };

  return norm(
    await api<RawService>("/services", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

export async function updateService(
  id: string,
  vendorId: string,
  input: ServiceInput,
): Promise<VendorService> {
  await owned(id, vendorId);
  const body = { ...input, image: input.images[0] };
  return norm(
    await api<RawService>(`/services/${enc(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

export async function setServiceActive(
  id: string,
  vendorId: string,
  isActive: boolean,
): Promise<void> {
  const s = await owned(id, vendorId);
  if (s.status === "rejected")
    throw new ApiError(409, "Rejected services can't be made available.");
  await api(`/services/${enc(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteService(
  id: string,
  vendorId: string,
): Promise<void> {
  await owned(id, vendorId);
  await api(`/services/${enc(id)}`, { method: "DELETE" });
}

/* ------------------------------ bookings ------------------------------ */

export interface VendorBooking {
  id: string;
  serviceId: string;
  vendorId: string;
  customerId: string;
  eventDate: string;
  eventLocation: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  service: {
    id: string;
    name: string;
    image: string;
    category: string;
    price: number;
    priceType: string;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    phone?: string | null;
  } | null;
}

interface RawBooking {
  id?: string;
  _id?: string;
  serviceId: string;
  vendorId: string;
  customerId: string;
  eventDate: string;
  eventLocation: string;
  message?: string;
  status: BookingStatus;
  createdAt: string;
}
interface RawUser {
  id?: string;
  _id?: string;
  name: string;
  email?: string;
  image?: string | null;
  phone?: string | null;
}

/** Booking requests for this vendor's services (service + customer details attached), newest first. */
export async function getVendorBookings(
  vendorId: string,
  signal?: AbortSignal,
): Promise<VendorBooking[]> {
  const [rows, services, users] = await Promise.all([
    api<RawBooking[]>(`/bookings?vendorId=${enc(vendorId)}`, { signal }),
    api<RawService[]>(`/services?vendorId=${enc(vendorId)}`, { signal }),
    api<RawUser[]>("/users", { signal }),
  ]);
  const svc = new Map(services.map((s) => [String(s.id ?? s._id), s]));
  const usr = new Map(users.map((u) => [String(u.id ?? u._id), u]));

  return rows
    .filter((b) => String(b.vendorId) === String(vendorId))
    .map<VendorBooking>((b) => {
      const s = svc.get(String(b.serviceId));
      const u = usr.get(String(b.customerId));
      return {
        id: String(b.id ?? b._id),
        serviceId: String(b.serviceId),
        vendorId: String(b.vendorId),
        customerId: String(b.customerId),
        eventDate: b.eventDate,
        eventLocation: b.eventLocation,
        message: b.message ?? "",
        status: b.status,
        createdAt: b.createdAt,
        service: s
          ? {
              id: String(s.id ?? s._id),
              name: s.name,
              image: s.images?.[0] ?? s.image,
              category: s.category,
              price: s.price,
              priceType: s.priceType ?? "per event",
            }
          : null,
        customer: u
          ? {
              id: String(u.id ?? u._id),
              name: u.name,
              email: u.email ?? "",
              image: u.image,
              phone: u.phone,
            }
          : null,
      };
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** Accept or reject a PENDING request that belongs to this vendor. Processed requests can't be processed again. */
export async function respondToBooking(
  id: string,
  vendorId: string,
  decision: "accepted" | "rejected",
): Promise<void> {
  const b = await api<RawBooking>(`/bookings/${enc(id)}`);
  if (String(b.vendorId) !== String(vendorId))
    throw new ApiError(403, "This request belongs to another vendor.");
  if (b.status !== "pending")
    throw new ApiError(409, `This request is already ${b.status}.`);
  await api(`/bookings/${enc(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: decision,
      respondedAt: new Date().toISOString(),
    }),
  });
}

/* ----------------------------- subscription ----------------------------- */

/**
 * Asks the server for a Stripe Checkout session and returns its URL.
 * The server creates the session for the signed-in vendor (from the JWT). Premium is activated
 * ONLY by the verified Stripe webhook, never by the success redirect or by this call.
 */
export async function startPremiumCheckout(): Promise<string> {
  const res = await api<{ url?: string }>("/payments/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan: "premium" }),
  });
  if (!res.url) throw new ApiError(502, "No checkout URL returned.");
  return res.url;
}
