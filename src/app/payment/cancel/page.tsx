// app/payment/cancel/page.tsx
import type { Metadata } from "next";
import { PaymentCancel } from "@/components/payment/payment-cancel";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  description: "Your WedPlan Premium checkout was cancelled. No payment was made.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PaymentCancel />;
}
