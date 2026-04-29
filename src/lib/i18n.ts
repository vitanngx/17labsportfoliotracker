import enMessages from "../../messages/en.json";
import frMessages from "../../messages/fr.json";
import viMessages from "../../messages/vi.json";

export const LOCALES = ["en", "fr", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "portfolio_locale";

export const MESSAGES = {
  en: enMessages,
  fr: frMessages,
  vi: viMessages
} as const;

export type Messages = typeof enMessages;
export type TranslationValues = Record<string, string | number>;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  vi: "VI"
};

export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  vi: "vi-VN"
};

export function normalizeLocale(value?: string | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function translate(
  messages: Messages,
  key: string,
  values?: TranslationValues
) {
  const template = key
    .split(".")
    .reduce<unknown>((current, segment) => {
      if (current && typeof current === "object" && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, messages);

  const text = typeof template === "string" ? template : key;

  if (!values) {
    return text;
  }

  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text
  );
}
