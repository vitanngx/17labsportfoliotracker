import { redirect } from "next/navigation";
import PortfolioDashboard from "@/components/Dashboard/PortfolioDashboard";
import { buildPortfolioPayload } from "@/lib/portfolioService";
import { isAdminFromCookieStore } from "@/lib/auth";

export default async function AdminDashboardPage() {
  if (!isAdminFromCookieStore()) {
    redirect("/admin");
  }

  const payload = await buildPortfolioPayload(true);

  return <PortfolioDashboard mode="admin" initialPayload={payload} />;
}
