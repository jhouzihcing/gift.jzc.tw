import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZJ Card - 奇蹟卡",
  description: "專屬於您的奇蹟卡管家",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZJ Card",
  },
  icons: {
    icon: "/logo.png?v=2.32.0",
    apple: "/logo.png?v=2.32.0",
    shortcut: "/favicon.ico?v=2.32.0",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "ZJ Card - 奇蹟卡",
    description: "專屬於您的全方位超商卡片管家，提供安全、便捷的條碼管理與加密同步。",
    url: "https://gift.jzc.tw",
    siteName: "ZJ Card",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZJ Card - 奇蹟卡",
    description: "全方位超商卡片管理與加密同步工具",
  },
  verification: {
    google: "cef01WpDC7VBZmuRk_0KfG_BZu5OFo4oyyK-9OMeUlg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#34DA4F" },
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
