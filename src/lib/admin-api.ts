/**
 * WedPlan - admin dashboard API
 * Place at: lib/admin-api.ts   (needs lib/bookings-api.ts, which exports the authenticated `api` helper)
 *
 * Every call sends the Better Auth JWT (through `api`). The Express API enforces everything that matters:
 * admin-only routes, no blocking admins or yourself, valid service statuses, and transactions that are
 * READ-ONLY (rows are written only by the verified Stripe webhook). The checks kept here are UX guards.
 */

import { api, ApiError } from "@/lib/bookings-api";
import type { ServiceStatus } from "@/lib/vendor-api";

export { ApiError };
export type { ServiceStatus };

const enc = encodeURIComponent;
const idOf = (r: { id?: string; _id?: string }) => String(r.id ?? r._id);

// users
export type Role = "customer" | "vendor" | "admin";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  isBlocked: boolean;
  businessName: string | null;
  phone: string | null;
  subscriptionPlan: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

interface RawUser {
  id?: string;
  _id?: string;
  name?: string;
  email?: string;
  image?: string | null;
  role?: string;
  isBlocked?: boolean;
  businessName?: string | null;
  phone?: string | null;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | null;
  createdAt?: string;
}

const normUser = (u: RawUser): AdminUser => ({
  id: idOf(u),
  name: u.name || "Unnamed user",
  email: u.email ?? "",
  image: u.image ?? null,
  role: u.role === "admin" || u.role === "vendor" ? u.role : "customer",
  isBlocked: !!u.isBlocked,
  businessName: u.businessName ?? null,
  phone: u.phone ?? null,
  subscriptionPlan: u.subscriptionPlan ?? "free",
  subscriptionExpiresAt: u.subscriptionExpiresAt ?? null,
  createdAt: u.createdAt ?? new Date(0).toISOString(),
});

export async function getUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  const rows = await api<RawUser[]>("/admin/users", { signal });

  return rows
    .map(normUser)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** Block or unblock a user. Admin accounts and your own account can't be blocked. */
export async function setUserBlocked(
  target: AdminUser,
  blocked: boolean,
  currentAdminId: string,
): Promise<void> {
  if (target.role === "admin")
    throw new ApiError(403, "Admin accounts can't be blocked.");

  if (target.id === currentAdminId)
    throw new ApiError(403, "You can't block your own account.");

  await api(`/admin/users/${enc(target.id)}/block`, {
    method: "PATCH",
    body: JSON.stringify({ blocked }),
  });
}

// services
export interface AdminService {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  description: string;
  price: number;
  priceType: string;
  location: string;
  images: string[];
  status: ServiceStatus;
  isActive: boolean;
  createdAt: string;

  vendor: {
    id: string;
    name: string;
    businessName: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface RawService {
  id?: string;
  _id?: string;
  vendorId: string;
  name?: string;
  serviceName?: string;
  category?: string;
  description?: string;
  price?: number;
  priceType?: string;
  location?: string;
  image?: string;
  images?: string[];
  status?: string;
  isActive?: boolean;
  createdAt?: string;
}

const STATUSES: ServiceStatus[] = ["pending", "approved", "rejected"];

/** Every submitted service (all statuses) with its vendor attached, newest first. */
export async function getServices(
  signal?: AbortSignal,
): Promise<AdminService[]> {
  const rows = await api<
    (RawService & {
      vendor?: {
        id: string;
        name: string;
        businessName?: string | null;
        email?: string;
        image?: string | null;
      } | null;
    })[]
  >("/admin/services", { signal });

  return rows
    .map<AdminService>((s) => ({
      id: idOf(s),
      vendorId: String(s.vendorId),
      name: s.name ?? s.serviceName ?? "Untitled service",
      category: s.category ?? "",
      description: s.description ?? "",
      price: s.price ?? 0,
      priceType: s.priceType ?? "per event",
      location: s.location ?? "",
      images: s.images?.length ? s.images : s.image ? [s.image] : [],
      status: STATUSES.includes(s.status as ServiceStatus)
        ? (s.status as ServiceStatus)
        : "pending",
      isActive: s.isActive !== false,
      createdAt: s.createdAt ?? new Date(0).toISOString(),

      vendor: s.vendor
        ? {
            id: s.vendor.id,
            name: s.vendor.name || "Unnamed vendor",
            businessName: s.vendor.businessName ?? null,
            email: s.vendor.email ?? "", // the public vendor shape has no email
            image: s.vendor.image ?? null,
          }
        : null,
    }))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** Approve, reject or move a service back to pending. Only approved + active services reach customers. */
export async function setServiceStatus(
  id: string,
  status: ServiceStatus,
): Promise<void> {
  if (!STATUSES.includes(status)) throw new ApiError(400, "Invalid status.");

  await api(`/admin/services/${enc(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteService(id: string): Promise<void> {
  await api(`/admin/services/${enc(id)}`, { method: "DELETE" });
}

// transactions
export interface AdminTransaction {
  id: string;
  vendorId: string;
  plan: string;
  /** minor units (e.g. cents / poisha), the way Stripe reports them */
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId: string | null;
  status: string;
  createdAt: string;

  vendor: {
    id: string;
    name: string;
    businessName: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface RawTransaction {
  id?: string;
  _id?: string;
  vendorId: string;
  plan?: string;
  amount?: number;
  currency?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string | null;
  status?: string;
  createdAt?: string;
}

/**
 * READ-ONLY on purpose: there is no create / update / delete function for transactions in this file.
 * Records come only from the verified Stripe webhook on the server.
 */
export async function getTransactions(
  signal?: AbortSignal,
): Promise<AdminTransaction[]> {
  const rows = await api<
    (RawTransaction & {
      vendor?: {
        id: string;
        name: string;
        businessName?: string | null;
        email?: string;
        image?: string | null;
      } | null;
    })[]
  >("/admin/transactions", { signal });

  return rows
    .map<AdminTransaction>((t) => ({
      id: idOf(t),
      vendorId: String(t.vendorId),
      plan: t.plan ?? "premium",
      amount: t.amount ?? 0,
      currency: (t.currency ?? "usd").toLowerCase(),
      stripeSessionId: t.stripeSessionId ?? "",
      stripeSubscriptionId: t.stripeSubscriptionId ?? null,
      status: (t.status ?? "pending").toLowerCase(),
      createdAt: t.createdAt ?? new Date(0).toISOString(),

      vendor: t.vendor
        ? {
            id: t.vendor.id,
            name: t.vendor.name || "Unnamed vendor",
            businessName: t.vendor.businessName ?? null,
            email: t.vendor.email ?? "",
            image: t.vendor.image ?? null,
          }
        : null,
    }))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}
