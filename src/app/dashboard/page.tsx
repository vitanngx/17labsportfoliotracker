import PortfolioDashboard from "@/components/Dashboard/PortfolioDashboard";
import { buildPortfolioPayload } from "@/lib/portfolioService";

export default async function PublicDashboardPage() {
  const payload = await buildPortfolioPayload(false);

  return <PortfolioDashboard mode="public" initialPayload={payload} />;
}
