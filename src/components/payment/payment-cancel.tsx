"use client";

/**
 * WedPlan - Payment cancelled page content
 * Place at: components/payment/payment-cancel.tsx
 * Used by: app/payment/cancel/page.tsx   (Stripe sends vendors here if they leave checkout)
 * Nothing was charged and nothing changed on the account.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Crown, LayoutDashboard, XCircle } from "lucide-react";
import Link from "next/link";

export function PaymentCancel() {
  const reduce = useReducedMotion();

  return (
    <main className="relative grid min-h-[80vh] place-items-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent)]"
      />

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 40, rotateX: -14 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16 }}
        className="w-full max-w-lg rounded-4xl border border-border bg-card p-8 text-center shadow-2xl shadow-black/10 sm:p-10"
      >
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-muted text-muted-foreground shadow-xl">
          <XCircle className="h-10 w-10" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Checkout cancelled
        </h1>
        <p className="mt-3 text-muted-foreground">
          No payment was made and your plan hasn&apos;t changed. You can keep
          using the Free plan, or upgrade to Premium whenever you&apos;re ready.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard/vendor/subscription"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:opacity-90"
          >
            <Crown className="h-4 w-4" /> Try again
          </Link>
          <Link
            href="/dashboard/vendor"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </motion.section>
    </main>
  );
}
