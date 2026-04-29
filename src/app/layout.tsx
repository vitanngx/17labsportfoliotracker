import type { Metadata } from "next";
import "@/app/globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/I18nProvider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "My Portfolio Tracker",
  description:
    "Phase 1 MVP for transaction-driven portfolio analytics powered by live market data."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[#04070c] text-ink antialiased">
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
