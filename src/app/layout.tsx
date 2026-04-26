import type { Metadata } from "next";
import "@/app/globals.css";
import type { ReactNode } from "react";

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
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#04070c] text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
