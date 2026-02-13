import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChunkErrorReset from "./ChunkErrorReset";
import PWAInstall from "@/components/PWAInstall";
import HelpPanel from "@/components/HelpPanel";
import InactiveUserRedirect from "@/components/InactiveUserRedirect";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Avoid long HTML cache so deployments don't serve stale chunk refs (fixes 500 on arrival.ssda.so after deploy)
export const revalidate = 0;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b82f6",
};

export const metadata: Metadata = {
  title: "International Arrival System",
  description: "Arrival management and shift scheduling",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Arrival",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ChunkErrorReset />
        <InactiveUserRedirect />
        {children}
        <PWAInstall />
        <HelpPanel />
      </body>
    </html>
  );
}
