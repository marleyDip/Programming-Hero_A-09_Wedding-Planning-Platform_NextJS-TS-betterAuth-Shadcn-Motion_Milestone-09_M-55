"use client";

/**
 * WedPlan - Categories: single card
 * Place at: components/home/categories/category-card.tsx
 *
 * Layout (flex column, so nothing can overlap or overflow on any breakpoint):
 *   top    -> icon medallion + live service count
 *   bottom -> tagline, name, description (clamped), tags (wrap), "Browse services" footer
 *
 * Motion: rise-in on scroll, subtle mouse tilt + glare (useTilt), hover lift.
 * No hover-only content, so touch devices see everything.
 */

import { useTilt } from "@/components/home/section-kit";
import type { Category } from "@/lib/services-api";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getLook, isWide } from "./data";
import ServiceCount from "./service-count";

interface Props {
  category: Category;
  index: number;
  /** undefined while counts are loading */
  count: number | undefined;
}

export default function CategoryCard({ category, index, count }: Props) {
  const { ref, reduce, style, glare, handlers } = useTilt(7, 20);
  const look = getLook(category.name);
  const Icon = look.icon;
  const wide = isWide(index);

  const label =
    count === undefined
      ? category.name
      : `${category.name}, ${count} ${count === 1 ? "service" : "services"}`;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        type: "spring",
        stiffness: 90,
        damping: 18,
        delay: (index % 4) * 0.08,
      }}
      className={`flex ${wide ? "lg:col-span-2" : ""}`}
    >
      <Link
        href={`/services?category=${encodeURIComponent(category.name)}`}
        aria-label={label}
        className="group flex w-full rounded-[1.75rem] outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
      >
        <div className="perspective-distant flex w-full">
          <motion.div
            ref={ref}
            {...handlers}
            style={{ ...style, transformStyle: "preserve-3d" }}
            whileHover={reduce ? undefined : { y: -6 }}
            className="relative flex min-h-80 w-full min-w-0 flex-col rounded-[1.75rem] p-5 shadow-lg transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-black/25 sm:p-6"
          >
            {/* plate: background only, never holds text */}
            <div
              aria-hidden
              className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/20"
              style={{
                background: `linear-gradient(155deg, ${look.from}, ${look.to})`,
              }}
            >
              {/* scrim keeps white text readable on every gradient */}
              <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/10 to-white/10" />

              <Icon
                strokeWidth={0.9}
                className="absolute -right-8 -top-8 h-56 w-56 text-white/10 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"
              />

              <motion.div
                style={{ background: glare }}
                className="absolute inset-0 mix-blend-soft-light"
              />
            </div>

            {/* top row */}
            <div className="relative flex items-start justify-between gap-3">
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-2xl border border-white/35 bg-white/20 text-white shadow-lg backdrop-blur-md"
                style={{ transform: "translateZ(50px)" }}
              >
                <Icon className="h-6 w-6" strokeWidth={1.6} />
              </span>

              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-neutral-950/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md"
                style={{ transform: "translateZ(40px)" }}
              >
                <ServiceCount value={count} />
              </span>
            </div>

            {/* text block */}
            <div
              className="relative mt-auto min-w-0 pt-10"
              style={{ transform: "translateZ(28px)" }}
            >
              <p className="break-words text-sm font-medium text-white/80">
                {category.tagline}
              </p>

              <h3
                className={`mt-1 text-balance break-words font-serif text-xl font-semibold leading-snug text-white sm:text-2xl ${
                  wide ? "lg:text-3xl" : "xl:text-[1.65rem]"
                }`}
              >
                {category.name}
              </h3>

              <p className="mt-2 line-clamp-3 max-w-md text-sm leading-relaxed text-white/85">
                {category.description}
              </p>

              <ul className="mt-4 flex min-w-0 flex-wrap gap-1.5">
                {category.tags.slice(0, 4).map((t, i) => (
                  <li
                    key={t}
                    className={`max-w-full truncate rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm ${
                      i < 3 ? "" : wide ? "hidden lg:block" : "hidden"
                    }`}
                  >
                    {t}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-between border-t border-white/20 pt-4 text-sm font-semibold text-white">
                <span>Browse services</span>
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-900 transition-colors duration-300 group-hover:bg-neutral-950 group-hover:text-white"
                >
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </Link>
    </motion.li>
  );
}
