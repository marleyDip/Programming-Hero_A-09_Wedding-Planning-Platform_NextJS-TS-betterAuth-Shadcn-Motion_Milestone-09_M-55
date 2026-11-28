import Transactions from "@/components/dashboard/admin/transactions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Read-only list of Premium subscription payments.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function TransactionsPage() {
  return <Transactions />;
}
