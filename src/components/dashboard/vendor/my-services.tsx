"use client";

/**
 * WedPlan - Vendor "My Services"
 * Place at: components/dashboard/vendor/my-services.tsx
 * Used by: app/dashboard/vendor/services/page.tsx
 *
 * Vendor can: view service information, update (opens the edit form), delete (with confirmation),
 * see the approval status, and manage availability (on / off switch).
 * Rules: a rejected service is hidden from customers and can't be switched on; on the Free plan only
 * 3 services may be active at once. The server must enforce all of this too.
 */

import {
  Modal,
  PageHeader,
  formatDate,
  money,
} from "@/components/dashboard/customer/customer-shared";
import {
  FREE_LIMIT,
  SERVICE_STATUS,
  ServiceStatusBadge,
  activeCount,
  categoryMeta,
  countsAsActive,
  isPremium,
  useVendorServices,
  useVendorUser,
} from "@/components/dashboard/vendor/vendor-shared";
import { useTilt } from "@/components/home/section-kit";
import FancySelect, { type SelectOption } from "@/components/ui/fancy-select";
import {
  ApiError,
  deleteService,
  setServiceActive,
  type VendorService,
} from "@/lib/vendor-api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpDown,
  Boxes,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  Star,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Filter = "all" | "approved" | "pending" | "rejected" | "off";
type Sort = "newest" | "price-asc" | "price-desc" | "rating";
const SORTS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

/* 3D toggle switch */
function Switch({
  on,
  disabled,
  busy,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative h-8 w-14 shrink-0 rounded-full border outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-transparent bg-linear-to-r from-(--logo-from) to-brand shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]" : "border-border bg-muted shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 grid h-7 w-7 place-items-center rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.3)]"
        style={{ left: on ? "calc(100% - 1.875rem)" : "0.125rem" }}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />}
      </motion.span>
    </button>
  );
}

function ServiceCard({
  s,
  index,
  busy,
  onToggle,
  onView,
  onDelete,
}: {
  s: VendorService;
  index: number;
  busy: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  // console.log("Service", s);

  const { ref, reduce, style, glare, handlers } = useTilt(6, 16);
  const [ok, setOk] = useState(true);
  const m = categoryMeta(s.category);
  const live = s.status === "approved" && s.isActive;
  const rejected = s.status === "rejected";

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.9, transition: { duration: 0.16 } }
      }
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 18,
        delay: Math.min(index, 6) * 0.05,
      }}
      className="perspective-distant"
    >
      <motion.article
        ref={ref}
        {...handlers}
        whileHover={reduce ? undefined : { y: -6 }}
        style={style}
        className={`group relative h-full overflow-visible rounded-3xl border bg-card shadow-lg transition-shadow duration-500 hover:shadow-2xl hover:shadow-brand/15 ${rejected ? "border-destructive/30" : "border-border"}`}
      >
        <div className="relative aspect-video overflow-hidden rounded-t-3xl bg-muted">
          {ok && s.image ? (
            <Image
              src={s.image}
              alt={s.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
              onError={() => setOk(false)}
              className={`object-cover transition-transform duration-700 group-hover:scale-110 ${!s.isActive || rejected ? "grayscale-60" : ""}`}
            />
          ) : (
            <div
              className="grid h-full place-items-center text-white"
              style={{
                background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
              }}
            >
              <m.icon className="h-10 w-10 opacity-80" />
            </div>
          )}

          <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />

          <motion.div
            aria-hidden
            style={{ background: glare }}
            className="absolute inset-0 mix-blend-soft-light"
          />
        </div>

        <span
          className="absolute left-4 top-4"
          style={{ transform: "translateZ(50px)" }}
        >
          <ServiceStatusBadge
            status={s.status}
            className="shadow-lg ring-2 ring-card"
          />
        </span>

        <span
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-neutral-950/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md"
          style={{ transform: "translateZ(55px)" }}
        >
          {live ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />{" "}
              Live
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" /> Hidden
            </>
          )}
        </span>

        <div className="p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <m.icon className="h-3.5 w-3.5" style={{ color: m.to }} />{" "}
            {s.category}
          </p>
          <h3
            className="mt-1 line-clamp-1 font-serif text-lg font-semibold"
            style={{ transform: "translateZ(24px)" }}
          >
            {s.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-brand" /> {s.location}
            </span>

            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-gold text-gold" />{" "}
              {s.rating ? s.rating.toFixed(1) : "New"}
              {s.reviewCount > 0 && (
                <span className="text-xs">({s.reviewCount})</span>
              )}
            </span>
          </div>

          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="font-serif text-2xl font-bold text-brand">
              {money(s.price)}
            </span>
            <span className="text-xs text-muted-foreground">{s.priceType}</span>
          </p>

          <div
            className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border p-3 ${rejected ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/40"}`}
          >
            <div className="min-w-0 text-xs">
              <p className="font-semibold">
                {rejected
                  ? "Not available"
                  : s.isActive
                    ? "Available to customers"
                    : "Switched off"}
              </p>

              <p className="truncate text-muted-foreground">
                {rejected
                  ? "Rejected by admin"
                  : s.status === "pending"
                    ? "Visible after approval"
                    : s.isActive
                      ? "Customers can book it"
                      : "Hidden from customers"}
              </p>
            </div>

            <Switch
              on={s.isActive && !rejected}
              disabled={rejected}
              busy={busy}
              onChange={onToggle}
              label={`${s.isActive ? "Switch off" : "Switch on"} ${s.name}`}
            />
          </div>

          <div
            className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
            style={{ transform: "translateZ(25px)" }}
          >
            <motion.button
              type="button"
              onClick={onView}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-4 py-2.5 text-xs font-semibold text-(--logo-fg) shadow-md shadow-brand/25"
            >
              <Eye className="h-4 w-4" /> Details
            </motion.button>

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                href={`/dashboard/vendor/services/${s.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-xs font-semibold transition-colors hover:border-brand/50 hover:bg-brand-soft"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </motion.div>

            <motion.button
              type="button"
              onClick={onDelete}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-4 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </motion.button>
          </div>
        </div>
      </motion.article>
    </motion.li>
  );
}

function DetailsDialog({
  s,
  onClose,
}: {
  s: VendorService | null;
  onClose: () => void;
}) {
  const [last, setLast] = useState<VendorService | null>(null);
  const [i, setI] = useState(0);
  const cur = s ?? last;
  if (s && s !== last) {
    setLast(s);
    setI(0);
  }

  const st = cur ? SERVICE_STATUS[cur.status] : null;

  return (
    <Modal open={!!s} onClose={onClose} label="Service information" wide>
      {cur && st && (
        <div>
          <div className="relative aspect-16/8 overflow-hidden bg-muted perspective-[900px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={cur.images[i]}
                initial={{ opacity: 0, rotateY: 20 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <Image
                  src={cur.images[i]}
                  alt={`${cur.name}, photo ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

            <div className="absolute inset-x-6 bottom-4 flex items-end justify-between gap-3 text-white">
              <h2 className="truncate font-serif text-2xl font-semibold">
                {cur.name}
              </h2>
              <ServiceStatusBadge
                status={cur.status}
                className="shrink-0 bg-white/95! !text-neutral-900!"
              />
            </div>
          </div>

          {cur.images.length > 1 && (
            <div className="flex gap-2 px-6 pt-4 sm:px-8">
              {cur.images.map((u, k) => (
                <button
                  key={u}
                  type="button"
                  aria-label={`Photo ${k + 1}`}
                  onClick={() => setI(k)}
                  className={`relative h-14 w-20 overflow-hidden rounded-xl ring-2 transition ${k === i ? "ring-brand" : "opacity-60 ring-transparent hover:opacity-100"}`}
                >
                  <Image
                    src={u}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Category", cur.category],
                ["Location", cur.location],
                ["Price", `${money(cur.price)} ${cur.priceType}`],
                ["Created", formatDate(cur.createdAt)],
                ["Availability", cur.isActive ? "Switched on" : "Switched off"],
                [
                  "Rating",
                  cur.rating
                    ? `${cur.rating.toFixed(1)} (${cur.reviewCount})`
                    : "No reviews yet",
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted/50 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {k}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-semibold">Description</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {cur.description || "No description."}
              </p>
            </div>

            <p
              className={`flex items-start gap-2 rounded-2xl p-3.5 text-sm ${st.chip}`}
            >
              <st.icon className="mt-0.5 h-4 w-4 shrink-0" /> {st.note}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4 sm:px-8">
            {cur.status === "approved" && cur.isActive && (
              <Link
                href={`/services/${cur.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-accent"
              >
                View public page
              </Link>
            )}

            <Link
              href={`/dashboard/vendor/services/${cur.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
            >
              <Pencil className="h-4 w-4" /> Edit service
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function MyServices() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user } = useVendorUser();
  const premium = isPremium(user);
  const { services, setServices, error, reload } = useVendorServices(user?.id);

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [viewing, setViewing] = useState<VendorService | null>(null);
  const [deleting, setDeleting] = useState<VendorService | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const used = services ? activeCount(services) : 0;

  const counts = useMemo(() => {
    const c = { all: 0, approved: 0, pending: 0, rejected: 0, off: 0 };

    services?.forEach((s) => {
      c.all++;
      c[s.status]++;
      if (!s.isActive) c.off++;
    });

    return c;
  }, [services]);

  const list = useMemo(() => {
    if (!services) return [];
    const needle = q.trim().toLowerCase();

    const out = services.filter(
      (s) =>
        (filter === "all" ||
          (filter === "off" ? !s.isActive : s.status === filter)) &&
        (!needle || s.name.toLowerCase().includes(needle)),
    );

    const by: Record<Sort, (a: VendorService, b: VendorService) => number> = {
      newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
    };

    return [...out].sort(by[sort]);
  }, [services, filter, q, sort]);

  const toggle = async (s: VendorService) => {
    if (!user) return;
    const next = !s.isActive;

    if (next && !premium && used >= FREE_LIMIT && !countsAsActive(s)) {
      toast.error("Free plan limit reached", {
        description: `Free vendors can have ${FREE_LIMIT} active services.`,
        action: {
          label: "Upgrade",
          onClick: () => router.push("/dashboard/vendor/subscription"),
        },
      });

      return;
    }

    setToggling(s.id);
    setServices(
      (p) => p?.map((x) => (x.id === s.id ? { ...x, isActive: next } : x)) ?? p,
    ); // optimistic

    try {
      await setServiceActive(s.id, user.id, next);
      toast.success(next ? "Service switched on" : "Service switched off", {
        description: next
          ? "Customers can see it once it is approved."
          : "It is now hidden from customers.",
      });
    } catch (e) {
      setServices(
        (p) =>
          p?.map((x) => (x.id === s.id ? { ...x, isActive: s.isActive } : x)) ??
          p,
      ); // roll back
      toast.error("Couldn't change availability", {
        description:
          e instanceof ApiError && e.status === 409
            ? e.message
            : "Please try again.",
      });
    } finally {
      setToggling(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || !user) return;
    setDelBusy(true);

    try {
      await deleteService(deleting.id, user.id);
      setServices((p) => p?.filter((x) => x.id !== deleting.id) ?? p);
      toast.success("Service deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Couldn't delete the service", {
        description:
          e instanceof ApiError && e.status === 403
            ? "You can only delete your own services."
            : "Please try again.",
      });
    } finally {
      setDelBusy(false);
    }
  };

  const tabs: { k: Filter; l: string }[] = [
    { k: "all", l: "All" },
    { k: "approved", l: "Approved" },
    { k: "pending", l: "Pending" },
    { k: "rejected", l: "Rejected" },
    { k: "off", l: "Switched off" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Your listings"
        title="My Services"
        subtitle="Manage everything you offer: edit details, switch availability and track admin approval."
      >
        <Link
          href="/dashboard/vendor/services/new"
          className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-6 py-3 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30"
        >
          <PackagePlus className="h-4 w-4" /> Add service
        </Link>
      </PageHeader>

      {/* usage */}
      {services && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-card/80 p-4 backdrop-blur sm:p-5"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            {premium ? (
              <Crown className="h-5 w-5" />
            ) : (
              <Boxes className="h-5 w-5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {premium
                ? `Premium: ${used} active, no limit`
                : `${used} of ${FREE_LIMIT} active services used (Free plan)`}
            </p>

            {!premium && (
              <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (used / FREE_LIMIT) * 100)}%`,
                  }}
                  className={`h-full rounded-full ${used >= FREE_LIMIT ? "bg-destructive" : "bg-linear-to-r from-(--logo-from) to-(--logo-to)"}`}
                />
              </div>
            )}
          </div>

          {!premium && (
            <Link
              href="/dashboard/vendor/subscription"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Upgrade for unlimited
            </Link>
          )}
        </motion.div>
      )}

      {/* controls */}
      <div className="relative z-20 mb-8 space-y-4 rounded-3xl border border-border bg-card/90 p-4 shadow-lg backdrop-blur sm:p-5">
        <div
          role="tablist"
          aria-label="Filter services"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {tabs.map((t) => {
            const on = filter === t.k;
            return (
              <button
                key={t.k}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(t.k)}
                className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand ${on ? "text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {on && (
                  <motion.span
                    layoutId="svc-tab"
                    className="absolute inset-0 rounded-full bg-linear-to-r from-(--logo-from) to-brand shadow-md shadow-brand/30"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}

                <span className="relative flex items-center gap-2">
                  {t.l}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-white/25" : "bg-muted"}`}
                  >
                    {counts[t.k]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <div>
            <label
              htmlFor="ms-search"
              className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Search
            </label>

            <div className="group relative">
              {/* Search */}
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-brand" />

              <input
                id="ms-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your services…"
                autoComplete="off"
                className="h-14 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/70 focus:border-brand focus:ring-4 focus:ring-brand/20 [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
          </div>

          {/* Sort */}
          <FancySelect
            label="Sort by"
            icon={ArrowUpDown}
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={SORTS}
          />
        </div>
      </div>

      {/* results */}
      <div className="relative z-0">
        {error ? (
          <div className="mx-auto max-w-md rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-semibold text-destructive">{error}</p>

            <button
              type="button"
              onClick={reload}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : services === null ? (
          <ul
            className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3"
            aria-busy="true"
            aria-label="Loading services"
          >
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="overflow-hidden rounded-3xl border border-border bg-card"
              >
                <div className="aspect-video animate-pulse bg-muted" />

                <div className="space-y-3 p-5">
                  <div className="h-5 w-3/5 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                  <div className="h-16 animate-pulse rounded-2xl bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        ) : list.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center"
          >
            <motion.span
              animate={reduce ? undefined : { rotate: [-8, 8, -8] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand"
            >
              {services.length === 0 ? (
                <Boxes className="h-8 w-8" />
              ) : (
                <SearchX className="h-8 w-8" />
              )}
            </motion.span>

            <h2 className="mt-5 font-serif text-xl font-semibold">
              {services.length === 0 ? "No services yet" : "No services match"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {services.length === 0
                ? "Add your first service to start receiving booking requests."
                : "Try another filter or clear the search."}
            </p>

            {services.length === 0 ? (
              <Link
                href="/dashboard/vendor/services/new"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
              >
                <PackagePlus className="h-4 w-4" /> Add service
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQ("");
                }}
                className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
              >
                Clear filters
              </button>
            )}
          </motion.div>
        ) : (
          <motion.ul
            layout={!reduce}
            className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3"
          >
            <AnimatePresence mode="popLayout">
              {list.map((s, i) => (
                <ServiceCard
                  key={s.id}
                  s={s}
                  index={i}
                  busy={toggling === s.id}
                  onToggle={() => toggle(s)}
                  onView={() => setViewing(s)}
                  onDelete={() => setDeleting(s)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <DetailsDialog s={viewing} onClose={() => setViewing(null)} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        label="Delete service"
        busy={delBusy}
      >
        {deleting && (
          <div className="p-7 text-center sm:p-9">
            <motion.span
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive"
            >
              <Trash2 className="h-8 w-8" />
            </motion.span>
            <h2 className="mt-5 font-serif text-2xl font-semibold">
              Delete this service?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <b className="text-foreground">{deleting.name}</b> will be removed
              permanently and customers won&apos;t be able to find it. This
              can&apos;t be undone.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={delBusy}
                className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
              >
                Keep it
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={delBusy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-destructive/30 disabled:opacity-80"
              >
                {delBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Yes, delete"
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
