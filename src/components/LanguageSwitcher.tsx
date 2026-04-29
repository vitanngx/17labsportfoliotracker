"use client";

import { LOCALE_LABELS, Locale } from "@/lib/i18n";
import { LOCALES, useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      aria-label={t("common.language")}
      className="inline-flex items-center rounded-full border border-line bg-black/20 p-1"
    >
      {LOCALES.map((item) => {
        const isActive = item === locale;

        return (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item as Locale)}
            className={`h-8 rounded-full px-3 text-xs font-semibold tracking-[0.12em] transition-all ${
              isActive
                ? "bg-ink text-[#080d14]"
                : "text-mist hover:bg-white/[0.05] hover:text-ink"
            }`}
          >
            {LOCALE_LABELS[item]}
          </button>
        );
      })}
    </div>
  );
}
