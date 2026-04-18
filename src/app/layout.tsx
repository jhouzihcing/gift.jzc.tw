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
    icon: "/logo.png?v=2.4.4",
    apple: "/logo.png?v=2.4.4",
    shortcut: "/favicon.ico?v=2.4.4",
  },
  verification: {
    google: "cef01WpDC7VBZmuRk_0KfG_BZu5OFo4oyyK-9OMeUlg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#34DA4F",
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
