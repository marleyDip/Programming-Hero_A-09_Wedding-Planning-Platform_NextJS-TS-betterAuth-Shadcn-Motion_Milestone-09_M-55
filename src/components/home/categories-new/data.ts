/**
 * WedPlan - Categories: static data
 * Place at: components/home/categories/data.ts
 *
 * LOOK     -> colours + icon per category (UI only)
 * DEFAULTS -> text shown instantly, and used as the fallback if the API is unreachable
 */

import type { Category } from "@/lib/services-api";
import {
  Building2,
  Camera,
  Flower2,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface Look {
  icon: LucideIcon;
  from: string;
  to: string;
}

const VENUES: Look = {
  icon: Building2,
  from: "oklch(0.74 0.15 28)",
  to: "oklch(0.49 0.21 10)",
};

export const LOOK: Record<string, Look> = {
  "Photography & Videography": {
    icon: Camera,
    from: "oklch(0.7 0.16 305)",
    to: "oklch(0.43 0.2 285)",
  },
  "Wedding Venues": VENUES,
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

export const getLook = (name: string): Look => LOOK[name] ?? VENUES;

/** Bento: on lg (4 columns) the first and last cards are double width. */
export const isWide = (index: number) => index === 0 || index === 5;

export const DEFAULTS: Category[] = [
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
