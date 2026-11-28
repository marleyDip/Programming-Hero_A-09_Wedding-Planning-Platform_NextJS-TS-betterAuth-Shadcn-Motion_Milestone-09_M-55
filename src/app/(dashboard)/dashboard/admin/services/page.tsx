import ManageServices from "@/components/dashboard/admin/manage-services";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Services",
  description: "Review, approve, reject and delete submitted services.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function ManageServicesPage() {
  return <ManageServices />;
}
