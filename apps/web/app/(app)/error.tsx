"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageBody>
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <AlertCircle aria-hidden className="mb-2 size-6 text-destructive" />
          <CardTitle className="font-heading text-2xl font-medium">Non riusciamo a completare l’operazione</CardTitle>
          <CardDescription role="alert" className="leading-relaxed">
            Controlla la connessione e riprova. Se avevi appena salvato o inviato qualcosa, verifica prima che non sia già
            stato fatto, per evitare duplicati.
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={reset}>Riprova</Button>
          <Button variant="outline" asChild>
            <Link href="/">Torna a Oggi</Link>
          </Button>
        </CardFooter>
      </Card>
    </PageBody>
  );
}
