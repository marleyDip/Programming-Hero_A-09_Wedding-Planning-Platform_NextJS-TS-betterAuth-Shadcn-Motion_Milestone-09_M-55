/**
 * WedPlan - bookings API for the customer dashboard
 * Place at: lib/bookings-api.ts
 *
 * Every request carries the Better Auth JWT (`Authorization: Bearer <token>`), so your Express API
 * can verify who is calling. json-server (the mock) simply ignores the header.
 *
 * IMPORTANT: in the real Express API
 *   GET   /bookings/mine          -> only the caller's bookings (customerId comes from the JWT)
 *   PATCH /bookings/:id/cancel    -> must verify (1) the booking belongs to the caller and
 *                                    (2) status is "pending", then set "cancelled"
 * The checks below are for the mock and for good UX; they are NOT a security boundary.
 */

import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/services-api";

export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Booking {
  id: string;
  serviceId: string;
  vendorId: string;
  customerId: string;
  eventDate: string; // YYYY-MM-DD
  eventLocation: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt?: string;
  service: {
    id: string;
    name: string;
    image: string;
    category: string;
    location: string;
    price: number;
    priceType: string;
  } | null;
  vendor: {
    id: string;
    name: string;
    businessName: string;
    image?: string | null;
  } | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await authClient.token();
    return data?.token ? { Authorization: `Bearer ${data.token}` } : {};
  } catch {
    return {};
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(await authHeaders()),
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "Network error");
  }
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  return res.json() as Promise<T>;
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
  cancelledAt?: string;
}
interface RawService {
  id?: string;
  _id?: string;
  name: string;
  image: string;
  images?: string[];
  category: string;
  location: string;
  price: number;
  priceType?: string;
}
interface RawUser {
  id?: string;
  _id?: string;
  name: string;
  businessName?: string;
  image?: string | null;
}

/** The signed-in customer's bookings, newest request first, with service + vendor details attached. */
export async function getMyBookings(
  customerId: string,
  signal?: AbortSignal,
): Promise<Booking[]> {
  const [rows, services, users] = await Promise.all([
    api<RawBooking[]>(
      `/bookings?customerId=${encodeURIComponent(customerId)}`,
      { signal },
    ),
    api<RawService[]>("/services", { signal }),
    api<RawUser[]>("/users", { signal }),
  ]);

  const svc = new Map(services.map((s) => [String(s.id ?? s._id), s]));
  const usr = new Map(users.map((u) => [String(u.id ?? u._id), u]));

  return rows
    .filter((b) => String(b.customerId) === String(customerId)) // never show someone else's rows
    .map<Booking>((b) => {
      const s = svc.get(String(b.serviceId));
      const v = usr.get(String(b.vendorId));
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
        cancelledAt: b.cancelledAt,
        service: s
          ? {
              id: String(s.id ?? s._id),
              name: s.name,
              image: s.images?.[0] ?? s.image,
              category: s.category,
              location: s.location,
              price: s.price,
              priceType: s.priceType ?? "per event",
            }
          : null,
        vendor: v
          ? {
              id: String(v.id ?? v._id),
              name: v.name,
              businessName: v.businessName || v.name,
              image: v.image,
            }
          : null,
      };
    })
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/**
 * Cancel one of the caller's PENDING bookings.
 * Throws ApiError 403 (not yours), 409 (not pending any more), 404 (missing).
 */
export async function cancelBooking(
  id: string,
  customerId: string,
): Promise<{ status: BookingStatus; cancelledAt: string }> {
  const current = await api<RawBooking>(`/bookings/${encodeURIComponent(id)}`);
  if (String(current.customerId) !== String(customerId))
    throw new ApiError(403, "This booking isn't yours.");
  if (current.status !== "pending")
    throw new ApiError(409, `This request is already ${current.status}.`);

  const cancelledAt = new Date().toISOString();
  await api(`/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", cancelledAt }),
  });
  return { status: "cancelled", cancelledAt };
}

// /**
//  * WedPlan - bookings API for the customer dashboard
//  * Place at: lib/bookings-api.ts
//  *
//  * Every request carries the Better Auth JWT (`Authorization: Bearer <token>`), so your Express API
//  * can verify who is calling. json-server (the mock) simply ignores the header.
//  *
//  * IMPORTANT: in the real Express API
//  *   GET   /bookings/mine          -> only the caller's bookings (customerId comes from the JWT)
//  *   PATCH /bookings/:id/cancel    -> must verify (1) the booking belongs to the caller and
//  *                                    (2) status is "pending", then set "cancelled"
//  * The checks below are for the mock and for good UX; they are NOT a security boundary.
//  */

// import { authClient } from "@/lib/auth-client";
// import { API_URL } from "@/lib/services-api";

// export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled";

// export interface Booking {
//   id: string;
//   serviceId: string;
//   vendorId: string;
//   customerId: string;
//   eventDate: string; // YYYY-MM-DD
//   eventLocation: string;
//   message: string;
//   status: BookingStatus;
//   createdAt: string;
//   cancelledAt?: string;
//   service: {
//     id: string;
//     name: string;
//     image: string;
//     category: string;
//     location: string;
//     price: number;
//     priceType: string;
//   } | null;
//   vendor: {
//     id: string;
//     name: string;
//     businessName: string;
//     image?: string | null;
//   } | null;
// }

// export class ApiError extends Error {
//   status: number;
//   constructor(status: number, message: string) {
//     super(message);
//     this.name = "ApiError";
//     this.status = status;
//   }
// }

// async function authHeaders(): Promise<Record<string, string>> {
//   try {
//     const { data } = await authClient.token();
//     return data?.token ? { Authorization: `Bearer ${data.token}` } : {};
//   } catch {
//     return {};
//   }
// }

// async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
//   let res: Response;
//   try {
//     res = await fetch(`${API_URL}${path}`, {
//       ...init,
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         ...(await authHeaders()),
//         ...(init.headers ?? {}),
//       },
//     });
//   } catch (e) {
//     if ((e as Error).name === "AbortError") throw e;
//     throw new ApiError(0, "Network error");
//   }
//   if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
//   return res.json() as Promise<T>;
// }

// interface RawBooking {
//   id?: string;
//   _id?: string;
//   serviceId: string;
//   vendorId: string;
//   customerId: string;
//   eventDate: string;
//   eventLocation: string;
//   message?: string;
//   status: BookingStatus;
//   createdAt: string;
//   cancelledAt?: string;
// }
// interface RawService {
//   id?: string;
//   _id?: string;
//   name: string;
//   image: string;
//   images?: string[];
//   category: string;
//   location: string;
//   price: number;
//   priceType?: string;
// }
// interface RawUser {
//   id?: string;
//   _id?: string;
//   name: string;
//   businessName?: string;
//   image?: string | null;
// }

// /** The signed-in customer's bookings, newest request first, with service + vendor details attached. */
// export async function getMyBookings(
//   customerId: string,
//   signal?: AbortSignal,
// ): Promise<Booking[]> {
//   const [rows, services, users] = await Promise.all([
//     api<RawBooking[]>(
//       `/bookings?customerId=${encodeURIComponent(customerId)}`,
//       { signal },
//     ),
//     api<RawService[]>("/services", { signal }),
//     api<RawUser[]>("/users", { signal }),
//   ]);

//   const svc = new Map(services.map((s) => [String(s.id ?? s._id), s]));
//   const usr = new Map(users.map((u) => [String(u.id ?? u._id), u]));

//   return rows
//     .filter((b) => String(b.customerId) === String(customerId)) // never show someone else's rows
//     .map<Booking>((b) => {
//       const s = svc.get(String(b.serviceId));
//       const v = usr.get(String(b.vendorId));
//       return {
//         id: String(b.id ?? b._id),
//         serviceId: String(b.serviceId),
//         vendorId: String(b.vendorId),
//         customerId: String(b.customerId),
//         eventDate: b.eventDate,
//         eventLocation: b.eventLocation,
//         message: b.message ?? "",
//         status: b.status,
//         createdAt: b.createdAt,
//         cancelledAt: b.cancelledAt,
//         service: s
//           ? {
//               id: String(s.id ?? s._id),
//               name: s.name,
//               image: s.images?.[0] ?? s.image,
//               category: s.category,
//               location: s.location,
//               price: s.price,
//               priceType: s.priceType ?? "per event",
//             }
//           : null,
//         vendor: v
//           ? {
//               id: String(v.id ?? v._id),
//               name: v.name,
//               businessName: v.businessName || v.name,
//               image: v.image,
//             }
//           : null,
//       };
//     })
//     .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
// }

// /**
//  * Cancel one of the caller's PENDING bookings.
//  * Throws ApiError 403 (not yours), 409 (not pending any more), 404 (missing).
//  */
// export async function cancelBooking(
//   id: string,
//   customerId: string,
// ): Promise<{ status: BookingStatus; cancelledAt: string }> {
//   const current = await api<RawBooking>(`/bookings/${encodeURIComponent(id)}`);
//   if (String(current.customerId) !== String(customerId))
//     throw new ApiError(403, "This booking isn't yours.");
//   if (current.status !== "pending")
//     throw new ApiError(409, `This request is already ${current.status}.`);

//   const cancelledAt = new Date().toISOString();
//   await api(`/bookings/${encodeURIComponent(id)}`, {
//     method: "PATCH",
//     body: JSON.stringify({ status: "cancelled", cancelledAt }),
//   });
//   return { status: "cancelled", cancelledAt };
// }
