"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import * as React from "react";

import { MotionSync } from "@/components/motion-sync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Fornitori globali: tema chiaro/scuro, cache dei dati nel browser, tooltip e notifiche. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster />
          <MotionSync />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
