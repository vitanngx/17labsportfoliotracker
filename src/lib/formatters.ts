export function formatCurrency(
  value: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
    ...options
  }).format(value);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
    ...options
  }).format(value);
}

export function formatPercent(value: number, digits = 2, locale = "en-US"): string {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);

  return `${value >= 0 ? "+" : ""}${formatted}%`;
}

export function formatSignedCurrency(
  value: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
  locale = "en-US"
): string {
  const formatted = formatCurrency(Math.abs(value), currency, options, locale);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatDateLabel(date: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function formatCompactCurrency(
  value: number,
  currency = "USD",
  locale = "en-US"
): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue < 1000) {
    return `${sign}${formatCurrency(absoluteValue, currency, undefined, locale)}`;
  }

  const units = [
    { threshold: 1_000_000_000_000, suffix: "T" },
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" }
  ];

  const unit = units.find((entry) => absoluteValue >= entry.threshold);

  if (!unit) {
    return `${sign}${formatCurrency(absoluteValue, currency, undefined, locale)}`;
  }

  const compactValue = absoluteValue / unit.threshold;
  const precision = compactValue >= 100 ? 0 : compactValue >= 10 ? 1 : 2;
  const numeric = trimTrailingZeros(compactValue.toFixed(precision));
  const symbol = getCurrencySymbol(currency, locale);

  return `${sign}${symbol}${numeric}${unit.suffix}`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
}

function getCurrencySymbol(currency: string, locale = "en-US") {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? `${currency} `;
}
