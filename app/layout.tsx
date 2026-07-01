import type { Metadata } from "next";
import { Geist_Mono, Commissioner, Cormorant_Garamond } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { getAppSettings, buildBrandCss } from "@/lib/app-settings";
import { getSiteSettings } from "@/lib/cms/site-settings";
import { SiteTags } from "@/components/site/SiteTags";
import "./globals.css";

const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
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
  const site = await getSiteSettings();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messages = require("../messages/el.json");
  const brandCss = buildBrandCss(settings);
  let locale = "el";
  try {
    locale = await getLocale();
  } catch {
    locale = "el";
  }

  return (
    <html
      lang={locale}
      className={`${commissioner.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Brand colors from DB — overrides globals.css defaults */}
        <style>{`:root{${brandCss}}`}</style>
        {site.googleSiteVerification ? (
          <meta name="google-site-verification" content={site.googleSiteVerification} />
        ) : null}
        {site.bingSiteVerification ? (
          <meta name="msvalidate.01" content={site.bingSiteVerification} />
        ) : null}
      </head>
      <body className="min-h-full flex flex-col">
        <SiteTags
          ga={site.googleAnalyticsId}
          gtm={site.googleTagManagerId}
          pixel={site.facebookPixelId}
          extraHead={site.extraHeadHtml}
        />
        <NextIntlClientProvider locale="el" messages={messages}>
          <SessionProvider>
            {children}
            <CookieConsent config={site.consentConfig} enabled={site.consentEnabled} />
          </SessionProvider>
        </NextIntlClientProvider>
        {site.extraBodyHtml ? (
          <div dangerouslySetInnerHTML={{ __html: site.extraBodyHtml }} />
        ) : null}
      </body>
    </html>
  );
}
