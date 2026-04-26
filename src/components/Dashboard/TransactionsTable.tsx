import { formatCurrency, formatDateLabel, formatNumber } from "@/lib/formatters";
import { transactionCashAmount } from "@/lib/transactions";
import { Transaction } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

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
  const sorted = [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    return right.id.localeCompare(left.id);
  });

  return (
    <SectionCard
      title="Transaction History"
      subtitle="This ledger is the single source of truth for holdings, cash, realized PnL, and history."
    >
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Fees</th>
              <th>Cash Impact</th>
              {editable ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 8 : 7}
                  className="py-10 text-center text-sm text-mist"
                >
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              sorted.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="text-sm text-ink">{formatDateLabel(transaction.date)}</td>
                  <td>
                    <p className="font-medium text-ink">{transaction.asset}</p>
                    <p className="text-xs text-mist">
                      {transaction.assetClass.replaceAll("_", " ")}
                    </p>
                  </td>
                  <td>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-ink">
                      {transaction.type}
                    </span>
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatNumber(transaction.quantity, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transaction.price, transaction.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transaction.fees, transaction.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(transactionCashAmount(transaction), transaction.currency)}
                  </td>
                  {editable ? (
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="secondary-button px-3 py-2 text-xs"
                          type="button"
                          onClick={() => onEdit?.(transaction)}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary-button px-3 py-2 text-xs text-negative"
                          type="button"
                          onClick={() => onDelete?.(transaction)}
                        >
                          Delete
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
