"use client";

import React from "react";
import AllocationDonut from "@/components/Dashboard/AllocationDonut";
import CashBalancesTable from "@/components/Dashboard/CashBalancesTable";
import HoldingsTable from "@/components/Dashboard/HoldingsTable";
import MetricCard from "@/components/Dashboard/MetricCard";
import PerformanceChart from "@/components/Dashboard/PerformanceChart";
import SectionCard from "@/components/Dashboard/SectionCard";
import TransactionForm from "@/components/Dashboard/TransactionForm";
import TransactionsTable from "@/components/Dashboard/TransactionsTable";
import { formatCurrency, formatPercent, formatSignedCurrency } from "@/lib/formatters";
import { CsvImportRow, PortfolioPayload, Transaction, TransactionInput } from "@/types/portfolio";
import { useRouter } from "next/navigation";

interface PortfolioDashboardProps {
  mode: "public" | "admin";
  initialPayload: PortfolioPayload;
}

export default function PortfolioDashboard({
  mode,
  initialPayload
}: PortfolioDashboardProps) {
  const router = useRouter();
  const [payload, setPayload] = React.useState(initialPayload);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [adminError, setAdminError] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const pollingInFlightRef = React.useRef(false);

  const isAdminMode = mode === "admin";

  React.useEffect(() => {
    setLastUpdatedAt(new Date());
  }, []);

  async function refreshPortfolio(options?: { silent?: boolean }) {
    if (pollingInFlightRef.current) {
      return;
    }

    pollingInFlightRef.current = true;
    const response = await fetch("/api/portfolio", {
      cache: "no-store"
    });
    try {
      if (!response.ok) {
        if (!options?.silent) {
          setAdminError("Unable to refresh portfolio data.");
        }
        return;
      }

      const nextPayload = (await response.json()) as PortfolioPayload;
      setPayload(nextPayload);
      setLastUpdatedAt(new Date());
      if (!options?.silent) {
        router.refresh();
      }
    } finally {
      pollingInFlightRef.current = false;
    }
  }

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden || pollingInFlightRef.current) {
        return;
      }

      void refreshPortfolio({ silent: true });
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  async function handleTransactionSubmit(input: TransactionInput, transactionId?: string) {
    setBusy(true);
    setAdminError(null);

    const response = await fetch(
      transactionId ? `/api/admin/transactions/${transactionId}` : "/api/admin/transactions",
      {
        method: transactionId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      }
    );
    const result = (await response.json()) as { ok: boolean; error?: string };
    setBusy(false);

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? "Unable to save the transaction.");
    }

    setEditingTransaction(null);
    await refreshPortfolio();
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete transaction for ${transaction.asset} on ${transaction.date}?`)) {
      return;
    }

    setBusy(true);
    setAdminError(null);
    const response = await fetch(`/api/admin/transactions/${transaction.id}`, {
      method: "DELETE"
    });
    const result = (await response.json()) as { ok: boolean; error?: string };
    setBusy(false);

    if (!response.ok || !result.ok) {
      setAdminError(result.error ?? "Unable to delete the transaction.");
      return;
    }

    if (editingTransaction?.id === transaction.id) {
      setEditingTransaction(null);
    }

    await refreshPortfolio();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/dashboard";
    router.refresh();
  }

  async function handleBaseCurrencyChange(baseCurrency: string) {
    setBusy(true);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ baseCurrency })
    });
    const result = (await response.json()) as { ok: boolean; error?: string };
    setBusy(false);

    if (!response.ok || !result.ok) {
      setAdminError(result.error ?? "Unable to update the base currency.");
      return;
    }

    await refreshPortfolio();
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setAdminError(null);
    try {
      const text = await file.text();
      const rows = parseCsvTransactions(text);
      const response = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "CSV import failed.");
      }
      await refreshPortfolio();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const { portfolio, transactions, settings, marketWarnings } = payload;
  const systemWarnings = [...portfolio.warnings, ...marketWarnings];

  return (
    <main className="relative overflow-hidden px-4 pb-16 pt-6 md:px-8 xl:px-10">
      <div className="mx-auto max-w-[1760px] space-y-6">
        <header className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="section-title text-accent">
                {isAdminMode ? "Admin Dashboard" : "Public Dashboard"}
              </p>
              <h1 className="headline mt-3 text-4xl md:text-5xl">
                My Portfolio Tracker
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-mist md:text-base">
                {isAdminMode
                  ? "I built this application to track my personal investment portfolio, monitor transactions, analyze allocation, and review portfolio performance over time."
                  : "I built this application to track my personal investment portfolio, monitor transactions, analyze allocation, and review portfolio performance over time."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-line px-4 py-3 text-sm text-mist">
                Base currency: <span className="text-ink">{settings.baseCurrency}</span>
              </div>
              <div className="rounded-full border border-line px-4 py-3 text-sm text-mist">
                Auto refresh: <span className="text-ink">60s</span> • Last update{" "}
                <span className="text-ink">
                  {lastUpdatedAt ? formatTimeLabel(lastUpdatedAt) : "--:--:--"}
                </span>
              </div>
              {isAdminMode ? (
                <button className="secondary-button" type="button" onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <a className="secondary-button" href="/admin">
                  Admin Login
                </a>
              )}
            </div>
          </div>
        </header>

        {systemWarnings.length > 0 || adminError ? (
          <section className="surface-panel-soft rounded-[24px] p-5">
            <p className="section-title text-gold">System Notes</p>
            <div className="mt-3 space-y-2 text-sm text-mist">
              {adminError ? <p className="text-negative">{adminError}</p> : null}
              {systemWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-5">
          <MetricCard
            label="Net Portfolio Value"
            value={formatCurrency(portfolio.summary.totalPortfolioValueBase, settings.baseCurrency)}
            detail={`Gross exposure ${formatCurrency(portfolio.summary.grossExposureBase, settings.baseCurrency)} • Cash ${formatCurrency(portfolio.summary.totalCashValueBase, settings.baseCurrency)}`}
          />
          <MetricCard
            label="Gross Exposure"
            value={formatCurrency(portfolio.summary.grossExposureBase, settings.baseCurrency)}
            detail="Total holdings market value before cash surplus or deficit is applied."
          />
          <MetricCard
            label="Total Return"
            value={formatPercent(portfolio.summary.totalReturnPct)}
            detail={`Max drawdown ${
              portfolio.summary.maxDrawdownPct === null
                ? "N/A"
                : formatPercent(portfolio.summary.maxDrawdownPct)
            }`}
            tone={portfolio.summary.totalReturnPct >= 0 ? "positive" : "negative"}
          />
          <MetricCard
            label="Unrealized PnL"
            value={formatSignedCurrency(
              portfolio.summary.totalUnrealizedPnlBase,
              settings.baseCurrency
            )}
            detail={`Realized ${formatSignedCurrency(portfolio.summary.totalRealizedPnlBase, settings.baseCurrency)} • Dividends ${formatSignedCurrency(portfolio.summary.totalDividendIncomeBase, settings.baseCurrency)}`}
            tone={
              portfolio.summary.totalUnrealizedPnlBase >= 0 ? "positive" : "negative"
            }
          />
          <MetricCard
            label="Risk Snapshot"
            value={
              portfolio.summary.sharpeRatio === null
                ? "N/A"
                : portfolio.summary.sharpeRatio.toFixed(2)
            }
            detail={
              portfolio.summary.volatility === null
                ? "Need more history"
                : `Annualized volatility ${portfolio.summary.volatility.toFixed(2)}%`
            }
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-12 xl:items-stretch">
          <div className="xl:col-span-7">
            <PerformanceChart
              currency={settings.baseCurrency}
              className="h-full"
            />
          </div>
          <div className="xl:col-span-5">
            <AllocationDonut
              title="Allocation by Asset"
              data={portfolio.summary.allocationByAsset}
              currency={settings.baseCurrency}
              className="h-full"
              chartHeightClass="h-[236px]"
              legendLimit={5}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-12 xl:items-stretch">
          <div className="xl:col-span-6">
            <AllocationDonut
              title="Allocation by Asset Class"
              data={portfolio.summary.allocationByClass}
              currency={settings.baseCurrency}
              className="h-full"
              chartHeightClass="h-[260px]"
            />
          </div>
          <div className="xl:col-span-6">
            <CashBalancesTable cashBalances={portfolio.cashBalances} className="h-full" />
          </div>
        </section>

        <section>
          <HoldingsTable holdings={portfolio.holdings} />
        </section>

        {isAdminMode ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <SectionCard
              title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
            >
              <TransactionForm
                onSubmit={handleTransactionSubmit}
                editingTransaction={editingTransaction}
                onCancelEdit={() => setEditingTransaction(null)}
              />
            </SectionCard>
            <SectionCard
              title="Admin Controls"
            >
              <div className="space-y-5">
                <label className="block">
                  <span className="field-label mb-2 block">Base Currency</span>
                  <select
                    className="field-input"
                    value={settings.baseCurrency}
                    onChange={(event) => void handleBaseCurrencyChange(event.target.value)}
                    disabled={busy}
                  >
                    {["USD", "EUR", "VND"].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label mb-2 block">Import CSV</span>
                  <input
                    className="field-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void handleCsvImport(event)}
                    disabled={busy}
                  />
                </label>
              </div>
            </SectionCard>
          </section>
        ) : null}

        <TransactionsTable
          transactions={transactions}
          editable={isAdminMode}
          onEdit={(transaction) => setEditingTransaction(transaction)}
          onDelete={(transaction) => void handleDeleteTransaction(transaction)}
        />
      </div>
    </main>
  );
}

function parseCsvTransactions(rawCsv: string): CsvImportRow[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV import needs a header row and at least one data row.");
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const columns = line.split(",").map((column) => column.trim());
    const record = Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""]));

    return {
      date: record.date,
      asset: record.asset,
      assetClass: record.assetClass,
      type: record.type,
      quantity: Number(record.quantity),
      price: Number(record.price),
      fees: Number(record.fees || "0"),
      currency: record.currency,
      note: record.note
    } as CsvImportRow;
  });

  return rows;
}

function formatTimeLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}
