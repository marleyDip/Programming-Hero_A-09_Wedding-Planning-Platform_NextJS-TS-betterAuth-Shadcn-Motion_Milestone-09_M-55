"use client";

/**
 * WedPlan - Service Details (/services/[id])
 * Place at: components/services/service-details.tsx   (rendered by app/services/[id]/page.tsx)
 * Needs: components/home/section-kit.tsx, lib/services-api.ts, lib/auth-client.ts, sonner
 *
 * Follows the assignment rules:
 *  - PRIVATE page: signed-out visitors are sent to /signin?redirect=/services/<id>
 *  - Shows name, multiple images, category, description, price, location, vendor info, booking option
 *  - Invalid id            -> "Service not found" state
 *  - Not approved / active -> "Not available" state (cannot be booked)
 *  - Booking is disabled for admins, blocked users and the service's own vendor
 *  - Booking form: event date, event location, additional message. Customer + vendor are identified
 *    automatically. Past dates and duplicate active requests (same service + date) are rejected.
 *    Status is saved as "pending". Success / error feedback uses toasts (no alert()).
 *  NOTE: every rule above is also enforced on the Express server in production.
 *
 * 3D / motion: tilting gallery with flip transitions between photos, glare, floating chips at
 * different depths, lightbox, flip-open booking dialog, animated success check, scroll reveals.
 */

import { SectionBackdrop, useTilt } from "@/components/home/section-kit";
import { authClient } from "@/lib/auth-client";
import
    {
        ServiceError,
        createBooking,
        getAllServices,
        getServiceById,
        hasActiveBooking,
        type Service,
        type ServiceDetail,
    } from "@/lib/services-api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import
    {
        AlertTriangle,
        ArrowLeft,
        ArrowRight,
        ArrowUpRight,
        Building2,
        CalendarCheck,
        CalendarDays,
        Camera,
        Check,
        ChevronLeft,
        ChevronRight,
        Crown,
        Expand,
        Flower2,
        LayoutGrid,
        Loader2,
        Lock,
        MapPin,
        MessageSquare,
        SearchX,
        Send,
        Share2,
        ShieldCheck,
        Shirt,
        Sparkles,
        Star,
        UtensilsCrossed,
        X,
        type LucideIcon,
    } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; from: string; to: string }
> = {
  "Photography & Videography": {
    icon: Camera,
    from: "oklch(0.7 0.16 305)",
    to: "oklch(0.45 0.2 285)",
  },
  "Wedding Venues": {
    icon: Building2,
    from: "oklch(0.74 0.15 28)",
    to: "oklch(0.5 0.21 10)",
  },
  "Decoration & Florist": {
    icon: Flower2,
    from: "oklch(0.84 0.13 80)",
    to: "oklch(0.6 0.17 40)",
  },
  "Catering Services": {
    icon: UtensilsCrossed,
    from: "oklch(0.76 0.14 155)",
    to: "oklch(0.48 0.12 180)",
  },
  "Makeup & Styling": {
    icon: Sparkles,
    from: "oklch(0.78 0.16 350)",
    to: "oklch(0.5 0.22 335)",
  },
  "Wedding Fashion": {
    icon: Shirt,
    from: "oklch(0.72 0.19 20)",
    to: "oklch(0.46 0.2 0)",
  },
};

const FALLBACK = {
  icon: LayoutGrid,
  from: "oklch(0.72 0.14 230)",
  to: "oklch(0.46 0.16 255)",
};

const metaOf = (c: string) => CATEGORY_META[c] ?? FALLBACK;
const money = (n: number) => `৳${n.toLocaleString("en-US")}`;
const todayISO = () => new Date().toLocaleDateString("en-CA");

// Shared bits
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ type: "spring", stiffness: 90, damping: 18, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span
      className="flex gap-0.5"
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < Math.round(value) ? "fill-gold text-gold" : "text-border"}`}
        />
      ))}
    </span>
  );
}

function StateScreen({
  icon: Icon,
  title,
  text,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  actions: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative grid min-h-[70vh] place-items-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: -18 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        style={{ transformPerspective: 1000 }}
        transition={{ type: "spring", stiffness: 100, damping: 16 }}
        className="max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-2xl shadow-brand/10"
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -8, 0], rotate: [-4, 4, -4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-brand-soft text-brand shadow-lg"
        >
          <Icon className="h-10 w-10" strokeWidth={1.5} />
        </motion.div>

        <h1 className="mt-6 font-serif text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {text}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {actions}
        </div>
      </motion.div>
    </div>
  );
}

const btnPrimary =
  "inline-flex items-center gap-2 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-6 py-3 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30";
const btnGhost =
  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:border-brand/50 hover:bg-brand-soft";

function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading service"
    >
      <div className="mb-8 h-4 w-64 animate-pulse rounded bg-muted" />

      <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="aspect-4/3 animate-pulse rounded-3xl bg-muted" />

          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-4/3 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />

          <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />

          <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />

          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

// Gallery
function Gallery({
  s,
  onOpen,
  index,
  setIndex,
}: {
  s: ServiceDetail;
  onOpen: () => void;
  index: number;
  setIndex: (i: number) => void;
}) {
  const { ref, reduce, style, glare, handlers } = useTilt(7, 18);

  const [dir, setDir] = useState(1);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const m = metaOf(s.category);
  const n = s.images.length;

  const go = useCallback(
    (to: number) => {
      const next = ((to % n) + n) % n;
      setDir(next >= index ? 1 : -1);
      setIndex(next);
    },
    [n, index, setIndex],
  );

  const bad = (i: number) => setFailed((p) => new Set(p).add(i));

  return (
    <div>
      <div
        className="relative perspective:[1400px]"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
        aria-label="Service photo gallery"
      >
        <motion.div
          ref={ref}
          {...handlers}
          style={style}
          className="relative aspect-4/3 rounded-3xl shadow-2xl shadow-black/25"
        >
          <div className="absolute inset-0 overflow-hidden rounded-3xl border border-border bg-muted">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={index}
                custom={dir}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, rotateY: dir * 28, scale: 1.06 }
                }
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, rotateY: dir * -28, scale: 0.96 }
                }
                transition={{ type: "spring", stiffness: 130, damping: 20 }}
                style={{ transformPerspective: 1200 }}
                className="absolute inset-0"
              >
                {failed.has(index) ? (
                  <div
                    className="grid h-full w-full place-items-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                    }}
                  >
                    <m.icon
                      className="h-20 w-20 opacity-80"
                      strokeWidth={1.2}
                    />
                  </div>
                ) : (
                  <Image
                    src={s.images[index]}
                    alt={`${s.name}, photo ${index + 1} of ${n}`}
                    fill
                    loading="eager"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={index === 0}
                    onError={() => bad(index)}
                    className="object-cover"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/10" />

            <motion.div
              aria-hidden
              style={{ background: glare }}
              className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            />
          </div>

          {/* floating chips */}
          <span
            className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
              transform: "translateZ(50px)",
            }}
          >
            <m.icon className="h-4 w-4" /> {s.category}
          </span>

          <button
            type="button"
            onClick={onOpen}
            aria-label="Open photo in full screen"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-neutral-950/50 text-white backdrop-blur-md transition-transform hover:scale-110"
            style={{ transform: "translateZ(60px)" }}
          >
            <Expand className="h-4 w-4" />
          </button>

          <span
            className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-neutral-950/50 px-3 py-1.5 font-mono text-xs text-white backdrop-blur-md"
            style={{ transform: "translateZ(40px)" }}
          >
            {index + 1} / {n}
          </span>

          {n > 1 && (
            <div
              className="absolute bottom-5 right-5 flex gap-2"
              style={{ transform: "translateZ(60px)" }}
            >
              {[
                { d: -1, I: ChevronLeft, l: "Previous photo" },
                { d: 1, I: ChevronRight, l: "Next photo" },
              ].map(({ d, I, l }) => (
                <button
                  key={l}
                  type="button"
                  aria-label={l}
                  onClick={() => go(index + d)}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-neutral-900 shadow-xl transition-transform hover:scale-110 active:scale-95"
                >
                  <I className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {n > 1 && (
        <div
          className="mt-4 grid grid-cols-4 gap-3"
          role="tablist"
          aria-label="Choose photo"
        >
          {s.images.map((src, i) => (
            <button
              key={src + i}
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => go(i)}
              className="relative aspect-4/3 overflow-hidden rounded-2xl outline-none transition-transform hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-brand/40"
            >
              {failed.has(i) ? (
                <span
                  className="block h-full w-full"
                  style={{
                    background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                  }}
                />
              ) : (
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 25vw, 150px"
                  loading="lazy"
                  onError={() => bad(i)}
                  className={`object-cover transition-opacity ${
                    i === index ? "" : "opacity-60 hover:opacity-100"
                  }`}
                />
              )}

              {i === index && (
                <motion.span
                  layoutId="thumb-ring"
                  className="absolute inset-0 rounded-2xl ring-4 ring-inset ring-brand"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({
  s,
  index,
  setIndex,
  onClose,
}: {
  s: ServiceDetail;
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
}) {
  const n = s.images.length;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((index + 1) % n);
      if (e.key === "ArrowLeft") setIndex((index - 1 + n) % n);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, n, onClose, setIndex]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-90 grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <AnimatePresence mode="wait">
        {}
        <motion.img
          key={index}
          src={s.images[index]}
          alt={`${s.name}, photo ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, rotateY: 14 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          style={{ transformPerspective: 1200 }}
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
        />
      </AnimatePresence>

      {n > 1 &&
        [
          { d: -1, I: ChevronLeft, side: "left-4", l: "Previous photo" },
          { d: 1, I: ChevronRight, side: "right-4", l: "Next photo" },
        ].map(({ d, I, side, l }) => (
          <button
            key={l}
            type="button"
            aria-label={l}
            onClick={(e) => {
              e.stopPropagation();
              setIndex((index + d + n) % n);
            }}
            className={`absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/25 ${side}`}
          >
            <I className="h-6 w-6" />
          </button>
        ))}

      <span className="absolute bottom-5 font-mono text-xs text-white/70">
        {index + 1} / {n}
      </span>
    </motion.div>
  );
}

// Booking dialog
interface Errors {
  eventDate?: string;
  eventLocation?: string;
  message?: string;
}

function BookingDialog({
  s,
  customerId,
  onClose,
}: {
  s: ServiceDetail;
  customerId: string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const firstRef = useRef<HTMLInputElement>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState(s.location);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstRef.current?.focus();

    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && !busy && onClose();

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  const validate = (): Errors => {
    const e: Errors = {};

    if (!eventDate) e.eventDate = "Please choose your event date.";
    else if (eventDate < todayISO())
      e.eventDate = "The event date can't be in the past.";

    if (eventLocation.trim().length < 3)
      e.eventLocation = "Please enter where the event will be held.";
    if (message.length > 500)
      e.message = "Keep your message under 500 characters.";

    return e;
  };

  const submit = async (ev: React.SubmitEvent<HTMLFormElement>) => {
    ev.preventDefault();

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);

    try {
      if (await hasActiveBooking(s.id, customerId, eventDate)) {
        setErrors({
          eventDate:
            "You already have an active request for this service on this date.",
        });
        toast.error("Duplicate request", {
          description:
            "You already have a pending or accepted request for this date.",
        });
        return;
      }

      await createBooking({
        serviceId: s.id,
        vendorId: s.vendor.id,
        customerId,
        eventDate,
        eventLocation: eventLocation.trim(),
        message: message.trim(),
      });

      setDone(true);

      toast.success("Booking request sent", {
        description: `${s.vendor.businessName} will review it soon.`,
      });
    } catch {
      toast.error("Couldn't send your request", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const field = (err?: string) =>
    `w-full rounded-2xl border bg-background px-4 py-3.5 text-sm font-medium outline-none transition-all focus:ring-4 ${
      err
        ? "border-destructive focus:ring-destructive/20"
        : "border-border focus:border-brand focus:ring-brand/20"
    }`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
      className="fixed inset-0 z-80 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Request booking for ${s.name}`}
        onClick={(e) => e.stopPropagation()}
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, rotateX: -22, y: 60, scale: 0.94 }
        }
        animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
        exit={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, rotateX: 14, y: 30, scale: 0.96 }
        }
        transition={{ type: "spring", stiffness: 140, damping: 20 }}
        style={{ transformPerspective: 1400, transformOrigin: "50% 100%" }}
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-4xl border border-border bg-card shadow-2xl"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-linear-to-r from-(--logo-from) to-(--logo-to)" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-brand hover:text-brand-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center sm:p-10"
            >
              <div className="relative mx-auto grid h-24 w-24 place-items-center">
                {[0, 1].map((i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute inset-0 rounded-full border-2 border-success"
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      delay: i * 0.6,
                    }}
                  />
                ))}

                <motion.span
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                  className="grid h-20 w-20 place-items-center rounded-full bg-success text-white shadow-xl"
                >
                  <Check className="h-10 w-10" strokeWidth={3} />
                </motion.span>
              </div>

              <h2 className="mt-6 font-serif text-2xl font-semibold">
                Request sent!
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Your request for <b className="text-foreground">{s.name}</b> is
                now <b className="text-foreground">pending</b>. You can track
                it, or cancel it while it is pending, from your dashboard.
              </p>

              <dl className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-3 rounded-2xl bg-muted/60 p-4 text-left text-xs">
                <div>
                  <dt className="text-muted-foreground">Event date</dt>
                  <dd className="mt-0.5 font-semibold">{eventDate}</dd>
                </div>

                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="mt-0.5 truncate font-semibold">
                    {eventLocation}
                  </dd>
                </div>
              </dl>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard" className={btnPrimary}>
                  View my bookings <ArrowRight className="h-4 w-4" />
                </Link>
                <button type="button" onClick={onClose} className={btnGhost}>
                  Keep browsing
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              noValidate
              exit={{ opacity: 0 }}
              className="p-6 sm:p-8"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">
                Booking request
              </p>
              <h2 className="mt-1 pr-10 font-serif text-2xl font-semibold leading-snug">
                {s.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.vendor.businessName} · {money(s.price)}{" "}
                <span className="text-xs">{s.priceType}</span>
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="bk-date"
                    className="mb-1.5 flex items-center gap-2 text-sm font-semibold"
                  >
                    <CalendarDays className="h-4 w-4 text-brand" /> Event date
                  </label>

                  <input
                    ref={firstRef}
                    id="bk-date"
                    type="date"
                    min={todayISO()}
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      setErrors((p) => ({ ...p, eventDate: undefined }));
                    }}
                    aria-invalid={!!errors.eventDate}
                    aria-describedby={
                      errors.eventDate ? "bk-date-err" : undefined
                    }
                    className={field(errors.eventDate)}
                  />

                  {errors.eventDate && (
                    <p
                      id="bk-date-err"
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-destructive"
                    >
                      {errors.eventDate}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="bk-loc"
                    className="mb-1.5 flex items-center gap-2 text-sm font-semibold"
                  >
                    <MapPin className="h-4 w-4 text-brand" /> Event location
                  </label>

                  <input
                    id="bk-loc"
                    type="text"
                    value={eventLocation}
                    onChange={(e) => {
                      setEventLocation(e.target.value);
                      setErrors((p) => ({ ...p, eventLocation: undefined }));
                    }}
                    placeholder="Venue name or address"
                    aria-invalid={!!errors.eventLocation}
                    aria-describedby={
                      errors.eventLocation ? "bk-loc-err" : undefined
                    }
                    className={field(errors.eventLocation)}
                  />

                  {errors.eventLocation && (
                    <p
                      id="bk-loc-err"
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-destructive"
                    >
                      {errors.eventLocation}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="bk-msg"
                    className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-brand" />{" "}
                      Additional message{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </span>

                    <span
                      className={`font-mono text-xs font-normal ${message.length > 500 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {message.length}/500
                    </span>
                  </label>

                  <textarea
                    id="bk-msg"
                    rows={4}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setErrors((p) => ({ ...p, message: undefined }));
                    }}
                    placeholder="Tell the vendor about your event, guest count or special requests…"
                    aria-invalid={!!errors.message}
                    className={`${field(errors.message)} resize-none`}
                  />

                  {errors.message && (
                    <p
                      role="alert"
                      className="mt-1.5 text-xs font-medium text-destructive"
                    >
                      {errors.message}
                    </p>
                  )}
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={busy}
                whileHover={busy ? undefined : { scale: 1.02 }}
                whileTap={busy ? undefined : { scale: 0.97 }}
                className={`${btnPrimary} mt-7 w-full justify-center py-4 disabled:cursor-not-allowed disabled:opacity-80`}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending
                    request…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send booking request
                  </>
                )}
              </motion.button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Free to request. The
                vendor will accept or reject it.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// Similar services
function SimilarCard({ s }: { s: Service }) {
  const { ref, reduce, style, glare, handlers } = useTilt(9, 16);
  const [ok, setOk] = useState(true);
  const m = metaOf(s.category);
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -6 }}
      className="perspective:[1000px]"
    >
      <Link
        href={`/services/${s.id}`}
        className="group block rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
      >
        <motion.article
          ref={ref}
          {...handlers}
          style={style}
          className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-lg transition-shadow group-hover:shadow-2xl group-hover:shadow-brand/20"
        >
          <div className="relative aspect-16/10 overflow-hidden">
            {ok ? (
              <Image
                src={s.image}
                alt={s.name ?? "Service image"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                loading="lazy"
                onError={() => setOk(false)}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div
                className="grid h-full place-items-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                }}
              >
                <m.icon className="h-10 w-10" />
              </div>
            )}

            <motion.div
              aria-hidden
              style={{ background: glare }}
              className="absolute inset-0 mix-blend-soft-light"
            />
          </div>

          <div className="p-4">
            <h3 className="line-clamp-1 font-serif text-base font-semibold">
              {s.name}
            </h3>
            <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                {s.location}
              </span>
              <b className="text-sm text-brand">{money(s.price)}</b>
            </p>
          </div>
        </motion.article>
      </Link>
    </motion.div>
  );
}

// Page
export default function ServiceDetails({ id }: { id: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data: session, isPending } = authClient.useSession();

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<ServiceError | null>(null);
  const [similar, setSimilar] = useState<Service[]>([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [booking, setBooking] = useState(false);

  // private route: send signed-out visitors to Sign In and bring them back after
  useEffect(() => {
    if (!isPending && !session)
      router.replace(
        `/signin?redirect=${encodeURIComponent(`/services/${id}`)}`,
      );
  }, [isPending, session, router, id]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      getServiceById(id, signal)
        .then((loadedService) => {
          setError(null);
          setService(loadedService);
          setImgIndex(0);
        })
        .catch((e) => {
          if (e?.name === "AbortError") return;
          setService(null);
          setError(
            e instanceof ServiceError
              ? e
              : new ServiceError("network", "Something went wrong."),
          );
        });
    },
    [id],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);

    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    if (!service) return;

    const ctrl = new AbortController();
    getAllServices(ctrl.signal)
      .then((all) => {
        const others = all.filter((x) => x.id !== service.id);
        const same = others.filter((x) => x.category === service.category);
        const rest = others.filter(
          (x) =>
            x.category !== service.category && x.location === service.location,
        );
        setSimilar([...same, ...rest].slice(0, 3));
      })
      .catch(() => undefined);

    return () => ctrl.abort();
  }, [service]);

  const user = session?.user as
    | { id: string; name?: string; role?: string; isBlocked?: boolean }
    | undefined;

  const block = useMemo(() => {
    if (!user || !service) return null;

    if (user.isBlocked)
      return "Your account is blocked, so booking is unavailable.";
    if (user.role === "admin")
      return "Admins can't submit customer booking requests.";
    if (user.role === "vendor")
      return "Vendor accounts cannot submit booking requests. Please use a customer account to book services.";
    if (user.id === service.vendor.id)
      return "This is your own service, so you can't book it.";

    // if (user.role === "vendor") return "A vendor can not booking other booking Requests.";
    // if (user.role === "vendor") return "Vendors cannot book services. Vendors cannot make bookings.";

    return null;
  }, [user, service]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  // states
  if (isPending || !session) return <PageSkeleton />;

  if (error) {
    const map = {
      "not-found": {
        icon: SearchX,
        title: "Service not found",
        text: "We couldn't find a service with this ID. The link may be wrong or the service may have been removed.",
      },
      unavailable: {
        icon: Lock,
        title: "Not available for booking",
        text: "This service isn't approved and active right now, so it can't be viewed or booked.",
      },
      network: {
        icon: AlertTriangle,
        title: "Something went wrong",
        text: "We couldn't load this service. Please check your connection and try again.",
      },
    }[error.code];

    return (
      <StateScreen
        icon={map.icon}
        title={map.title}
        text={map.text}
        actions={
          <>
            <Link href="/services" className={btnPrimary}>
              <ArrowLeft className="h-4 w-4" /> Browse services
            </Link>

            {error.code === "network" && (
              <button type="button" onClick={() => load()} className={btnGhost}>
                Try again
              </button>
            )}
          </>
        }
      />
    );
  }

  if (!service) return <PageSkeleton />;

  const m = metaOf(service.category);
  const premium = service.vendor.subscriptionPlan === "premium";

  const listed = service.createdAt
    ? new Date(service.createdAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const bookButton = block ? (
    <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
      <Lock className="mx-auto mb-1.5 h-4 w-4" /> {block}
    </div>
  ) : (
    <motion.button
      type="button"
      onClick={() => setBooking(true)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`${btnPrimary} group relative w-full justify-center overflow-hidden py-4 text-base`}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/35"
        initial={{ left: "-40%" }}
        animate={{ left: "140%" }}
        transition={{
          duration: 1.3,
          repeat: Infinity,
          repeatDelay: 2.4,
          ease: "easeInOut",
        }}
      />
      <CalendarCheck className="relative h-5 w-5" />{" "}
      <span className="relative">Request Booking</span>
      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );

  const facts: { k: string; v: string; icon: LucideIcon }[] = [
    { k: "Category", v: service.category, icon: m.icon },
    { k: "Location", v: service.location, icon: MapPin },
    {
      k: "Pricing",
      v: `${money(service.price)} ${service.priceType}`,
      icon: Sparkles,
    },
    ...(listed ? [{ k: "Listed", v: listed, icon: CalendarDays }] : []),
  ];

  return (
    <div className="relative isolate overflow-hidden pb-28 pt-8 lg:pb-24">
      <SectionBackdrop />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* breadcrumb */}
        <motion.nav
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/services" className="hover:text-foreground">
            Services
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/services?category=${encodeURIComponent(service.category)}`}
            className="hover:text-foreground"
          >
            {service.category}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="line-clamp-1 font-medium text-foreground">
            {service.name}
          </span>
        </motion.nav>

        <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
          {/* left column */}
          <div className="min-w-0 space-y-12">
            <Gallery
              s={service}
              index={imgIndex}
              setIndex={setImgIndex}
              onOpen={() => setLightbox(true)}
            />

            <Reveal>
              <h2 className="font-serif text-2xl font-semibold">
                About this service
              </h2>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                {service.description ||
                  "The vendor hasn't added a description yet."}
              </p>
            </Reveal>

            <Reveal>
              <h2 className="font-serif text-2xl font-semibold">
                Service snapshot
              </h2>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {facts.map((f) => (
                  <motion.div
                    key={f.k}
                    whileHover={reduce ? undefined : { y: -4, rotateX: 4 }}
                    style={{ transformPerspective: 700 }}
                    className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/90 p-4 shadow-sm"
                  >
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md"
                      style={{
                        background: `linear-gradient(145deg, ${m.from}, ${m.to})`,
                      }}
                    >
                      <f.icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.k}
                      </dt>
                      <dd className="truncate text-sm font-semibold">{f.v}</dd>
                    </div>
                  </motion.div>
                ))}
              </dl>
            </Reveal>

            <Reveal>
              <h2 className="font-serif text-2xl font-semibold">
                How booking works
              </h2>

              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    t: "Send a request",
                    d: "Pick your event date and location and add a short note.",
                    icon: Send,
                  },
                  {
                    t: "Vendor reviews",
                    d: "The vendor accepts or rejects your request from their dashboard.",
                    icon: ShieldCheck,
                  },
                  {
                    t: "Track the status",
                    d: "Follow it from pending to accepted, or cancel while it is pending.",
                    icon: CalendarCheck,
                  },
                ].map((st, i) => (
                  <li
                    key={st.t}
                    className="relative rounded-2xl border border-border bg-card/90 p-5"
                  >
                    <span className="absolute -top-3 left-5 grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">
                      {i + 1}
                    </span>
                    <st.icon className="h-6 w-6 text-brand" />
                    <p className="mt-3 text-sm font-semibold">{st.t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {st.d}
                    </p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          {/* right column */}
          <aside className="min-w-0">
            <div className="space-y-5 lg:sticky lg:top-24">
              <motion.div
                initial={{ opacity: 0, y: 30, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 90,
                  damping: 16,
                  delay: 0.1,
                }}
                style={{ transformPerspective: 1200 }}
                className="relative overflow-hidden rounded-4xl border border-border bg-card p-6 shadow-2xl shadow-brand/10 sm:p-8"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
                  style={{ background: m.to }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                    }}
                  >
                    <m.icon className="h-3.5 w-3.5" /> {service.category}
                  </span>

                  <button
                    type="button"
                    onClick={share}
                    aria-label="Copy link to this service"
                    className="grid h-10 w-10 place-items-center rounded-full border border-border transition-colors hover:border-brand/50 hover:bg-brand-soft"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                <h1 className="relative mt-5 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                  {service.name}
                </h1>

                <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Stars value={service.rating} />
                    <b>{service.rating.toFixed(1)}</b>
                    <span className="text-muted-foreground">
                      ({service.reviewCount} reviews)
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-brand" /> {service.location}
                  </span>
                </div>

                <div className="relative mt-6 rounded-2xl bg-brand-soft/70 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Starting price
                  </p>

                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold text-brand">
                      {money(service.price)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {service.priceType}
                    </span>
                  </p>
                </div>

                <div className="relative mt-6">{bookButton}</div>
              </motion.div>

              {/* vendor */}
              <Reveal>
                <div className="rounded-4xl border border-border bg-card p-6 shadow-lg">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Offered by
                  </p>

                  <div className="mt-4 flex items-center gap-4">
                    <span className="relative">
                      {service.vendor.image ? (
                        <Image
                          src={service.vendor.image}
                          alt={service.vendor.name ?? "Vendor"}
                          width={64}
                          height={64}
                          sizes="64px"
                          className="h-16 w-16 rounded-full object-cover ring-4 ring-brand-soft"
                        />
                      ) : (
                        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-xl font-bold text-brand">
                          {service.vendor.businessName.slice(0, 1)}
                        </span>
                      )}

                      {premium && (
                        <span
                          title="Premium vendor"
                          className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gold text-neutral-900 ring-2 ring-card"
                        >
                          <Crown className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-serif text-lg font-semibold">
                        {service.vendor.businessName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {service.vendor.name}
                      </p>

                      <span
                        className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${premium ? "bg-gold/25 text-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {premium ? (
                          <>
                            <Crown className="h-3 w-3" /> Premium vendor
                          </>
                        ) : (
                          "Verified vendor"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </aside>
        </div>

        {/* similar */}
        {similar.length > 0 && (
          <Reveal className="mt-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
                You might also like
              </h2>

              <Link
                href={`/services?category=${encodeURIComponent(service.category)}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
              >
                See all <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((s) => (
                <SimilarCard key={s.id} s={s} />
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* mobile sticky booking bar */}
      {!block && !booking && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight text-brand">
                {money(service.price)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {service.priceType}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBooking(true)}
              className={`${btnPrimary} flex-1 justify-center`}
            >
              <CalendarCheck className="h-4 w-4" /> Request Booking
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <Lightbox
            s={service}
            index={imgIndex}
            setIndex={setImgIndex}
            onClose={() => setLightbox(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {booking && user && (
          <BookingDialog
            s={service}
            customerId={user.id}
            onClose={() => setBooking(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
