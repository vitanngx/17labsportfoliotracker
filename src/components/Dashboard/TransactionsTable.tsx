"use client";

import { formatCurrency, formatDateLabel, formatNumber } from "@/lib/formatters";
import { getAssetDisplayName } from "@/lib/assetNames";
import { transactionCashAmount } from "@/lib/transactions";
import { Transaction } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";
import { useI18n } from "@/components/I18nProvider";

interface TransactionsTableProps {
  transactions: Transaction[];
  editable?: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

export default function TransactionsTable({
  transactions,
  editable = false,
  onEdit,
  onDelete
}: TransactionsTableProps) {
  const { t, intlLocale } = useI18n();
  const sorted = [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return right.id.localeCompare(left.id);
  });

  return (
    <SectionCard title={t("sections.transactionHistory")}>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>{t("tables.date")}</th>
              <th>{t("tables.asset")}</th>
              <th>{t("tables.type")}</th>
              <th>{t("tables.quantity")}</th>
              <th>{t("tables.price")}</th>
              <th>{t("tables.fees")}</th>
              <th>{t("tables.cashImpact")}</th>
              {editable ? <th>{t("common.actions")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 8 : 7}
                  className="py-10 text-center text-sm text-mist"
                >
                  {t("tables.emptyTransactions")}
                </td>
              </tr>
            ) : (
              sorted.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="text-sm text-ink">{formatDateLabel(transaction.date, intlLocale)}</td>
                  <td>
                    <p className="font-medium text-ink">{transaction.asset}</p>
                    <p className="text-xs text-mist">{getAssetDisplayName(transaction.asset)}</p>
                  </td>
                  <td>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-ink">
                      {transaction.type}
                    </span>
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatNumber(transaction.quantity, { maximumFractionDigits: 6 }, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transaction.price, transaction.currency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transaction.fees, transaction.currency, undefined, intlLocale)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transactionCashAmount(transaction), transaction.currency, undefined, intlLocale)}
                  </td>
                  {editable ? (
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="secondary-button px-3 py-2 text-xs"
                          type="button"
                          onClick={() => onEdit?.(transaction)}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          className="secondary-button px-3 py-2 text-xs text-negative"
                          type="button"
                          onClick={() => onDelete?.(transaction)}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
