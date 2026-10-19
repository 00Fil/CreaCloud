import type { Metadata, Viewport } from "next";

import "./globals.css";
import { MotionSync } from "@/components/motion-sync";
import { motionBootstrap } from "@/lib/ui/motion";

export const metadata: Metadata = {
  title: "Creattivamente | Coordinamento",
  description: "Pianificazione lezioni, chat WhatsApp e contabilità del centro",
  icons: { icon: "/logo.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a09" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBootstrap }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <MotionSync />
        {children}
      </body>
    </html>
  );
}
