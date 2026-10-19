"use client";

import { AlertCircle } from "lucide-react";
import { Button, Card, LinkButton } from "@/components/ui";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto my-8 max-w-lg p-6">
      <AlertCircle aria-hidden="true" className="mb-3 size-6 text-danger" />
      <h1 className="text-2xl">Non riusciamo a completare l’operazione</h1>
      <p role="alert" className="mt-3 text-sm leading-relaxed text-ink-soft">
        Controlla la connessione e riprova. Se avevi appena salvato o inviato
        qualcosa, verifica prima che l’operazione non sia già stata eseguita,
        per evitare duplicati.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={reset}>
          Riprova
        </Button>
        <LinkButton href="/" variant="outline">
          Torna a Oggi
        </LinkButton>
      </div>
    </Card>
  );
}
