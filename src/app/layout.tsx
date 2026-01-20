import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://peak.michaeljameshofer.com"),
  title: {
    default: "Peak Functional & Sports Medicine",
    template: "%s | Peak Functional Medicine",
  },
  description:
    "Order-of-operations functional medicine for athletes and curious humans. Protocols, episodes, and frameworks with Dr. David Musnick.",
  openGraph: {
    title: "Peak Functional & Sports Medicine",
    description:
      "Order-of-operations functional medicine. Protocols and frameworks that cut through the noise.",
    url: "https://peak.michaeljameshofer.com",
    siteName: "Peak Functional Medicine",
    type: "website",
  },
  alternates: {
    types: {
      "application/rss+xml": "https://anchor.fm/s/10e1b0328/podcast/rss",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <PostHogProvider>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
