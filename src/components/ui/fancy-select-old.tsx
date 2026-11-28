"use client";

/**
 * WedPlan - 3D custom dropdown select
 * Place at: components/ui/fancy-select.tsx
 *
 * - "Keycap" trigger with a solid 3D bottom edge that presses down on click
 * - Panel flips open from the top with perspective; options stagger in
 * - Fully keyboard accessible (ArrowUp/Down, Home/End, Enter/Space, Esc, Tab) with proper
 *
 *   combobox / listbox roles, closes on outside click, scrolls the highlighted option into view
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  icon?: LucideIcon;
  className?: string;
}

export default function FancySelectOld({
  label,
  value,
  onChange,
  options,
  icon: LeadIcon,
  className = "",
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [hi, setHi] = useState(selected);
  const current = options[selected];

  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onDown);

    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-opt-${hi}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [hi, open, id]);

  const openMenu = () => {
    setHi(selected);
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) setHi((h) => Math.min(h + 1, last));
        else openMenu();
        break;

      case "ArrowUp":
        e.preventDefault();
        if (open) {
          setHi((h) => Math.max(h - 1, 0));
        } else {
          openMenu();
        }
        break;

      case "Home":
        if (open) {
          e.preventDefault();
          setHi(0);
        }
        break;

      case "End":
        if (open) {
          e.preventDefault();
          setHi(last);
        }
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (open) {
          choose(hi);
        } else {
          openMenu();
        }
        break;

      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;

      case "Tab":
        setOpen(false);
        break;
    }
  };

  const CurrentIcon = current?.icon ?? LeadIcon;

  return (
    <div
      ref={root}
      className={`relative ${open ? "z-40" : "z-10"} ${className}`}
    >
      {label && (
        <span
          id={`${id}-label`}
          className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {label}
        </span>
      )}

      <motion.button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label ?? "Select an option"}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-activedescendant={open ? `${id}-opt-${hi}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        whileTap={
          reduce
            ? undefined
            : {
                y: 4,
                boxShadow:
                  "0 0px 0 0 var(--border), 0 6px 14px -8px rgba(0,0,0,0.3)",
              }
        }
        className={`group flex h-14 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brand/30 ${
          open ? "border-brand" : "border-border hover:border-brand/50"
        }`}
        style={{
          boxShadow:
            "0 4px 0 0 var(--border), 0 12px 22px -12px rgba(0,0,0,0.35)",
        }}
      >
        {CurrentIcon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <CurrentIcon className="h-4 w-4" />
          </span>
        )}

        <span
          className={`min-w-0 flex-1 truncate text-sm font-semibold ${value ? "text-foreground" : "text-muted-foreground"}`}
        >
          {current?.label}
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label ?? "Select an option"}
            aria-labelledby={label ? `${id}-label` : undefined}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, rotateX: -75, y: -8, scale: 0.96 }
            }
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    rotateX: -50,
                    y: -6,
                    transition: { duration: 0.16 },
                  }
            }
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ transformOrigin: "top center", transformPerspective: 900 }}
            className="absolute left-0 right-0 top-full z-50 mt-2.5 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/25 backdrop-blur-xl"
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              const isHi = i === hi;
              const Icon = o.icon;
              return (
                <motion.li
                  key={o.value || "__all"}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={isSel}
                  initial={reduce ? false : { opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                  onPointerEnter={() => setHi(i)}
                  onClick={() => choose(i)}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isHi
                      ? "bg-brand-soft text-foreground"
                      : "text-foreground/85"
                  }`}
                >
                  {isHi && !reduce && (
                    <motion.span
                      layoutId={`${id}-hl`}
                      className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 36,
                      }}
                    />
                  )}

                  {Icon && (
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isSel ? "text-brand" : "text-muted-foreground"}`}
                    />
                  )}

                  <span
                    className={`min-w-0 flex-1 truncate ${isSel ? "font-semibold" : ""}`}
                  >
                    {o.label}
                  </span>

                  {o.count !== undefined && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {o.count}
                    </span>
                  )}

                  {isSel && (
                    <Check
                      className="h-4 w-4 shrink-0 text-brand"
                      strokeWidth={3}
                    />
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
