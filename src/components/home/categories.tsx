"use client";

/**
 * WedPlan - Wedding Service Categories (3D bento)
 * Place at: components/home/categories.tsx   ->   <Categories /> on the homepage
 * Needs:    lib/services-api.ts (getCategories, getCategoryCounts)  +  NEXT_PUBLIC_API_URL
 *
 * Six categories, each a card that links to /services?category=<name>, so visitors can explore
 * services by category. Live "N services" counts come from the API (approved + active only).
 *
 * The cards render immediately from built-in defaults, then upgrade with API data. If the API
 * is down they still work (just without counts), so the section never looks broken.
 *
 * Layout fix: card content now lives in a flex column (top row, medallion row, text block) instead of
 * absolutely positioned layers, so long names, descriptions and tags can never overlap or spill out.
 * The card grows to fit its content, and text wraps / clamps on every breakpoint (sm, md, lg, xl).
 *
 * 3D / motion: bento layout, 3D flip-in on scroll, mouse tilt with perspective + moving glare,
 * layered depth (medallion, count pill, arrow float above the plate), watermark icon parallax,
 * tags that slide up on hover (hover-capable devices only), animated counters.
 * Responsive: 1 col -> 2 col -> 4-col bento. Respects prefers-reduced-motion.
 */

import {
  getCategories,
  getCategoryCounts,
  type Category,
} from "@/lib/services-api";
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Camera,
  Flower2,
  Heart,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Look & feel per category (UI only; text can come from the API)
const LOOK: Record<string, { icon: LucideIcon; from: string; to: string }> = {
  "Photography & Videography": {
    icon: Camera,
    from: "oklch(0.7 0.16 305)",
    to: "oklch(0.43 0.2 285)",
  },
  "Wedding Venues": {
    icon: Building2,
    from: "oklch(0.74 0.15 28)",
    to: "oklch(0.49 0.21 10)",
  },
  "Decoration & Florist": {
    icon: Flower2,
    from: "oklch(0.84 0.13 80)",
    to: "oklch(0.58 0.17 40)",
  },
  "Catering Services": {
    icon: UtensilsCrossed,
    from: "oklch(0.76 0.14 155)",
    to: "oklch(0.45 0.12 180)",
  },
  "Makeup & Styling": {
    icon: Sparkles,
    from: "oklch(0.78 0.16 350)",
    to: "oklch(0.49 0.22 335)",
  },
  "Wedding Fashion": {
    icon: Shirt,
    from: "oklch(0.72 0.19 20)",
    to: "oklch(0.44 0.2 0)",
  },
};
const FALLBACK_LOOK = LOOK["Wedding Venues"];

/** Used instantly, and as the fallback if the API is unreachable. */
const DEFAULTS: Category[] = [
  {
    id: "photography-videography",
    name: "Photography & Videography",
    tagline: "Capture every moment",
    description:
      "Timeless portraits and cinematic films that turn your big day into a story worth reliving.",
    tags: ["Pre-wedding shoot", "Cinematic film", "Drone coverage", "Albums"],
  },
  {
    id: "wedding-venues",
    name: "Wedding Venues",
    tagline: "Halls, gardens & resorts",
    description:
      "From grand banquet halls to beachfront resorts, find the perfect setting for your guest list.",
    tags: ["Banquet halls", "Garden venues", "Resorts", "Beachfront"],
  },
  {
    id: "decoration-florist",
    name: "Decoration & Florist",
    tagline: "Stages, flowers & lighting",
    description:
      "Dreamy stages, floral arches and glowing ambience designed around your vision.",
    tags: ["Stage design", "Floral arches", "Mood lighting", "Gaye Holud"],
  },
  {
    id: "catering-services",
    name: "Catering Services",
    tagline: "Menus guests will remember",
    description:
      "Traditional feasts, live counters and dessert bars for every taste and headcount.",
    tags: ["Traditional menus", "Live counters", "Desserts", "Buffet"],
  },
  {
    id: "makeup-styling",
    name: "Makeup & Styling",
    tagline: "Bridal & groom looks",
    description:
      "Radiant bridal makeup, hair styling and polished grooming for the whole wedding party.",
    tags: ["Bridal makeup", "Hair styling", "Groom grooming", "Henna"],
  },
  {
    id: "wedding-fashion",
    name: "Wedding Fashion",
    tagline: "Outfits & accessories",
    description:
      "Sarees, lehengas, sherwanis and finishing touches from trusted designers and boutiques.",
    tags: ["Bridal wear", "Sherwani", "Jewellery", "Accessories"],
  },
];

/* Bento: on lg (4 columns) the first and last cards are double width */
const SPAN = (i: number) => (i === 0 || i === 5 ? "lg:col-span-2" : "");

// Count
function ServiceCount({ value }: { value: number | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (value === undefined || !inView || !ref.current) return;
    const el = ref.current;

    if (reduce) {
      el.textContent = String(value);
      return;
    }

    const c = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });

    return () => c.stop();
  }, [value, inView, reduce]);

  if (value === undefined) {
    return (
      <span
        ref={ref}
        className="inline-block h-3 w-14 animate-pulse rounded-full bg-white/40"
      />
    );
  }

  return (
    <>
      {/* <span ref={ref}>0</span> {value === 1 ? "service" : "services"} */}

      <span className="inline-flex items-baseline gap-1.5 tabular-nums">
        <span ref={ref} className="text-sm font-bold tracking-tight text-white">
          0
        </span>
        <span className="text-[11px] font-medium text-white/75">
          {value === 1 ? "service" : "services"}
        </span>
      </span>
    </>
  );
}

// Card
function CategoryCard({
  category,
  index,
  count,
  countsReady,
}: {
  category: Category;
  index: number;
  count: number | undefined;
  countsReady: boolean;
}) {
  const reduce = useReducedMotion();
  const look = LOOK[category.name] ?? FALLBACK_LOOK;
  const Icon = look.icon;
  const wide = index === 0 || index === 5;

  const ref = useRef<HTMLDivElement>(null);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const rx = useSpring(tx, { stiffness: 170, damping: 17 });
  const ry = useSpring(ty, { stiffness: 170, damping: 17 });
  const gx = useMotionValue(30);
  const gy = useMotionValue(20);
  const mxs = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const mys = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.42), transparent 55%)`;

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ty.set((px - 0.5) * 14);
    tx.set((0.5 - py) * 14);
    gx.set(px * 100);
    gy.set(py * 100);
    mxs.set((px - 0.5) * -34);
    mys.set((py - 0.5) * -34);
  };
  const onLeave = () => {
    tx.set(0);
    ty.set(0);
    gx.set(30);
    gy.set(20);
    mxs.set(0);
    mys.set(0);
  };

  const label =
    countsReady && count !== undefined
      ? `${category.name}, ${count} ${count === 1 ? "service" : "services"}`
      : category.name;

  return (
    <motion.li
      initial={
        reduce ? false : { opacity: 0, y: 70, rotateX: -34, scale: 0.93 }
      }
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        type: "spring",
        stiffness: 80,
        damping: 15,
        delay: (index % 4) * 0.09,
      }}
      style={{ transformOrigin: "50% 100%" }}
      className={`flex ${SPAN(index)}`}
    >
      <Link
        href={`/services?category=${encodeURIComponent(category.name)}`}
        aria-label={label}
        className="group flex w-full rounded-[1.75rem] outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
      >
        <motion.div
          ref={ref}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          whileHover={reduce ? undefined : { y: -8 }}
          style={{
            rotateX: reduce ? 0 : rx,
            rotateY: reduce ? 0 : ry,
            transformStyle: "preserve-3d",
            transformPerspective: 1100,
          }}
          className="relative flex min-h-88 w-full min-w-0 flex-col rounded-[1.75rem] p-5 shadow-lg transition-shadow duration-500 group-hover:shadow-2xl group-hover:shadow-black/30 sm:p-6"
        >
          {/* plate (background only, never holds text) */}
          <div
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/20"
            style={{
              background: `linear-gradient(155deg, ${look.from}, ${look.to})`,
            }}
          >
            {[0.9, 0.66, 0.42].map((s) => (
              <span
                key={s}
                className="absolute right-[-8%] top-[-10%] aspect-square rounded-full border border-white/20"
                style={{ width: `${s * 70}%` }}
              />
            ))}

            {/* bottom scrim keeps text readable on every gradient */}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-white/15" />

            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(rgba(255,255,255,0.4)_1px,transparent_1px)] bg-size-[18px_18px]" />

            {/* watermark icon with parallax */}
            <motion.div
              style={{ x: mxs, y: mys }}
              className="absolute -bottom-6 -right-6 text-white/15 transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-6"
            >
              <Icon
                className={wide ? "h-60 w-60" : "h-48 w-48"}
                strokeWidth={0.9}
              />
            </motion.div>

            <motion.div
              style={{ background: glare }}
              className="absolute inset-0 mix-blend-soft-light"
            />
          </div>

          {/* row 1: index + count pill */}
          <div className="relative flex items-start justify-between gap-3">
            {/* <span
              aria-hidden
              className="font-serif text-3xl font-bold leading-none text-white/30 sm:text-4xl"
              style={{ transform: "translateZ(20px)" }}
            >
              0{index + 1}
            </span> */}

            <span
              aria-hidden
              className="font-serif text-3xl font-bold leading-none text-white/25 transition-all duration-500 group-hover:translate-x-1 group-hover:text-white/50 sm:text-4xl"
              style={{ transform: "translateZ(20px)" }}
            >
              0{index + 1}
            </span>

            {/* <span
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/30 bg-neutral-950/45 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
              style={{ transform: "translateZ(55px)" }}
            >
              <ServiceCount value={countsReady ? (count ?? 0) : undefined} />
            </span> */}

            <span
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 bg-black/40 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors duration-300 group-hover:border-white/45 group-hover:bg-black/55"
              style={{ transform: "translateZ(55px)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <ServiceCount value={countsReady ? (count ?? 0) : undefined} />
            </span>

            {/* <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-neutral-950/45 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
              style={{ transform: "translateZ(55px)" }}
            >
              {countsReady ? (
                <ServiceCount value={count ?? 0} />
              ) : (
                <ServiceCount value={undefined} />
              )}
            </span> */}
          </div>

          {/* row 2: medallion + arrow */}
          <div className="relative mt-5 flex items-center justify-between gap-3">
            <div style={{ transform: "translateZ(85px)" }}>
              <motion.div
                animate={reduce ? undefined : { y: [0, -7, 0] }}
                transition={{
                  duration: 4 + (index % 3) * 0.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="grid h-16 w-16 place-items-center rounded-2xl border border-white/40 bg-white/20 text-white shadow-2xl backdrop-blur-md"
              >
                <Icon className="h-8 w-8" strokeWidth={1.5} />
              </motion.div>
            </div>

            <span
              aria-hidden
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-neutral-900 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-neutral-950 group-hover:text-white"
              style={{ transform: "translateZ(75px)" }}
            >
              <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
            </span>
          </div>

          {/* row 3: text block, pinned to the bottom, full width, always wraps */}
          <div
            className="relative mt-auto min-w-0 pt-8"
            style={{ transform: "translateZ(50px)" }}
          >
            <p className="wrap-break-word text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 sm:text-[11px] sm:tracking-[0.2em]">
              {category.tagline}
            </p>

            <h3
              className={`mt-1.5 text-balance wrap-break-word font-serif text-xl font-semibold leading-snug text-white drop-shadow sm:text-2xl ${
                wide ? "lg:text-3xl" : "xl:text-[1.65rem]"
              }`}
            >
              {category.name}
            </h3>

            <p
              className={`mt-2 max-w-md text-sm leading-relaxed text-white/85 ${
                wide ? "line-clamp-3" : "line-clamp-3 lg:line-clamp-4"
              }`}
            >
              {category.description}
            </p>

            {/* tags: wrap inside the card; on mouse devices they slide up on hover */}
            <ul
              className={`mt-3 flex min-w-0 flex-wrap gap-1.5 transition-all duration-500 [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-y-0 [@media(hover:hover)]:group-focus-visible:opacity-100 ${
                wide
                  ? "[@media(hover:hover)]:lg:translate-y-0 [@media(hover:hover)]:lg:opacity-100"
                  : ""
              }`}
            >
              {category.tags.slice(0, 4).map((t, ti) => (
                <li
                  key={t}
                  className={`max-w-full truncate rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm ${
                    ti < 3 ? "" : wide ? "hidden lg:block" : "hidden"
                  }`}
                >
                  {t}
                </li>

                // <li
                //   key={t}
                //   className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm"
                // >
                //   {t}
                // </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </Link>
    </motion.li>
  );
}

// Section
export default function Categories() {
  const reduce = useReducedMotion();

  const [categories, setCategories] = useState<Category[]>(DEFAULTS);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();

    Promise.allSettled([
      getCategories(ctrl.signal),
      getCategoryCounts(ctrl.signal),
    ]).then(([cats, cnt]) => {
      if (ctrl.signal.aborted) return;

      if (cats.status === "fulfilled" && cats.value.length) {
        /* keep the six required categories in order, upgraded with API text when present */
        const byName = new Map(cats.value.map((c) => [c.name, c]));

        setCategories(
          DEFAULTS.map((d) => ({
            ...d,
            ...(byName.get(d.name) ?? {}),
            tags: byName.get(d.name)?.tags?.length
              ? byName.get(d.name)!.tags
              : d.tags,
          })),
        );
      }
      /* counts are optional: on failure just show "0 services" -> hide by using empty map */
      setCounts(cnt.status === "fulfilled" ? cnt.value : {});
    });

    return () => ctrl.abort();
  }, []);

  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-28">
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-40 top-0 -z-10 h-112 w-md rounded-full bg-brand/10 blur-3xl"
      />

      <motion.div
        aria-hidden
        animate={reduce ? undefined : { x: [0, -40, 0], y: [0, -40, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-40 bottom-0 -z-10 h-112 w-md rounded-full bg-gold/15 blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* heading */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl perspective-[900px]">
            <motion.span
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm backdrop-blur"
            >
              <Heart className="h-3.5 w-3.5 fill-current" /> Explore by category
            </motion.span>

            <h2 className="mt-5 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {["Wedding", "Service"].map((w, i) => (
                <motion.span
                  key={w}
                  className="mr-[0.25em] inline-block"
                  initial={{ opacity: 0, rotateX: -80, y: 20 }}
                  whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    type: "spring",
                    stiffness: 110,
                    damping: 14,
                    delay: 0.05 + i * 0.1,
                  }}
                >
                  {w}
                </motion.span>
              ))}

              <span className="relative inline-block">
                <motion.span
                  className="inline-block bg-linear-to-r from-(--logo-from) to-(--logo-to) bg-clip-text italic text-transparent"
                  initial={{ opacity: 0, rotateX: -80, y: 20 }}
                  whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    type: "spring",
                    stiffness: 110,
                    damping: 14,
                    delay: 0.25,
                  }}
                >
                  Categories
                </motion.span>
                <svg
                  aria-hidden
                  viewBox="0 0 200 14"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-(--logo-to)"
                >
                  <motion.path
                    d="M2 9 C 35 2, 65 13, 100 7 S 165 2, 198 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: 0.7,
                      duration: 0.9,
                      ease: "easeInOut",
                    }}
                  />
                </svg>
              </span>
            </h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-5 text-base text-muted-foreground sm:text-lg"
            >
              Everything your big day needs, organised in one place. Pick a
              category to see trusted, approved vendors.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="hidden md:block"
          >
            <motion.div
              className="inline-block"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
            >
              <Link
                href="/services"
                className="group inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold shadow-sm transition-colors hover:border-brand/50 hover:bg-brand-soft"
              >
                All services
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-foreground transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* bento grid */}
        <ul className="mt-14 grid gap-5 perspective-[1500px] sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {categories.map((c, i) => (
            <CategoryCard
              key={c.id}
              category={c}
              index={i}
              count={counts ? counts[c.name] : undefined}
              countsReady={counts !== null}
            />
          ))}
        </ul>

        {/* mobile "all services" */}
        <div className="mt-10 text-center md:hidden">
          <Link
            href="/services"
            className="inline-flex items-center gap-2.5 rounded-full bg-linear-to-r from-(--logo-from) to-(--logo-to) px-7 py-3.5 text-sm font-semibold text-(--logo-fg) shadow-lg shadow-brand/30"
          >
            Browse all services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
