"use client";

import { formatCurrency, formatNumber, formatPercent, formatSignedCurrency } from "@/lib/formatters";
import { getAssetDisplayName } from "@/lib/assetNames";
import { Holding } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";
import { useI18n } from "@/components/I18nProvider";

interface HoldingsTableProps {
  holdings: Holding[];
}

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
  const { t, intlLocale } = useI18n();

  return (
    <SectionCard title={t("sections.holdings")}>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>{t("tables.asset")}</th>
              <th>{t("tables.quantity")}</th>
              <th>{t("tables.avgCost")}</th>
              <th>{t("tables.currentPrice")}</th>
              <th>{t("tables.marketValue")}</th>
              <th>{t("tables.valueBase")}</th>
              <th>{t("tables.weight")}</th>
              <th>{t("tables.unrealizedPnl")}</th>
              <th>{t("tables.return")}</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-mist">
                  {t("tables.emptyHoldings")}
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
                    {formatNumber(holding.quantity, { maximumFractionDigits: 6 }, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.averageBuyPrice, holding.currency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {holding.currentPrice === null
                      ? t("common.unavailable")
                      : formatCurrency(holding.currentPrice, holding.currency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.marketValue, holding.currency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(holding.marketValueBase, holding.baseCurrency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">{formatPercent(holding.weightPct, 2, intlLocale)}</td>
                  <td
                    className={`mono text-sm ${
                      holding.unrealizedPnlBase >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatSignedCurrency(holding.unrealizedPnlBase, holding.baseCurrency, undefined, intlLocale)}
                  </td>
                  <td
                    className={`mono text-sm ${
                      holding.unrealizedPnlPct >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {formatPercent(holding.unrealizedPnlPct, 2, intlLocale)}
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
