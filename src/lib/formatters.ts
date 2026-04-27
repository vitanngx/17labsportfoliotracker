export function formatCurrency(
  value: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
    ...options
  }).format(value);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
    ...options
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatSignedCurrency(
  value: number,
  currency = "USD",
  options?: Intl.NumberFormatOptions
): string {
  const formatted = formatCurrency(Math.abs(value), currency, options);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function formatCompactCurrency(
  value: number,
  currency = "USD"
): string {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absoluteValue < 1000) {
    return `${sign}${formatCurrency(absoluteValue, currency)}`;
  }

  const units = [
    { threshold: 1_000_000_000_000, suffix: "T" },
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" }
  ];

  const unit = units.find((entry) => absoluteValue >= entry.threshold);

  if (!unit) {
    return `${sign}${formatCurrency(absoluteValue, currency)}`;
  }

  const compactValue = absoluteValue / unit.threshold;
  const precision = compactValue >= 100 ? 0 : compactValue >= 10 ? 1 : 2;
  const numeric = trimTrailingZeros(compactValue.toFixed(precision));
  const symbol = getCurrencySymbol(currency);

  return `${sign}${symbol}${numeric}${unit.suffix}`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
}

function getCurrencySymbol(currency: string) {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? `${currency} `;
}
