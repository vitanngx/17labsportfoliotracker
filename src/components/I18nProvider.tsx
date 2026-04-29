"use client";

import React from "react";
import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  MESSAGES,
  Locale,
  Messages,
  TranslationValues,
  normalizeLocale,
  translate
} from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  intlLocale: string;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(
    normalizeLocale(initialLocale)
  );

  React.useEffect(() => {
    const storedLocale = normalizeLocale(window.localStorage.getItem(LOCALE_COOKIE));
    document.documentElement.lang = storedLocale;
    if (storedLocale !== locale) {
      setLocaleState(storedLocale);
    }
  }, []);

  const setLocale = React.useCallback((nextLocale: Locale) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    window.localStorage.setItem(LOCALE_COOKIE, normalized);
    document.cookie = `${LOCALE_COOKIE}=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = normalized;
  }, []);

  const value = React.useMemo<I18nContextValue>(() => {
    const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];

    return {
      locale,
      messages,
      intlLocale: INTL_LOCALE[locale],
      setLocale,
      t: (key, values) => translate(messages, key, values)
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}

export { LOCALES };
