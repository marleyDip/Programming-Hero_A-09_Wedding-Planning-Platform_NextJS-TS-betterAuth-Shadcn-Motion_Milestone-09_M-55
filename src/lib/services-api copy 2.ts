/**
 * Place at: lib/services-api.ts
 *
 * Data layer for the Featured Services section.
 * Works with the local json-server (db.json) today and your real Express/MongoDB API later:
 * only API_URL (and, if your API differs, the two endpoint paths below) needs to change.
 *
 * Env:  NEXT_PUBLIC_API_URL=http://localhost:5000
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

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
  name: string;
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

interface RawUser {
  id?: string;
  _id?: string;
  name: string;
  businessName?: string;
  image?: string | null;
  role: string;
  subscriptionPlan?: string;
  isBlocked?: boolean;
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    signal,

    headers: { Accept: "application/json" },

    // next: {
    //   revalidate: 300, // Refresh cached data every 5 minutes
    // },
  });

  if (!res.ok) throw new Error(`Request failed (${res.status})`);

  return res.json() as Promise<T>;
}

/**
 * Featured services = approved AND active services (from vendors who are not blocked),
 * best rated first, limited to `limit`.
 *
 * Filtering is requested from the API *and* re-checked here, so pending / rejected / inactive
 * services can never leak onto the homepage even if the backend ignores a query param.
 */
export async function getFeaturedServices(
  limit = 6,
  signal?: AbortSignal,
): Promise<Service[]> {
  //   const [services, users] = await Promise.all([
  //     getJSON<RawService[]>(
  //       "/services?status=approved&isActive=true&_sort=rating&_order=desc",
  //       signal,
  //     ),

  //     getJSON<RawUser[]>("/users?role=vendor", signal),
  //   ]);

  const [services, users] = await Promise.all([
    getJSON<RawService[]>("/services", signal),
    getJSON<RawUser[]>("/users/me", signal),
  ]);

  // console.log("API URL:", API_URL);
  // console.log("All services:", services);
  // console.log("All users:", users);

  //   console.log(
  //     "Approved services:",
  //     services.filter((s) => s.status === "approved"),
  //   );

  //   console.log(
  //     "Active services:",
  //     services.filter((s) => s.isActive === true),
  //   );

  //   console.log(
  //     "Vendor users:",
  //     users.filter((u) => u.role === "vendor"),
  //   );

  // Build vendor lookup
  const vendors = new Map<string, Vendor>();

  for (const user of users) {
    // if (u.isBlocked) continue;
    if (user.role !== "vendor" || user.isBlocked) continue;

    const id = String(user.id ?? user._id);

    vendors.set(id, {
      id,
      name: user.name,
      businessName: user.businessName || user.name,
      image: user.image,
      subscriptionPlan: user.subscriptionPlan,
    });
  }

  // console.log("Total services:", services.length);
  // console.log("Total vendors:", vendors.size);

  //   console.log(
  //     "Matching services:",
  //     services.filter(
  //       (service) =>
  //         service.status === "approved" &&
  //         service.isActive === true &&
  //         vendors.has(String(service.vendorId)),
  //     ),
  //   );

  // Filter, sort, and select featured services
  return services
    .filter(
      (service) =>
        service.status === "approved" &&
        service.isActive === true &&
        vendors.has(String(service.vendorId)),
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit)
    .map((service) => ({
      id: String(service.id ?? service._id),
      name: service.name,
      category: service.category,
      price: service.price,
      priceType: service.priceType ?? "per event",
      location: service.location,
      image: service.image,
      description: service.description,
      rating: service.rating ?? 0,
      reviewCount: service.reviewCount ?? 0,
      vendor: vendors.get(String(service.vendorId))!,
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

/**
 * Counts live services per category.
 * Only includes approved and active services
 * from vendors who are not blocked.
 */
export async function getCategoryCounts(
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const [services, users] = await Promise.all([
    getJSON<RawService[]>("/services", signal),
    getJSON<RawUser[]>("/users", signal),
  ]);

  // Get valid vendor IDs
  const validVendorIds = new Set(
    users
      .filter((user) => user.role === "vendor" && !user.isBlocked)
      .map((user) => String(user.id ?? user._id)),
  );

  // Count approved and active services
  const counts: Record<string, number> = {};

  for (const service of services) {
    if (
      service.status !== "approved" ||
      service.isActive !== true ||
      !validVendorIds.has(String(service.vendorId))
    ) {
      continue;
    }

    const category = service.category;

    counts[category] = (counts[category] ?? 0) + 1;
  }

  return counts;
}

/**
 * Number of live services per category name.
 * Counts only APPROVED + ACTIVE services from vendors who are not blocked,
 * the same rule used by the Featured Services section.
 */
/* export async function getCategoryCounts(
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const [services, users] = await Promise.all([
    getJSON<RawService[]>("/services?status=approved&isActive=true", signal),
    getJSON<RawUser[]>("/users?role=vendor", signal),
  ]);

  const okVendors = new Set(
    users.filter((u) => !u.isBlocked).map((u) => String(u.id ?? u._id)),
  );

  const counts: Record<string, number> = {};
  for (const s of services) {
    if (
      s.status !== "approved" ||
      s.isActive !== true ||
      !okVendors.has(String(s.vendorId))
    )
      continue;

    counts[s.category] = (counts[s.category] ?? 0) + 1;
  }

  return counts;
} */

// Platform stats, destinations, testimonials
async function getLiveServices(signal?: AbortSignal): Promise<RawService[]> {
  const [services, users] = await Promise.all([
    getJSON<RawService[]>("/services?status=approved&isActive=true", signal),
    getJSON<RawUser[]>("/users?role=vendor", signal),
  ]);

  const okVendors = new Set(
    users.filter((u) => !u.isBlocked).map((u) => String(u.id ?? u._id)),
  );

  return services.filter(
    (s) =>
      s.status === "approved" &&
      s.isActive === true &&
      okVendors.has(String(s.vendorId)),
  );
}

export interface PlatformStats {
  services: number;
  vendors: number;
  cities: number;
  categories: number;
}

/** Real numbers for the "Why choose WedPlan" section (live = approved + active, vendor not blocked). */
export async function getPlatformStats(
  signal?: AbortSignal,
): Promise<PlatformStats> {
  const live = await getLiveServices(signal);

  return {
    services: live.length,
    vendors: new Set(live.map((s) => String(s.vendorId))).size,
    cities: new Set(live.map((s) => s.location)).size,
    categories: new Set(live.map((s) => s.category)).size,
  };
}

/** Live service count per city (key = location name, e.g. "Cox's Bazar"). */
export async function getLocationCounts(
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const live = await getLiveServices(signal);

  const counts: Record<string, number> = {};

  for (const s of live) counts[s.location] = (counts[s.location] ?? 0) + 1;
  return counts;
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
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ServiceError("network", "We couldn't reach the server.");
  }

  if (res.status === 404 || res.status === 400)
    throw new ServiceError("not-found", "This service doesn't exist.");
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

  let u: RawUser;
  try {
    u = await getJSON<RawUser>(
      `/users/${encodeURIComponent(String(s.vendorId))}`,
      signal,
    );
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ServiceError(
      "unavailable",
      "This service is not available for booking right now.",
    );
  }

  if (u.isBlocked || u.role !== "vendor") {
    throw new ServiceError(
      "unavailable",
      "This service is not available for booking right now.",
    );
  }

  const vid = String(u.id ?? u._id);
  return {
    id: String(s.id ?? s._id),
    name: s.name,
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
    vendor: {
      id: vid,
      name: u.name,
      businessName: u.businessName || u.name,
      image: u.image,
      subscriptionPlan: u.subscriptionPlan,
    },
  };
}

export interface BookingInput {
  serviceId: string;
  vendorId: string;
  customerId: string;
  eventDate: string; // YYYY-MM-DD
  eventLocation: string;
  message: string;
}

/** Is there already a pending / accepted request by this customer for this service and date? */
export async function hasActiveBooking(
  serviceId: string,
  customerId: string,
  eventDate: string,
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({
    serviceId,
    customerId,
    eventDate,
  }).toString();

  const rows = await getJSON<{ status: string }[]>(`/bookings?${qs}`, signal);

  return rows.some((b) => b.status === "pending" || b.status === "accepted");
}

/**
 * Creates a booking with status "pending".
 * NOTE: in the real Express API, customerId and vendorId must be taken from the verified JWT and
 * the service record on the server, never trusted from the request body. They are sent here only
 * because json-server has no auth.
 */
export async function createBooking(input: BookingInput, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/bookings`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ...input,
      status: "pending",
      createdAt: new Date().toISOString(),
    }),
  });

  if (!res.ok) throw new Error(`Booking failed (${res.status})`);

  return res.json();
}
