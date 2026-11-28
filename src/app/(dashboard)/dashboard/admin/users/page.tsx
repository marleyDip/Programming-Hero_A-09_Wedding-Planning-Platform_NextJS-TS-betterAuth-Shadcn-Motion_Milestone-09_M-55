import ManageUsers from "@/components/dashboard/admin/manage-users";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Users",
  description: "Search, review, block and unblock registered users.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function ManageUsersPage() {
  return <ManageUsers />;
}
