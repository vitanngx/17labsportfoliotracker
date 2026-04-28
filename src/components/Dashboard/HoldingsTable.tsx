import { formatCurrency, formatNumber, formatPercent, formatSignedCurrency } from "@/lib/formatters";
import { getAssetDisplayName } from "@/lib/assetNames";
import { Holding } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

interface HoldingsTableProps {
  holdings: Holding[];
}

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <SectionCard title="Holdings">
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Quantity</th>
              <th>Avg Cost</th>
              <th>Current Price</th>
              <th>Market Value</th>
              <th>Value Base</th>
              <th>Weight</th>
              <th>Unrealized PnL</th>
              <th>Return</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-mist">
                  No open positions yet.
                </td>
              </tr>
            ) : (
              holdings.map((holding) => (
                <tr key={`${holding.assetClass}:${holding.asset}`}>
                  <td>
                    <p className="font-medium text-ink">{holding.asset}</p>
                    <p className="mt-1 text-xs text-mist">{getAssetDisplayName(holding.asset)}</p>
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatNumber(holding.quantity, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.averageBuyPrice, holding.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {holding.currentPrice === null
                      ? "Unavailable"
                      : formatCurrency(holding.currentPrice, holding.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.marketValue, holding.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.marketValueBase, holding.baseCurrency)}
                  </td>
                  <td className="mono text-sm text-ink">{holding.weightPct.toFixed(2)}%</td>
                  <td
                    className={`mono text-sm ${
                      holding.unrealizedPnlBase >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatSignedCurrency(holding.unrealizedPnlBase, holding.baseCurrency)}
                  </td>
                  <td
                    className={`mono text-sm ${
                      holding.unrealizedPnlPct >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatPercent(holding.unrealizedPnlPct)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
