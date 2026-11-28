import AdminOverview from "@/components/dashboard/admin/admin-overview";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Overview",
  description: "Platform totals, pending reviews and latest payments.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function AdminOverviewPage() {
  return <AdminOverview />;
}
