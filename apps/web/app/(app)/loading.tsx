import { Card } from "@/components/ui";

export default function Loading() {
  return (
    <Card className="m-4 p-6" role="status" aria-live="polite">
      <p className="font-serif text-xl">Caricamento in corso…</p>
      <p className="mt-2 text-sm text-ink-soft">
        Stiamo preparando i dati. Attendi un momento.
      </p>
    </Card>
  );
}
