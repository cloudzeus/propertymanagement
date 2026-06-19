import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { getAppSettings, buildBrandCss } from "@/lib/app-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Property Management",
  description: "Professional property management system",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getAppSettings();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messages = require("../messages/el.json");
  const brandCss = buildBrandCss(settings);

  return (
    <html
      lang="el"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Brand colors from DB — overrides globals.css defaults */}
        <style>{`:root{${brandCss}}`}</style>
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale="el" messages={messages}>
          <SessionProvider>
            {children}
            <CookieConsent />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
