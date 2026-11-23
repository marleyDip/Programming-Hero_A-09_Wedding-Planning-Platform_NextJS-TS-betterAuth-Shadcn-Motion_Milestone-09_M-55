/**
 * Place at: lib/services-api.ts
 *
 * Data layer for the Featured Services section.
 * Works with the local json-server (db.json) today and your real Express/MongoDB API later:
 * only API_URL (and, if your API differs, the two endpoint paths below) needs to change.
 *
 * Env:  NEXT_PUBLIC_API_URL=http://localhost:5000
 */

import { authClient } from "@/lib/auth-client";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

/** How long public service data may be served from cache. */
export const PUBLIC_REVALIDATE_SECONDS = 300;

export interface Vendor {
  id: string;
  name: string;
  businessName: string;
  image?: string | null;
  subscriptionPlan?: "free" | "premium" | string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  priceType: string;
  location: string;
  image: string;
  description?: string;
  rating: number;
  reviewCount: number;
  vendor: Vendor;
}

/* Raw shapes (what the API returns). `_id` is accepted so a MongoDB backend works unchanged. */
interface RawService {
  id?: string;
  _id?: string;
  name?: string;
  serviceName?: string;
  vendor?: RawVendor | null;
  category: string;
  price: number;
  priceType?: string;
  location: string;
  image: string;
  description?: string;
  status: "approved" | "pending" | "rejected" | string;
  isActive: boolean;
  vendorId: string;
  rating?: number;
  reviewCount?: number;
}

interface RawVendor {
  id?: string;
  _id?: string;
  name: string;
  businessName?: string;
  image?: string | null;
  subscriptionPlan?: string;
}

const toVendor = (v: RawVendor): Vendor => ({
  id: String(v.id ?? v._id),
  name: v.name,
  businessName: v.businessName || v.name,
  image: v.image ?? null,
  subscriptionPlan: v.subscriptionPlan,
});

/**
 * `Authorization: Bearer <JWT>` from Better Auth. Returns {} when signed out, so the API answers 401
 * and the caller can send the user to Sign In.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await authClient.token();
    return data?.token ? { Authorization: `Bearer ${data.token}` } : {};
  } catch {
    return {};
  }
}

async function getJSON<T>(
  path: string,
  signal?: AbortSignal,
  auth = false,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    signal,

    headers: {
      Accept: "application/json",
      ...(auth ? await authHeaders() : {}),
    },

    // Public lists are cached and refreshed every 5 minutes (Next.js data cache; ignored in the browser).
    // Anything sent with a JWT is user-specific, so it is never cached.
    ...(auth
      ? { cache: "no-store" as const }
      : { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } }),
  });

  if (!res.ok) throw new Error(`Request failed (${res.status})`);

  return res.json() as Promise<T>;
}

/** The API caps one page at 500 services. */
const MAX_LIMIT = 500;

/**
 * Featured services = approved AND active services from vendors who are not blocked, best rated first.
 * The Express API already applies those rules and attaches the public vendor details to every service.
 */
export async function getFeaturedServices(
  limit = 6,
  signal?: AbortSignal,
): Promise<Service[]> {
  const qs = new URLSearchParams({
    sort: "rating",
    limit: String(Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT)),
  });
  const rows = await getJSON<RawService[]>(`/services?${qs}`, signal);

  return rows
    .filter((s) => s.vendor) // a live service always has its vendor; skip anything odd
    .map((s) => ({
      id: String(s.id ?? s._id),
      name: s.name ?? s.serviceName ?? "",
      category: s.category,
      price: s.price,
      priceType: s.priceType ?? "per event",
      location: s.location,
      image: s.image,
      description: s.description,
      rating: s.rating ?? 0,
      reviewCount: s.reviewCount ?? 0,
      vendor: toVendor(s.vendor!),
    }));
}

// Categories
export interface Category {
  id: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
}

/** All categories from the API (collection: /categories). */
export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const rows = await getJSON<
    (Partial<Category> & { _id?: string; id?: string })[]
  >("/categories", signal);

  return rows.map((category) => ({
    id: String(category.id ?? category._id ?? ""),
    name: category.name ?? "",
    tagline: category.tagline ?? "",
    description: category.description ?? "",
    tags: category.tags ?? [],
  }));
}

/** Real numbers for the homepage, computed by the server from live services only (GET /services/stats). */
export interface PlatformStats {
  services: number;
  vendors: number;
  cities: number;
  categories: number;
}

interface RawStats extends PlatformStats {
  byCategory: Record<string, number>;
  byLocation: Record<string, number>;
}

const getStats = (signal?: AbortSignal) =>
  getJSON<RawStats>("/services/stats", signal);

/** Live service count per category name. */
export async function getCategoryCounts(
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  return (await getStats(signal)).byCategory;
}

/** Numbers for the "Why choose WedPlan" section. */
export async function getPlatformStats(
  signal?: AbortSignal,
): Promise<PlatformStats> {
  const { services, vendors, cities, categories } = await getStats(signal);

  return { services, vendors, cities, categories };
}

/** Live service count per city (key = location name, e.g. "Cox's Bazar"). */
export async function getLocationCounts(
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  return (await getStats(signal)).byLocation;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  service: string;
  rating: number;
  quote: string;
  image?: string | null;
  /** true = placeholder content. The UI shows a "Sample reviews" tag until you replace it with real reviews. */
  sample?: boolean;
}

export async function getTestimonials(
  signal?: AbortSignal,
): Promise<Testimonial[]> {
  const rows = await getJSON<
    (Partial<Testimonial> & { _id?: string; id?: string; status?: string })[]
  >("/testimonials", signal);

  return rows
    .filter((t) => (t.status ?? "approved") === "approved" && t.quote && t.name)
    .map((t) => ({
      id: String(t.id ?? t._id),
      name: t.name!,
      location: t.location ?? "",
      service: t.service ?? "",
      rating: Math.min(5, Math.max(1, t.rating ?? 5)),
      quote: t.quote!,
      image: t.image,
      sample: t.sample === true,
    }));
}

/** Every live service (approved + active, vendor not blocked), best rated first. */
export function getAllServices(signal?: AbortSignal): Promise<Service[]> {
  return getFeaturedServices(Number.MAX_SAFE_INTEGER, signal);
}

// Service details & bookings
export type ServiceErrorCode = "not-found" | "unavailable" | "network";

export class ServiceError extends Error {
  code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export interface ServiceDetail extends Service {
  images: string[];
  createdAt?: string;
}

/**
 * One bookable service. Throws ServiceError:
 *  - "not-found"   the id does not exist (invalid service ID)
 *  - "unavailable" it exists but is not approved + active, or its vendor is missing / blocked
 *  - "network"     the API could not be reached
 */
export async function getServiceById(
  id: string,
  signal?: AbortSignal,
): Promise<ServiceDetail> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/services/${encodeURIComponent(id)}`, {
      signal,
      headers: { Accept: "application/json", ...(await authHeaders()) },
      cache: "no-store", // sent with a JWT: never cache
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ServiceError("network", "We couldn't reach the server.");
  }

  if (res.status === 401)
    throw new ServiceError(
      "network",
      "Your session has expired. Please sign in again.",
    );

  if (res.status === 404 || res.status === 400)
    throw new ServiceError("not-found", "This service doesn't exist.");

  if (res.status === 403)
    throw new ServiceError(
      "unavailable",
      "This service is not available for booking right now.",
    );

  if (!res.ok)
    throw new ServiceError(
      "network",
      `The server returned an error (${res.status}).`,
    );

  const s = (await res.json()) as RawService & {
    images?: string[];
    createdAt?: string;
  };

  if (s.status !== "approved" || s.isActive !== true) {
    throw new ServiceError(
      "unavailable",
      "This service is not available for booking right now.",
    );
  }

  if (!s.vendor) {
    throw new ServiceError(
      "unavailable",
      "This service is not available for booking right now.",
    );
  }

  return {
    id: String(s.id ?? s._id),
    name: s.name ?? s.serviceName ?? "",
    category: s.category,
    price: s.price,
    priceType: s.priceType ?? "per event",
    location: s.location,
    image: s.image,
    images: s.images && s.images.length ? s.images : [s.image],
    description: s.description,
    rating: s.rating ?? 0,
    reviewCount: s.reviewCount ?? 0,
    createdAt: s.createdAt,
    vendor: toVendor(s.vendor),
  };
}

export interface BookingInput {
  serviceId: string;
  /** Ignored by the Express API (it reads both from the JWT and the service record). */
  vendorId?: string;
  customerId?: string;
  eventDate: string; // YYYY-MM-DD
  eventLocation: string;
  message: string;
}

/** Is there already a pending / accepted request by the signed-in customer for this service and date? */
export async function hasActiveBooking(
  serviceId: string,
  _customerId: string, // kept so existing callers compile; the server uses the JWT
  eventDate: string,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ serviceId, eventDate }).toString();

  const res = await getJSON<{ exists: boolean }>(
    `/bookings/check?${qs}`,
    signal,
    true,
  );

  return res.exists === true;
}

/** Error from the API, with its HTTP status and machine code (e.g. DUPLICATE_BOOKING). */
export class BookingError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "BookingError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Creates a booking (the server sets status "pending").
 * Sends the Better Auth JWT. Only these four fields go in the body: customerId, vendorId, status and
 * createdAt are set by the server from the token and the service record, never trusted from the client.
 */
export async function createBooking(input: BookingInput, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    signal,

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(await authHeaders()),
    },

    cache: "no-store",

    body: JSON.stringify({
      serviceId: input.serviceId,
      eventDate: input.eventDate,
      eventLocation: input.eventLocation,
      message: input.message,
    }),
  });

  if (!res.ok) {
    let body: { message?: string; code?: string } = {};

    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }

    throw new BookingError(
      res.status,
      body.message ??
        (res.status === 401
          ? "Please sign in again to book."
          : `Booking failed (${res.status})`),
      body.code,
    );
  }

  return res.json();
}
