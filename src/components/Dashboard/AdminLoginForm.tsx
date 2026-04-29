"use client";

import React from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

export default function AdminLoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };

    setSubmitting(false);

    if (!response.ok || !payload.ok) {
      setError(payload.error === "Invalid admin password." ? t("admin.invalidPassword") : t("admin.loginFailed"));
      return;
    }

    window.location.href = "/admin/dashboard";
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="surface-panel w-full max-w-md rounded-[32px] p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-title text-accent">{t("admin.adminAccess")}</p>
            <h1 className="headline mt-3 text-4xl">{t("admin.secureControl")}</h1>
          </div>
          <LanguageSwitcher />
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label mb-2 block">{t("admin.password")}</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary-button w-full" disabled={submitting} type="submit">
            {submitting ? t("admin.checkingAccess") : t("admin.login")}
          </button>
          {error ? (
            <div className="rounded-2xl border border-[rgba(255,123,123,0.22)] bg-[rgba(255,123,123,0.08)] px-4 py-3 text-sm text-negative">
              {error}
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
