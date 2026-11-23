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
  /** Machine code from the Express API, e.g. FREE_LIMIT, NOT_PENDING, DUPLICATE_BOOKING. */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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

  if (!res.ok) {
    // The Express API answers { message, code? }: keep its message so the UI can show it.
    let body: { message?: string; code?: string } = {};

    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }

    throw new ApiError(
      res.status,
      body.message ?? `Request failed (${res.status})`,
      body.code,
    );
  }

  return res.json() as Promise<T>;
}

/** The signed-in customer's bookings, newest request first (service and vendor details come from the server). */
export async function getMyBookings(
  _customerId: string,
  signal?: AbortSignal,
): Promise<Booking[]> {
  // void _customerId;

  const rows = await api<Booking[]>("/bookings/mine", { signal });

  return [...rows].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

/**
 * Cancel one of the caller's PENDING bookings (one atomic update on the server).
 * Throws ApiError 403 (not yours), 409 NOT_PENDING (already processed), 404 (missing).
 */
export async function cancelBooking(
  id: string,
  _customerId: string,
): Promise<{ status: BookingStatus; cancelledAt: string }> {
  // void _customerId;

  return api<{ status: BookingStatus; cancelledAt: string }>(
    `/bookings/${encodeURIComponent(id)}/cancel`,
    {
      method: "PATCH",
    },
  );
}
