import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        mist: "var(--color-mist)",
        line: "var(--color-line)",
        positive: "var(--color-positive)",
        negative: "var(--color-negative)",
        accent: "var(--color-accent)",
        gold: "var(--color-gold)"
      },
      boxShadow: {
        bloom: "0 24px 80px rgba(3, 7, 15, 0.45)",
        panel: "0 14px 40px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
