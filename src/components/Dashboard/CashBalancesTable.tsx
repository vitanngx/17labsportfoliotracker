import { formatCurrency } from "@/lib/formatters";
import { CashBalance } from "@/types/portfolio";
import SectionCard from "@/components/Dashboard/SectionCard";

interface CashBalancesTableProps {
  cashBalances: CashBalance[];
}

export default function CashBalancesTable({ cashBalances }: CashBalancesTableProps) {
  return (
    <SectionCard
      title="Cash Balances"
      subtitle="Cash is tracked from deposits, withdrawals, dividends, and trade settlement flows."
    >
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Balance</th>
              <th>Base Value</th>
              <th>FX Rate</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {cashBalances.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-mist">
                  No cash balances recorded yet.
                </td>
              </tr>
            ) : (
              cashBalances.map((balance) => (
                <tr key={balance.currency}>
                  <td className="font-medium text-ink">{balance.currency}</td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(balance.amount, balance.currency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {formatCurrency(balance.amountBase, balance.baseCurrency)}
                  </td>
                  <td className="mono text-sm text-ink">
                    {balance.fxRate?.toFixed(6) ?? "1.000000"}
                  </td>
                  <td className="mono text-sm text-ink">{balance.weightPct.toFixed(2)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
