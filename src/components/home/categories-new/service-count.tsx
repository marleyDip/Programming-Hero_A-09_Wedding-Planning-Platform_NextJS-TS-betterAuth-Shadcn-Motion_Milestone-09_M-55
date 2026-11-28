"use client";

/**
 * WedPlan - Categories: animated "N services" label
 * Place at: components/home/categories/service-count.tsx
 *
 * value === undefined -> skeleton pill while counts load
 * Counts up once when scrolled into view (instant when reduced motion is on).
 */

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export default function ServiceCount({ value }: { value: number | undefined }) {
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

    const controls = animate(0, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });

    return () => controls.stop();
  }, [value, inView, reduce]);

  if (value === undefined) {
    return (
      <span
        ref={ref}
        aria-hidden
        className="inline-block h-3 w-14 animate-pulse rounded-full bg-white/40"
      />
    );
  }

  return (
    <>
      <span ref={ref}>0</span> {value === 1 ? "service" : "services"}
    </>
  );
}
