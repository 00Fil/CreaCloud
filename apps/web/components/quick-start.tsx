import Link from "next/link";
import { Card } from "./ui";

export function QuickStart() {
  return (
    <Card className="mb-6 px-5 py-4">
      <div>
        <h2 className="text-lg">
          Da dove comincio? Tre passaggi per organizzare le lezioni
        </h2>
        <ol className="grid list-inside list-decimal gap-4 pt-3 text-sm sm:grid-cols-3">
          <li>
            <Link
              href="/persone"
              className="font-semibold underline decoration-pervinca underline-offset-4"
            >
              Controlla le persone
            </Link>
            <p className="mt-1 text-ink-soft">
              Inserisci studenti e tutor, poi verifica richieste e
              disponibilità.
            </p>
          </li>
          <li>
            <Link
              href="/piano"
              className="font-semibold underline decoration-pervinca underline-offset-4"
            >
              Prepara una bozza
            </Link>
            <p className="mt-1 text-ink-soft">
              Scegli il mese e controlla le segnalazioni. Il calendario non
              cambia finché non confermi.
            </p>
          </li>
          <li>
            <Link
              href="/calendario"
              className="font-semibold underline decoration-pervinca underline-offset-4"
            >
              Verifica il calendario
            </Link>
            <p className="mt-1 text-ink-soft">
              Controlla le lezioni confermate. Per inviare gli orari su
              WhatsApp, torna in Pianificazione.
            </p>
          </li>
        </ol>
      </div>
    </Card>
  );
}
