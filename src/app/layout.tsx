import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted (no Google Fonts or foreign CDNs at runtime). Licensed under the SIL OFL, see fonts/OFL.txt.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: `${t("console")} ${t("name")}`, template: `%s | ${t("console")} ${t("name")}` },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page renders per request so Next.js can stamp the CSP nonce from src/proxy.ts on its scripts.
  await connection();
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
