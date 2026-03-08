import type { Metadata, Viewport } from "next";
import "./globals.css";
import OidcProvider from "@/components/OidcProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export const metadata: Metadata = {
  title: "Timer Counter",
  description: "Labelled pomodoro timers with attached counters",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Timer Counter",
  },
  icons: {
    icon: "/static/favicon.png",
    apple: "/static/pwa-192x192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-800 min-h-screen">
        <OidcProvider>{children}</OidcProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
