"use client";

import React from "react";
import AllocationDonut from "@/components/Dashboard/AllocationDonut";
import BenchmarkPerformanceChart from "@/components/Dashboard/BenchmarkPerformanceChart";
import CashBalancesTable from "@/components/Dashboard/CashBalancesTable";
import HoldingsTable from "@/components/Dashboard/HoldingsTable";
import MetricCard from "@/components/Dashboard/MetricCard";
import PerformanceChart from "@/components/Dashboard/PerformanceChart";
import SectionCard from "@/components/Dashboard/SectionCard";
import TransactionForm from "@/components/Dashboard/TransactionForm";
import TransactionsTable from "@/components/Dashboard/TransactionsTable";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
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
  const { t, intlLocale } = useI18n();
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
          setAdminError(t("admin.refreshError"));
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
      throw new Error(result.error ?? t("admin.saveTransactionError"));
    }

    setEditingTransaction(null);
    await refreshPortfolio();
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    if (!window.confirm(t("admin.deleteConfirm", { asset: transaction.asset, date: transaction.date }))) {
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
      setAdminError(result.error ?? t("admin.deleteError"));
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
      setAdminError(result.error ?? t("admin.updateBaseCurrencyError"));
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
      const rows = parseCsvTransactions(text, t("form.csvHeaderError"));
      const response = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows })
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? t("form.csvImportFailed"));
      }
      await refreshPortfolio();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : t("form.csvImportFailed"));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const { portfolio, transactions, settings, marketWarnings } = payload;
  const systemWarnings = [...portfolio.warnings, ...marketWarnings];
  const money = React.useCallback(
    (value: number, currency: string) => formatCurrency(value, currency, undefined, intlLocale),
    [intlLocale]
  );
  const signedMoney = React.useCallback(
    (value: number, currency: string) => formatSignedCurrency(value, currency, undefined, intlLocale),
    [intlLocale]
  );
  const percent = React.useCallback(
    (value: number) => formatPercent(value, 2, intlLocale),
    [intlLocale]
  );

  return (
    <main className="relative overflow-hidden px-4 pb-16 pt-6 md:px-8 xl:px-10">
      <div className="mx-auto max-w-[1760px] space-y-6">
        <header className="surface-panel rounded-[32px] px-6 py-7 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="section-title text-accent">
                {isAdminMode ? t("common.adminDashboard") : t("common.publicDashboard")}
              </p>
              <h1 className="headline mt-3 text-4xl md:text-5xl">
                {t("common.appName")}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-mist md:text-base">
                {t("common.appDescription")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <LanguageSwitcher />
              <div className="rounded-full border border-line px-4 py-3 text-sm text-mist">
                {t("common.baseCurrency")}: <span className="text-ink">{settings.baseCurrency}</span>
              </div>
              <div className="rounded-full border border-line px-4 py-3 text-sm text-mist">
                {t("common.autoRefresh")}: <span className="text-ink">60s</span> • {t("common.lastUpdate")}{" "}
                <span className="text-ink">
                  {lastUpdatedAt ? formatTimeLabel(lastUpdatedAt, intlLocale) : "--:--:--"}
                </span>
              </div>
              {isAdminMode ? (
                <button className="secondary-button" type="button" onClick={handleLogout}>
                  {t("common.logout")}
                </button>
              ) : (
                <a className="secondary-button" href="/admin">
                  {t("common.adminLogin")}
                </a>
              )}
            </div>
          </div>
        </header>

        {systemWarnings.length > 0 || adminError ? (
          <section className="surface-panel-soft rounded-[24px] p-5">
            <p className="section-title text-gold">{t("common.systemNotes")}</p>
            <div className="mt-3 space-y-2 text-sm text-mist">
              {adminError ? <p className="text-negative">{adminError}</p> : null}
              {systemWarnings.map((warning) => (
                <p key={warning}>{localizeSystemWarning(warning, t)}</p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-5">
          <MetricCard
            label={t("metrics.netPortfolioValue")}
            value={money(portfolio.summary.totalPortfolioValueBase, settings.baseCurrency)}
            detail={t("metrics.grossExposureDetail", {
              value: money(portfolio.summary.grossExposureBase, settings.baseCurrency),
              cash: money(portfolio.summary.totalCashValueBase, settings.baseCurrency)
            })}
          />
          <MetricCard
            label={t("metrics.grossExposure")}
            value={money(portfolio.summary.grossExposureBase, settings.baseCurrency)}
            detail={t("metrics.grossExposureDescription")}
          />
          <MetricCard
            label={t("metrics.totalReturn")}
            value={percent(portfolio.summary.totalReturnPct)}
            detail={t("metrics.maxDrawdown", {
              value:
                portfolio.summary.maxDrawdownPct === null
                  ? t("common.notAvailable")
                  : percent(portfolio.summary.maxDrawdownPct)
            })}
            tone={portfolio.summary.totalReturnPct >= 0 ? "positive" : "negative"}
          />
          <MetricCard
            label={t("metrics.unrealizedPnl")}
            value={signedMoney(
              portfolio.summary.totalUnrealizedPnlBase,
              settings.baseCurrency
            )}
            detail={t("metrics.realizedDividends", {
              realized: signedMoney(portfolio.summary.totalRealizedPnlBase, settings.baseCurrency),
              dividends: signedMoney(portfolio.summary.totalDividendIncomeBase, settings.baseCurrency)
            })}
            tone={
              portfolio.summary.totalUnrealizedPnlBase >= 0 ? "positive" : "negative"
            }
          />
          <MetricCard
            label={t("metrics.riskSnapshot")}
            value={
              portfolio.summary.sharpeRatio === null
                ? t("common.notAvailable")
                : portfolio.summary.sharpeRatio.toFixed(2)
            }
            detail={
              portfolio.summary.volatility === null
                ? t("metrics.needMoreHistory")
                : t("metrics.annualizedVolatility", { value: portfolio.summary.volatility.toFixed(2) })
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
              title={t("sections.allocationByAsset")}
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
              title={t("sections.allocationByAssetClass")}
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

        <BenchmarkPerformanceChart />

        <section>
          <HoldingsTable holdings={portfolio.holdings} />
        </section>

        {isAdminMode ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <SectionCard
              title={editingTransaction ? t("sections.editTransaction") : t("sections.addTransaction")}
            >
              <TransactionForm
                onSubmit={handleTransactionSubmit}
                editingTransaction={editingTransaction}
                onCancelEdit={() => setEditingTransaction(null)}
              />
            </SectionCard>
            <SectionCard
              title={t("sections.adminControls")}
            >
              <div className="space-y-5">
                <label className="block">
                  <span className="field-label mb-2 block">{t("form.baseCurrency")}</span>
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
                  <span className="field-label mb-2 block">{t("form.importCsv")}</span>
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

function parseCsvTransactions(rawCsv: string, emptyMessage: string): CsvImportRow[] {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(emptyMessage);
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

function formatTimeLabel(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

function localizeSystemWarning(
  warning: string,
  t: (key: string) => string
) {
  if (warning.toLowerCase().includes("cash deficit detected")) {
    const currency = warning.split(":")[0]?.trim();
    return currency ? `${currency}: ${t("cash.deficitWarning")}` : t("cash.deficitWarning");
  }

  return warning;
}
