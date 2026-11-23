// app/payment/success/page.tsx
import type { Metadata } from "next";
import { PaymentSuccess } from "@/components/payment/payment-success";

export const metadata: Metadata = {
  title: "Payment successful",
  description: "Confirming your WedPlan Premium payment.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PaymentSuccess />;
}
