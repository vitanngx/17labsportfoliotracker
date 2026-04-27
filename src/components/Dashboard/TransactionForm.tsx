"use client";

import React from "react";
import { ASSET_CLASS_OPTIONS } from "@/lib/portfolioConfig";
import { AssetClass, Transaction, TransactionInput, TransactionType } from "@/types/portfolio";

const TRANSACTION_TYPE_OPTIONS: TransactionType[] = [
  "BUY",
  "SELL",
  "DIVIDEND",
  "CASH_IN",
  "CASH_OUT"
];

interface TransactionFormProps {
  onSubmit: (transaction: TransactionInput, transactionId?: string) => Promise<void>;
  editingTransaction?: Transaction | null;
  onCancelEdit?: () => void;
}

interface DraftState {
  date: string;
  asset: string;
  assetClass: AssetClass;
  type: TransactionType;
  quantity: string;
  price: string;
  fees: string;
  currency: string;
  note: string;
}

export default function TransactionForm({
  onSubmit,
  editingTransaction,
  onCancelEdit
}: TransactionFormProps) {
  const [draft, setDraft] = React.useState<DraftState>(createDraft());
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (editingTransaction) {
      setDraft({
        date: editingTransaction.date,
        asset: editingTransaction.asset,
        assetClass: editingTransaction.assetClass,
        type: editingTransaction.type,
        quantity: String(editingTransaction.quantity),
        price: String(editingTransaction.price),
        fees: String(editingTransaction.fees),
        currency: editingTransaction.currency,
        note: editingTransaction.note ?? ""
      });
      return;
    }

    setDraft(createDraft());
  }, [editingTransaction]);

  function updateField<Key extends keyof DraftState>(field: Key, value: DraftState[Key]) {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleAssetClassChange(nextAssetClass: AssetClass) {
    const nextDefaultCurrency = getDefaultCurrency(nextAssetClass);

    setDraft((current) => {
      const previousDefaultCurrency = getDefaultCurrency(current.assetClass);
      const shouldReplaceCurrency =
        current.currency.trim() === "" || current.currency === previousDefaultCurrency;

      return {
        ...current,
        assetClass: nextAssetClass,
        currency: shouldReplaceCurrency ? nextDefaultCurrency : current.currency
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const quantity = Number(draft.quantity);
    const price = Number(draft.price);
    const fees = Number(draft.fees || "0");

    if (!draft.date || !draft.asset.trim() || !draft.currency.trim()) {
      setSaving(false);
      setError("Date, asset, and currency are required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      setSaving(false);
      setError("Quantity must be zero or greater.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setSaving(false);
      setError("Price must be zero or greater.");
      return;
    }

    if (!Number.isFinite(fees) || fees < 0) {
      setSaving(false);
      setError("Fees must be zero or greater.");
      return;
    }

    try {
      await onSubmit(
        {
          date: draft.date,
          asset: draft.asset,
          assetClass: draft.assetClass,
          type: draft.type,
          quantity,
          price,
          fees,
          currency: draft.currency,
          note: draft.note
        },
        editingTransaction?.id
      );
      setDraft(createDraft());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Date">
          <input className="field-input" type="date" value={draft.date} onChange={(event) => updateField("date", event.target.value)} />
        </Field>
        <Field label="Asset">
          <input className="field-input mono" type="text" value={draft.asset} onChange={(event) => updateField("asset", event.target.value)} />
        </Field>
        <Field label="Asset Class">
          <select className="field-input" value={draft.assetClass} onChange={(event) => handleAssetClassChange(event.target.value as AssetClass)}>
            {ASSET_CLASS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className="field-input" value={draft.type} onChange={(event) => updateField("type", event.target.value as TransactionType)}>
            {TRANSACTION_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity">
          <input className="field-input mono" type="number" step="0.000001" value={draft.quantity} onChange={(event) => updateField("quantity", event.target.value)} />
        </Field>
        <Field label="Price">
          <input className="field-input mono" type="number" step="0.0001" value={draft.price} onChange={(event) => updateField("price", event.target.value)} />
        </Field>
        <Field label="Fees">
          <input className="field-input mono" type="number" step="0.0001" value={draft.fees} onChange={(event) => updateField("fees", event.target.value)} />
        </Field>
        <Field label="Currency">
          <input className="field-input mono" type="text" value={draft.currency} onChange={(event) => updateField("currency", event.target.value)} />
        </Field>
      </div>
      <Field label="Note">
        <input className="field-input" type="text" value={draft.note} onChange={(event) => updateField("note", event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">
          Admin mutations write to SQLite and never appear on the public dashboard as controls.
        </p>
        <div className="flex gap-2">
          {editingTransaction ? (
            <button className="secondary-button" type="button" onClick={onCancelEdit}>
              Cancel edit
            </button>
          ) : null}
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Saving..." : editingTransaction ? "Update transaction" : "Add transaction"}
          </button>
        </div>
      </div>
      {error ? (
        <div className="rounded-2xl border border-[rgba(255,123,123,0.22)] bg-[rgba(255,123,123,0.08)] px-4 py-3 text-sm text-negative">
          {error}
        </div>
      ) : null}
    </form>
  );
}

function createDraft(): DraftState {
  return {
    date: new Date().toISOString().slice(0, 10),
    asset: "",
    assetClass: "US_STOCK",
    type: "BUY",
    quantity: "",
    price: "",
    fees: "0",
    currency: "USD",
    note: ""
  };
}

function getDefaultCurrency(assetClass: AssetClass) {
  return (
    ASSET_CLASS_OPTIONS.find((option) => option.value === assetClass)
      ?.defaultCurrency ?? "USD"
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}
