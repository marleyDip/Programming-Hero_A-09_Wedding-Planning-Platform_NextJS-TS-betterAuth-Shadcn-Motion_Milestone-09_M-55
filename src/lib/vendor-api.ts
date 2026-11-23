/**
 * WedPlan - vendor dashboard API
 * Place at: lib/vendor-api.ts   (needs lib/bookings-api.ts, which exports the authenticated `api` helper)
 *
 * Every call sends the Better Auth JWT (through `api`), and the Express API does the real checks:
 * vendor role, ownership, the Free plan limit and "pending only" for accept / reject. The client never
 * sends vendorId, status, rating or dates; the server sets them from the verified token.
 * The `vendorId` arguments are kept so existing components compile; they are no longer sent.
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

/** Only the fields the server accepts. */
const toBody = (i: ServiceInput) => ({
  name: i.name,
  category: i.category,
  description: i.description,
  price: i.price,
  priceType: i.priceType,
  location: i.location,
  images: i.images,
});

/** All services of the signed-in vendor (every status), newest first. */
export async function getVendorServices(
  _vendorId: string,
  signal?: AbortSignal,
): Promise<VendorService[]> {
  const rows = await api<RawService[]>("/services/mine", { signal });

  return rows
    .map(norm)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** One of the caller's own services (403 / 404 from the server if it isn't theirs). */
export async function getVendorService(
  id: string,
  _vendorId: string,
): Promise<VendorService> {
  return norm(await api<RawService>(`/services/mine/${enc(id)}`));
}

/** New services always start as "pending" until an admin approves them (set by the server). */
export async function createService(
  _vendorId: string,
  input: ServiceInput,
): Promise<VendorService> {
  return norm(
    await api<RawService>("/services", {
      method: "POST",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function updateService(
  id: string,
  _vendorId: string,
  input: ServiceInput,
): Promise<VendorService> {
  return norm(
    await api<RawService>(`/services/${enc(id)}`, {
      method: "PATCH",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function setServiceActive(
  id: string,
  _vendorId: string,
  isActive: boolean,
): Promise<void> {
  await api(`/services/${enc(id)}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteService(
  id: string,
  _vendorId: string,
): Promise<void> {
  await api(`/services/${enc(id)}`, { method: "DELETE" });
}

// bookings
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

/** Booking requests for this vendor's services (service + customer details attached), newest first. */
export async function getVendorBookings(
  _vendorId: string,
  signal?: AbortSignal,
): Promise<VendorBooking[]> {
  const rows = await api<VendorBooking[]>("/bookings/vendor", { signal });

  return [...rows].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

/** Accept or reject a PENDING request that belongs to this vendor (one atomic update on the server). */
export async function respondToBooking(
  id: string,
  _vendorId: string,
  decision: "accepted" | "rejected",
): Promise<void> {
  await api(`/bookings/${enc(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: decision }),
  });
}

// subscription

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
