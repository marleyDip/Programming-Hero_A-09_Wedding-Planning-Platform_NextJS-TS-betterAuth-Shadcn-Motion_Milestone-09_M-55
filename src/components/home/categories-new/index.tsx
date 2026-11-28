"use client";

/**
 * WedPlan - Wedding Service Categories section
 * Place at: components/home/categories/index.tsx   ->   <Categories /> on the homepage
 * (the import path "@/components/home/categories" stays the same)
 *
 * Needs: lib/services-api.ts (getCategories, getCategoryCounts) + NEXT_PUBLIC_API_URL
 *
 * Folder:
 *   index.tsx          section + heading + grid
 *   category-card.tsx  one card
 *   service-count.tsx  animated "N services"
 *   use-categories.ts  data hook (defaults first, API upgrade, safe fallback)
 *   data.ts            defaults, colours, icons
 *
 * Responsive: 1 col -> 2 col -> 4-col bento (first and last cards double width on lg).
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart } from "lucide-react";
import Link from "next/link";
import CategoryCard from "./category-card";
import { useCategories } from "./use-categories";

function Heading() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end"
    >
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand shadow-sm backdrop-blur">
          <Heart className="h-3.5 w-3.5 fill-current" /> Explore by category
        </span>

        <h2 className="mt-5 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Wedding Service{" "}
          <span className="bg-linear-to-r from-(--logo-from) to-(--logo-to) bg-clip-text italic text-transparent">
            Categories
          </span>
        </h2>

        <p className="mt-5 text-base text-muted-foreground sm:text-lg">
          Everything your big day needs, organised in one place. Pick a category
          to see trusted, approved vendors.
        </p>
      </div>

      <Link
        href="/services"
        className="group hidden items-center gap-2.5 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold shadow-sm transition-colors hover:border-brand/50 hover:bg-brand-soft md:inline-flex"
      >
        All services
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-brand-foreground transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </motion.div>
  );
}

export default function CategoriesNew() {
  const { categories, counts } = useCategories();

  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-28">
      {/* soft static glows */}
      <div
        aria-hidden
        className="absolute -right-40 top-0 -z-10 h-112 w-md rounded-full bg-brand/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -left-40 bottom-0 -z-10 h-112 w-md rounded-full bg-gold/15 blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {categories.map((c, i) => (
            <CategoryCard
              key={c.id}
              category={c}
              index={i}
              count={counts ? (counts[c.name] ?? 0) : undefined}
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
