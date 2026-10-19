import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";
import { motionBootstrap } from "@/lib/ui/motion";

export const metadata: Metadata = {
  title: { default: "Creattivamente | Coordinamento", template: "%s · Creattivamente" },
  description: "Pianificazione lezioni, chat WhatsApp e contabilità del centro",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Creattivamente", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBootstrap }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
