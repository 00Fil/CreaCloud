"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ricarica i dati della pagina a intervalli, ad esempio mentre si attende il QR di WhatsApp. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
