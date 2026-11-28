"use client";

/**
 * WedPlan - Categories: data hook
 * Place at: components/home/categories/use-categories.ts
 *
 * Starts with the built-in DEFAULTS so the section never looks empty, then upgrades the six
 * categories with API text and live counts. If the API fails, defaults stay and counts become 0.
 *
 * counts === null  -> still loading (cards show a skeleton)
 * counts === {...} -> loaded (missing names count as 0)
 */

import {
  getCategories,
  getCategoryCounts,
  type Category,
} from "@/lib/services-api";
import { useEffect, useState } from "react";
import { DEFAULTS } from "./data";

export function useCategories() {
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
        // keep the six required categories in order, upgraded with API text when present
        const byName = new Map(cats.value.map((c) => [c.name, c]));

        setCategories(
          DEFAULTS.map((d) => {
            const api = byName.get(d.name);
            return {
              ...d,
              ...api,
              tags: api?.tags?.length ? api.tags : d.tags,
            };
          }),
        );
      }

      setCounts(cnt.status === "fulfilled" ? cnt.value : {});
    });

    return () => ctrl.abort();
  }, []);

  return { categories, counts };
}
