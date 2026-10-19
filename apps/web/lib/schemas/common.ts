/** Pezzi di schema riusati da moduli e azioni. Messaggi d'errore in italiano. */

import { z } from "zod";

export const uuid = z.uuid("Elemento non valido");

/** "AAAA-MM-GG" */
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

/** Minuti dalla mezzanotte (0–1440). */
export const minutes = z.number({ error: "Indica l'orario" }).int().min(0, "Orario non valido").max(1440, "Orario non valido");

/** Importo in centesimi, maggiore di zero. */
export const amountCents = z
  .number({ error: "Inserisci un importo" })
  .int("Importo non valido")
  .positive("Inserisci un importo maggiore di zero")
  .max(10_000_000, "Importo troppo alto");

/** Testo facoltativo: stringa vuota → "". */
export const note = z.string().trim().max(2000, "Testo troppo lungo").default("");

/** Primo giorno del mese "AAAA-MM-01" a partire da qualsiasi data del mese. */
export const monthStr = dateStr.transform((d) => `${d.slice(0, 7)}-01`);
