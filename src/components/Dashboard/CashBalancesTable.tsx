"use client";

import { formatCurrency } from "@/lib/formatters";
import { CashBalance } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";
import { useI18n } from "@/components/I18nProvider";

interface CashBalancesTableProps {
  cashBalances: CashBalance[];
  className?: string;
}

export default function CashBalancesTable({
  cashBalances,
  className = ""
}: CashBalancesTableProps) {
  const { t, intlLocale } = useI18n();
  const negativeCashBalances = cashBalances.filter((balance) => balance.amount < 0);

  return (
    <SectionCard title={t("sections.cashBalances")} className={className}>
      {negativeCashBalances.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-negative/25 bg-negative/10 px-4 py-2.5 text-xs leading-relaxed text-negative sm:text-sm">
          {t("cash.deficitWarning")}
        </div>
      ) : null}
      <div className="flex-1 overflow-x-auto lg:overflow-x-visible">
        <table className="data-table w-full table-fixed">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[22%]" />
            <col className="w-[24%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr>
              <th>{t("tables.currency")}</th>
              <th>{t("tables.status")}</th>
              <th className="text-right">{t("tables.balance")}</th>
              <th className="text-right">{t("tables.baseValue")}</th>
              <th className="text-right">{t("tables.fxRate")}</th>
            </tr>
          </thead>
          <tbody>
            {cashBalances.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-mist">
                  {t("cash.empty")}
                </td>
              </tr>
            ) : (
              cashBalances.map((balance) => (
                <tr key={balance.currency}>
                  <td className="font-medium text-ink">{balance.currency}</td>
                  <td className="text-sm">
                    {balance.amount < 0 ? (
                      <span className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border border-negative/30 bg-negative/10 px-3 text-xs font-semibold text-negative">
                        {t("cash.deficit")}
                      </span>
                    ) : (
                      <span className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border border-line bg-white/[0.02] px-3 text-xs font-semibold text-mist">
                        {t("cash.available")}
                      </span>
                    )}
                  </td>
                  <td className={`mono whitespace-nowrap text-right text-sm tabular-nums ${balance.amount < 0 ? "text-negative" : "text-ink"}`}>
                    {formatCurrency(balance.amount, balance.currency, undefined, intlLocale)}
                  </td>
                  <td className={`mono whitespace-nowrap text-right text-sm tabular-nums ${balance.amountBase < 0 ? "text-negative" : "text-ink"}`}>
                    {formatCurrency(balance.amountBase, balance.baseCurrency, undefined, intlLocale)}
                  </td>
                  <td className="mono whitespace-nowrap text-right text-sm tabular-nums text-ink">
                    {formatFxRate(balance.fxRate, intlLocale)}
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

function formatFxRate(rate: number | null, locale: string) {
  if (!Number.isFinite(rate)) {
    return "1.0000";
  }

  const safeRate = rate ?? 1;
  const fractionDigits = Math.abs(safeRate - 1) < 0.0000001 ? 4 : Math.abs(safeRate) >= 1 ? 2 : 6;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(safeRate);
}
