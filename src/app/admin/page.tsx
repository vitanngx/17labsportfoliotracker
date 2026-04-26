import { redirect } from "next/navigation";
import { isAdminFromCookieStore } from "@/lib/auth";
import AdminLoginForm from "@/components/Dashboard/AdminLoginForm";

export default function AdminLoginPage() {
  if (isAdminFromCookieStore()) {
    redirect("/admin/dashboard");
  }

  return <AdminLoginForm />;
}
