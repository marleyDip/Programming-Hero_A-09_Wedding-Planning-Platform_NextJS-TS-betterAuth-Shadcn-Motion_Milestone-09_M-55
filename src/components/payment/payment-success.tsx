"use client";

/**
 * WedPlan - Payment success page content
 * Place at: components/payment/payment-success.tsx
 * Used by: app/payment/success/page.tsx   (Stripe sends vendors here after paying)
 *
 * IMPORTANT: landing here does NOT prove the payment worked, and this page never turns Premium on.
 * Premium is activated only by the verified Stripe webhook on the server. So this page asks the server
 * (GET /users/me) every few seconds until the webhook has arrived, and only then says "Premium is active".
 * If it takes longer than about a minute, it says so honestly and offers "Check again".
 */

import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/bookings-api";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Phase = "confirming" | "active" | "slow";

const INTERVAL_MS = 2500;
const MAX_TRIES = 24; // about one minute

async function isPremiumOnServer(): Promise<boolean> {
  const me = await api<{ isPremium?: boolean }>("/users/me");

  return me.isPremium === true;
}

function Content() {
  const reduce = useReducedMotion();
  const sessionId = useSearchParams().get("session_id");
  const [phase, setPhase] = useState<Phase>("confirming");
  const [attempt, setAttempt] = useState(0); // bump to start checking again

  useEffect(() => {
    let stop = false;
    let tries = 0;

    const tick = async () => {
      if (stop) return;

      try {
        if (await isPremiumOnServer()) {
          // refresh the browser's cached session so the navbar and dashboard show Premium straight away
          await authClient
            .getSession({ query: { disableCookieCache: true } })
            .catch(() => {});
          if (!stop) setPhase("active");
          return;
        }
      } catch {
        /* server briefly unreachable: keep trying */
      }

      tries += 1;
      if (tries >= MAX_TRIES) {
        if (!stop) setPhase("slow");
        return;
      }

      setTimeout(tick, INTERVAL_MS);
    };

    tick();
    return () => {
      stop = true;
    };
  }, [attempt]);

  const active = phase === "active";
  const slow = phase === "slow";

  return (
    <main className="relative grid min-h-[80vh] place-items-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--brand)_14%,transparent),transparent)]"
      />

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 40, rotateX: -14 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16 }}
        className="w-full max-w-lg rounded-4xl border border-border bg-card p-8 text-center shadow-2xl shadow-black/10 sm:p-10"
        aria-live="polite"
      >
        <motion.div
          key={phase}
          initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className={`mx-auto grid h-20 w-20 place-items-center rounded-3xl shadow-xl ${active ? "bg-linear-to-br from-[oklch(0.88_0.14_85)] to-[oklch(0.7_0.16_55)] text-neutral-900" : "bg-brand-soft text-brand"}`}
        >
          {active ? (
            <Crown className="h-10 w-10" />
          ) : slow ? (
            <Clock className="h-10 w-10" />
          ) : (
            <Loader2 className="h-10 w-10 animate-spin" />
          )}
        </motion.div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {active
            ? "You're a Premium vendor"
            : slow
              ? "Still confirming your payment"
              : "Confirming your payment…"}
        </h1>

        <p className="mt-3 text-muted-foreground">
          {active
            ? "Thank you! Premium is now active on your account: unlimited active services and the Premium Vendor badge on your listings."
            : slow
              ? "Stripe has taken you back here, but we haven't received the payment confirmation yet. This can take a little longer. Your account upgrades automatically as soon as it arrives. You won't be charged twice."
              : "Please keep this page open. We're waiting for Stripe to confirm the payment, which usually takes a few seconds."}
        </p>

        {sessionId && (
          <p className="mt-4 text-xs text-muted-foreground">
            Reference <span className="font-mono">{sessionId.slice(-10)}</span>
          </p>
        )}

        {phase === "confirming" && (
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-brand" /> Checkout completed
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Waiting for payment
              confirmation
            </li>
            <li className="flex items-center gap-2 text-muted-foreground/60">
              <Crown className="h-4 w-4" /> Activating Premium
            </li>
          </ul>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {active ? (
            <>
              <Link
                href="/dashboard/vendor/services/new"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:opacity-90"
              >
                <PlusCircle className="h-4 w-4" /> Add a service
              </Link>
              <Link
                href="/dashboard/vendor"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              {slow && (
                <button
                  onClick={() => {
                    setPhase("confirming");
                    setAttempt((n) => n + 1);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:opacity-90"
                >
                  <RefreshCw className="h-4 w-4" /> Check again
                </button>
              )}
              <Link
                href="/dashboard/vendor/subscription"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted"
              >
                Back to subscription
              </Link>
            </>
          )}
        </div>
      </motion.section>
    </main>
  );
}

export function PaymentSuccess() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
