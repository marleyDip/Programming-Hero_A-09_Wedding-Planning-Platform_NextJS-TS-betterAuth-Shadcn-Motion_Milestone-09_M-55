"use client";

/**
 * WedPlan - Add Service / Edit Service with LIVE PREVIEW
 * Place at: components/dashboard/vendor/service-form.tsx
 * Used by: app/dashboard/vendor/services/new/page.tsx      <ServiceForm />
 *          app/dashboard/vendor/services/[id]/edit/page.tsx <ServiceForm serviceId={id} />
 *
 * Fields (assignment): service name, category, description, price, location, service image(s) uploaded
 * through ImgBB. Everything is validated; new services are saved as "pending" until an admin approves.
 * Free plan: max 3 active services (premium: unlimited). The server must enforce this too.
 *
 * Live preview: as you type / upload, the right side shows exactly how customers will see the service,
 * as a browse card AND as the details page (tabs), with a completeness meter.
 */

import {
  Avatar,
  Modal,
  PageHeader,
  money,
} from "@/components/dashboard/customer/customer-shared";
import ServiceImageManager from "@/components/dashboard/vendor/service-image-manager";
import {
  CATEGORIES,
  CITIES,
  FREE_LIMIT,
  PRICE_TYPES,
  PremiumBadge,
  activeCount,
  categoryMeta,
  fieldCls,
  isPremium,
  useVendorServices,
  useVendorUser,
  type VendorUser,
} from "@/components/dashboard/vendor/vendor-shared";
import { useTilt } from "@/components/home/section-kit";
import FancySelect, { type SelectOption } from "@/components/ui/fancy-select";
import {
  ApiError,
  createService,
  getVendorService,
  updateService,
  type ServiceInput,
  type VendorService,
} from "@/lib/vendor-api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  PackagePlus,
  Save,
  ShieldCheck,
  Star,
  Tag,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Form {
  name: string;
  category: string;
  description: string;
  price: string;
  priceType: string;
  location: string;
  images: string[];
}

const EMPTY: Form = {
  name: "",
  category: "",
  description: "",
  price: "",
  priceType: "per event",
  location: "",
  images: [],
};
type Errors = Partial<Record<keyof Form, string>>;

const CATEGORY_OPTIONS: SelectOption[] = CATEGORIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: c.icon,
}));

const PRICE_OPTIONS: SelectOption[] = PRICE_TYPES.map((p) => ({
  value: p,
  label: p.charAt(0).toUpperCase() + p.slice(1),
}));

function validate(f: Form): Errors {
  const e: Errors = {};

  if (f.name.trim().length < 3)
    e.name = "Give your service a name (at least 3 characters).";
  else if (f.name.trim().length > 80)
    e.name = "Keep the name under 80 characters.";

  if (!f.category) e.category = "Choose a category.";

  if (f.description.trim().length < 20)
    e.description = "Describe your service in at least 20 characters.";
  else if (f.description.length > 1000)
    e.description = "Keep the description under 1000 characters.";

  const price = Number(f.price);
  if (!f.price) e.price = "Enter a price.";
  else if (!Number.isFinite(price) || price <= 0)
    e.price = "Price must be more than 0.";
  else if (price > 10_000_000) e.price = "That price looks too high.";

  if (f.location.trim().length < 2)
    e.location = "Enter the city or area you serve.";
  if (f.images.length === 0) e.images = "Upload at least one photo.";

  return e;
}

// small UI
function Section({
  n,
  icon: Icon,
  title,
  hint,
  children,
}: {
  n: number;
  icon: typeof Tag;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      // className="focus-within:z-30"
      className="relative rounded-3xl border border-border bg-card/90 p-6 shadow-lg backdrop-blur sm:p-7"
    >
      <div className="mb-5 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-(--logo-from) to-brand text-white shadow-lg shadow-brand/30">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
            Step {n}
          </p>
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>

      <div className="space-y-5">{children}</div>
    </motion.section>
  );
}

function Err({ id, msg }: { id: string; msg?: string }) {
  return (
    <AnimatePresence initial={false}>
      {msg && (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function Label({
  htmlFor,
  children,
  right,
}: {
  htmlFor: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold"
    >
      <span>{children}</span>
      {right}
    </label>
  );
}

function Ring({ pct }: { pct: number }) {
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="5"
        />

        <motion.circle
          cx="26"
          cy="26"
          r={R}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
        />
      </svg>

      <span className="absolute inset-0 grid place-items-center text-[11px] font-bold">
        {pct}%
      </span>
    </div>
  );
}

const Skel = ({ w }: { w: string }) => (
  <span
    className={`inline-block h-3.5 animate-pulse rounded-full bg-muted ${w}`}
  />
);

// live preview
function PreviewCard({ f, user }: { f: Form; user: VendorUser }) {
  const { ref, reduce, style, glare, handlers } = useTilt(9, 20);
  const m = categoryMeta(f.category);
  const price = Number(f.price);
  const premium = isPremium(user);
  const biz = user.businessName || user.name;

  return (
    <div className="perspective-distant">
      <motion.article
        ref={ref}
        {...handlers}
        style={style}
        whileHover={reduce ? undefined : { y: -4 }}
        className="relative overflow-visible rounded-3xl border border-border bg-card shadow-2xl shadow-brand/15"
      >
        <div className="relative aspect-4/3 overflow-hidden rounded-t-3xl bg-muted">
          <AnimatePresence mode="wait" initial={false}>
            {f.images[0] ? (
              <motion.img
                key={f.images[0]}
                src={f.images[0]}
                alt=""
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <motion.div
                key="ph"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 grid place-items-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                }}
              >
                <div className="text-center">
                  <ImageIcon
                    className="mx-auto h-12 w-12 opacity-80"
                    strokeWidth={1.3}
                  />

                  <p className="mt-2 text-xs font-semibold opacity-90">
                    Your cover photo appears here
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />

          <motion.div
            aria-hidden
            style={{ background: glare }}
            className="absolute inset-0 mix-blend-soft-light"
          />
        </div>

        <span
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
            transform: "translateZ(45px)",
          }}
        >
          <m.icon className="h-3.5 w-3.5" /> {f.category || "Category"}
        </span>

        <span
          className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/30 bg-neutral-950/50 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md"
          style={{ transform: "translateZ(55px)" }}
        >
          <Star className="h-3.5 w-3.5 fill-gold text-gold" /> New
        </span>

        <span
          className="absolute right-4 top-[calc(75%-1.25rem)] rounded-2xl bg-card px-3.5 py-2 text-right shadow-xl ring-1 ring-border"
          style={{ transform: "translateZ(65px)" }}
        >
          <span className="block text-base font-bold leading-tight text-brand">
            {price > 0 ? money(price) : "৳ —"}
          </span>

          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
            {f.priceType}
          </span>
        </span>

        <div className="p-5 pt-6">
          <h3
            className="line-clamp-2 min-h-[3.2rem] pr-24 font-serif text-lg font-semibold leading-snug"
            style={{ transform: "translateZ(30px)" }}
          >
            {f.name.trim() || (
              <span className="space-y-2">
                <Skel w="w-44" />
                <br />
                <Skel w="w-28" />
              </span>
            )}
          </h3>

          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-brand" />{" "}
            {f.location.trim() || <Skel w="w-24" />}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative">
                <Avatar src={user.image} name={biz} size={36} />

                {premium && (
                  <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-gold text-neutral-900 ring-2 ring-card">
                    <Crown className="h-2.5 w-2.5" />
                  </span>
                )}
              </span>

              <span className="min-w-0 text-xs">
                <span className="block truncate font-semibold">{biz}</span>
                <span className="block truncate text-muted-foreground">
                  {user.name}
                </span>
              </span>
            </div>

            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-4 py-2.5 text-xs font-semibold text-(--logo-fg) shadow-md"
              style={{ transform: "translateZ(40px)" }}
            >
              View Details <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function PreviewDetails({ f, user }: { f: Form; user: VendorUser }) {
  const reduce = useReducedMotion();

  const [i, setI] = useState(0);
  const idx = Math.min(i, Math.max(f.images.length - 1, 0));
  const m = categoryMeta(f.category);
  const price = Number(f.price);
  const biz = user.businessName || user.name;
  const premium = isPremium(user);
  const go = (d: number) =>
    f.images.length && setI((idx + d + f.images.length) % f.images.length);

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-4 shadow-2xl shadow-brand/10 sm:p-5">
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-muted perspective:[900px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {f.images[idx] ? (
            <motion.img
              key={f.images[idx]}
              src={f.images[idx]}
              alt=""
              initial={reduce ? { opacity: 0 } : { opacity: 0, rotateY: 25 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <motion.div
              key="ph"
              className="absolute inset-0 grid place-items-center text-white"
              style={{
                background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
              }}
            >
              <ImageIcon className="h-12 w-12 opacity-80" strokeWidth={1.3} />
            </motion.div>
          )}
        </AnimatePresence>

        {f.images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute bottom-3 right-14 grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 shadow-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 shadow-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <span className="absolute bottom-3 left-3 rounded-full bg-neutral-950/55 px-2.5 py-1 font-mono text-[11px] text-white">
              {idx + 1} / {f.images.length}
            </span>
          </>
        )}
      </div>

      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})` }}
        >
          <m.icon className="h-3.5 w-3.5" /> {f.category || "Category"}
        </span>

        <h3 className="mt-3 font-serif text-2xl font-semibold leading-tight">
          {f.name.trim() || <Skel w="w-52" />}
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-brand" />{" "}
          {f.location.trim() || <Skel w="w-24" />}
        </p>
      </div>

      <div className="rounded-2xl bg-brand-soft/70 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Starting price
        </p>

        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-serif text-3xl font-bold text-brand">
            {price > 0 ? money(price) : "৳ —"}
          </span>
          <span className="text-sm text-muted-foreground">{f.priceType}</span>
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold">About this service</p>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {f.description.trim() || (
            <span className="space-y-2">
              <Skel w="w-full" />
              <br />
              <Skel w="w-5/6" />
              <br />
              <Skel w="w-2/3" />
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
        <span className="relative">
          <Avatar src={user.image} name={biz} size={44} />

          {premium && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-neutral-900 ring-2 ring-card">
              <Crown className="h-3 w-3" />
            </span>
          )}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{biz}</p>
          <p className="truncate text-xs text-muted-foreground">
            {premium ? "Premium vendor" : "Verified vendor"}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) py-3.5 text-sm font-semibold text-(--logo-fg) opacity-80"
      >
        Request Booking
      </button>
    </div>
  );
}

// form
export default function ServiceFormOld({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const editing = !!serviceId;

  const { user } = useVendorUser();
  const premium = isPremium(user);
  const { services } = useVendorServices(user?.id);

  const [f, setF] = useState<Form>(EMPTY);
  const [initial, setInitial] = useState<Form>(EMPTY);
  const [original, setOriginal] = useState<VendorService | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState<"card" | "details">("card");

  // load the service when editing
  useEffect(() => {
    if (!serviceId || !user) return;
    let off = false;

    getVendorService(serviceId, user.id)
      .then((s) => {
        if (off) return;

        const form: Form = {
          name: s.name,
          category: s.category,
          description: s.description,
          price: String(s.price),
          priceType: s.priceType,
          location: s.location,
          images: s.images,
        };
        setOriginal(s);
        setF(form);
        setInitial(form);
        setLoading(false);
      })
      .catch((e) => {
        if (off) return;

        setLoadError(
          e instanceof ApiError && e.status === 403
            ? "This service belongs to another vendor."
            : e instanceof ApiError && e.status === 404
              ? "We couldn't find this service."
              : "We couldn't load this service.",
        );
        setLoading(false);
      });

    return () => {
      off = true;
    };
  }, [serviceId, user]);

  const dirty = useMemo(
    () => JSON.stringify(f) !== JSON.stringify(initial),
    [f, initial],
  );

  useEffect(() => {
    if (!dirty || done) return;

    const h = (e: BeforeUnloadEvent) => e.preventDefault();

    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, done]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));

    if (tried) setErrors((p) => ({ ...p, [k]: validate({ ...f, [k]: v })[k] }));
  };

  const checks = [
    !!f.name.trim().length && f.name.trim().length >= 3,
    !!f.category,

    f.description.trim().length >= 20,
    Number(f.price) > 0,
    f.location.trim().length >= 2,
    f.images.length > 0,
  ];

  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  const used = services ? activeCount(services) : 0;
  const limitReached = !editing && !premium && !!services && used >= FREE_LIMIT;

  if (!user) return null;

  const submit = async (ev: React.SubmitEvent<HTMLFormElement>) => {
    ev.preventDefault();

    setTried(true);
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Please fix the highlighted fields.");
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (uploading)
      return void toast.info(
        "Please wait for your photos to finish uploading.",
      );
    if (limitReached)
      return void toast.error("Free plan limit reached", {
        description: `Free vendors can have ${FREE_LIMIT} active services. Upgrade to Premium for unlimited.`,
      });

    const input: ServiceInput = {
      name: f.name.trim(),
      category: f.category,
      description: f.description.trim(),
      price: Math.round(Number(f.price)),
      priceType: f.priceType,
      location: f.location.trim(),
      images: f.images,
    };
    setBusy(true);

    try {
      if (editing && serviceId) {
        await updateService(serviceId, user.id, input);
        setInitial(f);
        toast.success("Service updated", {
          description: "Your changes have been saved.",
        });

        router.push("/dashboard/vendor/services");
      } else {
        await createService(user.id, input);
        setInitial(f);
        setDone(true);
        toast.success("Service submitted", {
          description: "It will appear to customers once an admin approves it.",
        });
      }
    } catch (e) {
      toast.error(
        editing ? "Couldn't update the service" : "Couldn't submit the service",
        {
          description:
            e instanceof ApiError && e.status === 403
              ? "You can only change your own services."
              : "Please check your connection and try again.",
        },
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setF(EMPTY);
    setInitial(EMPTY);
    setErrors({});
    setTried(false);
    setDone(false);
    setTab("card");
  };

  if (loading)
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-128 animate-pulse rounded-3xl bg-muted" />
          <div className="h-128 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );

  if (loadError)
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </span>

        <h1 className="mt-5 font-serif text-xl font-semibold">{loadError}</h1>

        <Link
          href="/dashboard/vendor/services"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my services
        </Link>
      </div>
    );

  return (
    <div>
      <PageHeader
        eyebrow={editing ? "Edit" : "New listing"}
        title={editing ? "Edit Service" : "Add Service"}
        subtitle="Fill in the details on the left and watch your listing come to life on the right."
      >
        <Link
          href="/dashboard/vendor/services"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-brand/50 hover:bg-brand-soft"
        >
          <ArrowLeft className="h-4 w-4" /> My services
        </Link>
      </PageHeader>

      {/* plan limit */}
      {!editing && services && !premium && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 flex flex-wrap items-center gap-4 rounded-3xl border p-5 ${limitReached ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/80"}`}
        >
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${limitReached ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-brand"}`}
          >
            {limitReached ? (
              <LockKeyhole className="h-6 w-6" />
            ) : (
              <PackagePlus className="h-6 w-6" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {limitReached
                ? "You've reached the Free plan limit"
                : `Free plan: ${used} of ${FREE_LIMIT} active services used`}
            </p>

            <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (used / FREE_LIMIT) * 100)}%`,
                }}
                className={`h-full rounded-full ${limitReached ? "bg-destructive" : "bg-linear-to-r from-(--logo-from) to-(--logo-to)"}`}
              />
            </div>

            {limitReached && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Upgrade to Premium to publish more, or switch off an existing
                service.
              </p>
            )}
          </div>

          {limitReached && (
            <Link
              href="/dashboard/vendor/subscription"
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-5 py-2.5 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30"
            >
              <Crown className="h-4 w-4" /> Upgrade to Premium
            </Link>
          )}
        </motion.div>
      )}

      {editing && original?.status === "rejected" && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p>
            This service was rejected by an admin and is hidden from customers.
            You can still edit it.
          </p>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* form */}
        <form onSubmit={submit} noValidate className="space-y-6">
          <Section
            n={1}
            icon={Tag}
            title="Basics"
            hint="What are you offering, and which category fits best?"
          >
            <div>
              <Label
                htmlFor="sv-name"
                right={
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {f.name.length}/80
                  </span>
                }
              >
                Service name
              </Label>

              <input
                id="sv-name"
                value={f.name}
                maxLength={90}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Cinematic Wedding Film & Photo Package"
                aria-invalid={!!errors.name}
                aria-describedby="sv-name-e"
                className={fieldCls(errors.name)}
              />

              <Err id="sv-name-e" msg={errors.name} />
            </div>

            <div>
              <FancySelect
                label="Service category"
                icon={Tag}
                value={f.category}
                onChange={(v) => set("category", v)}
                options={[
                  { value: "", label: "Choose a category" },
                  ...CATEGORY_OPTIONS,
                ]}
              />
              <Err id="sv-cat-e" msg={errors.category} />
            </div>
          </Section>

          <Section
            n={2}
            icon={FileText}
            title="Description"
            hint="Tell couples what is included and what makes you special."
          >
            <div>
              <Label
                htmlFor="sv-desc"
                right={
                  <span
                    className={`font-mono text-xs font-normal ${f.description.length > 1000 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {f.description.length}/1000
                  </span>
                }
              >
                Description
              </Label>

              <textarea
                id="sv-desc"
                rows={6}
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe your service, packages, experience and anything couples should know…"
                aria-invalid={!!errors.description}
                aria-describedby="sv-desc-e"
                className={`${fieldCls(errors.description)} resize-y`}
              />
              <Err id="sv-desc-e" msg={errors.description} />
            </div>
          </Section>

          <Section
            n={3}
            icon={Wallet}
            title="Price & location"
            hint="Set a starting price and where you offer this service."
          >
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="sv-price">Price (৳)</Label>
                <input
                  id="sv-price"
                  inputMode="numeric"
                  value={f.price}
                  onChange={(e) =>
                    set(
                      "price",
                      e.target.value.replace(/[^\d]/g, "").slice(0, 8),
                    )
                  }
                  placeholder="45000"
                  aria-invalid={!!errors.price}
                  aria-describedby="sv-price-e"
                  className={fieldCls(errors.price)}
                />
                <Err id="sv-price-e" msg={errors.price} />
              </div>

              <FancySelect
                label="Charged"
                icon={Wallet}
                value={f.priceType}
                onChange={(v) => set("priceType", v)}
                options={PRICE_OPTIONS}
              />
            </div>

            <div>
              <Label htmlFor="sv-loc">Location</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="sv-loc"
                  value={f.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="City or area, e.g. Dhaka"
                  aria-invalid={!!errors.location}
                  aria-describedby="sv-loc-e"
                  className={`${fieldCls(errors.location)} pl-11`}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {CITIES.map((c) => (
                  <motion.button
                    key={c}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => set("location", c)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${f.location === c ? "border-transparent bg-brand text-brand-foreground shadow-md" : "border-border bg-background text-muted-foreground hover:border-brand/50 hover:text-foreground"}`}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
              <Err id="sv-loc-e" msg={errors.location} />
            </div>
          </Section>

          <Section
            n={4}
            icon={ImageIcon}
            title="Photos"
            hint="Good photos get more booking requests. Add up to 4."
          >
            <ServiceImageManager
              images={f.images}
              onChange={(u) => set("images", u)}
              onBusyChange={setUploading}
              error={errors.images}
            />
          </Section>

          {/* submit bar */}
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/90 p-3 shadow-lg backdrop-blur-xl">
            <p className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-brand" />
              {editing
                ? "Changes are saved to your listing."
                : "Saved as Pending until an admin approves it."}
            </p>

            <motion.button
              type="submit"
              disabled={busy || uploading || limitReached}
              whileHover={!busy && !limitReached ? { scale: 1.04 } : undefined}
              whileTap={!busy && !limitReached ? { scale: 0.96 } : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-7 py-3 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  {editing ? "Saving…" : "Submitting…"}
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading photos…
                </>
              ) : editing ? (
                <>
                  <Save className="h-4 w-4" /> Save changes
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4" /> Submit for approval
                </>
              )}
            </motion.button>
          </div>
        </form>

        {/* live preview */}
        <aside
          id="live-preview"
          aria-label="Live preview"
          className="min-w-0 lg:sticky lg:top-8"
        >
          <div className="mb-4 flex items-center gap-4 rounded-3xl border border-border bg-card/90 p-4 shadow-lg backdrop-blur">
            <Ring pct={pct} />

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Eye className="h-4 w-4 text-brand" /> Live preview
              </p>
              <p className="text-xs text-muted-foreground">
                {pct === 100
                  ? "Looks complete. Ready to submit!"
                  : "Updates as you type. Complete every step to finish."}
              </p>
            </div>
            {isPremium(user) && <PremiumBadge />}
          </div>

          <div
            role="tablist"
            aria-label="Preview type"
            className="mb-4 inline-flex rounded-full border border-border bg-card p-1"
          >
            {(
              [
                ["card", "Browse card"],
                ["details", "Details page"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`relative rounded-full px-5 py-2 text-sm font-semibold ${tab === k ? "text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab === k && (
                  <motion.span
                    layoutId="preview-tab"
                    className="absolute inset-0 rounded-full bg-linear-to-r from-(--logo-from) to-brand shadow-md"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16, rotateX: -8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              style={{ transformPerspective: 1000 }}
            >
              {tab === "card" ? (
                <PreviewCard f={f} user={user} />
              ) : (
                <PreviewDetails f={f} user={user} />
              )}
            </motion.div>
          </AnimatePresence>

          <ul className="mt-5 grid grid-cols-2 gap-2 text-xs">
            {[
              "Name",
              "Category",
              "Description",
              "Price",
              "Location",
              "Photo",
            ].map((l, i) => (
              <li
                key={l}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${checks[i] ? "bg-success/10 text-foreground" : "bg-muted/50 text-muted-foreground"}`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full ${checks[i] ? "bg-success text-white" : "border border-border"}`}
                >
                  {checks[i] && <Check className="h-3 w-3" strokeWidth={3.5} />}
                </span>
                {l}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* mobile jump to preview */}
      <a
        href="#live-preview"
        className="fixed bottom-24 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-xs font-semibold text-background shadow-2xl lg:hidden"
      >
        <Eye className="h-4 w-4" /> Preview
      </a>

      {/* success */}
      <Modal
        open={done}
        onClose={() => router.push("/dashboard/vendor/services")}
        label="Service submitted"
      >
        <div className="p-8 text-center sm:p-10">
          <div className="relative mx-auto grid h-24 w-24 place-items-center">
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-success"
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.6 }}
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
            Submitted for approval!
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            <b className="text-foreground">{f.name}</b> is now{" "}
            <b className="text-foreground">pending</b>. Once an admin approves
            it, customers can find and book it.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/vendor/services"
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-6 py-3 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30"
            >
              View my services <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Add another
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
