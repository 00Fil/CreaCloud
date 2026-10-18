/**
 * Schema dell'interpretazione restituita dal modello. Il modello non decide
 * nulla da solo: estrae intento e parametri, il codice valida ed esegue.
 * Le entità esistenti si citano solo con riferimenti brevi (S1, L2, V3)
 * forniti nel contesto, così un id inventato non passa la validazione.
 */

import { z } from "zod";

export const INTENTS = [
  "saluto",
  "ringraziamento",
  "conferma",
  "rifiuto",
  "nuovo_vincolo",
  "rimuovi_vincolo",
  "disponibilita_tutor",
  "assenza_tutor",
  "richiesta_lezioni",
  "modifica_lezioni",
  "sposta_lezione",
  "annulla_lezione",
  "info_lezioni",
  "info_pagamenti",
  "parla_con_coordinatore",
  "altro",
] as const;
export type Intent = (typeof INTENTS)[number];

export const CATEGORIES = [
  "scuola",
  "salute",
  "terapia",
  "sport",
  "altra_lezione",
  "lavoro",
  "famiglia",
  "religione",
  "preferenza",
  "altro",
  "sconosciuta",
] as const;
export type Category = (typeof CATEGORIES)[number];

const hhmm = z.string().nullable().describe("orario HH:MM, null se non indicato");

export const DateRefSchema = z.object({
  tipo: z.enum(["data", "tra_giorni", "giorno_settimana"]),
  data: z.string().nullable().describe("YYYY-MM-DD, da usare quando il giorno è chiaro dal calendario fornito"),
  giorni: z.number().int().nullable().describe("con tipo=tra_giorni: 0 oggi, 1 domani, 2 dopodomani"),
  giorno_settimana: z.number().int().min(0).max(6).nullable().describe("0 lunedì … 6 domenica"),
  settimana_prossima: z.boolean().nullable(),
});
export type DateRef = z.infer<typeof DateRefSchema>;

export const InterpretationSchema = z.object({
  intento: z.enum(INTENTS),
  confidenza: z.number().min(0).max(1).describe("quanto sei sicuro dell'interpretazione"),
  studente_ref: z.string().nullable().describe("S1, S2… dello studente interessato, null se non chiaro"),
  lezione_ref: z.string().nullable().describe("L1, L2… della lezione interessata"),
  vincolo_ref: z.string().nullable().describe("V1, V2… del vincolo interessato"),
  domanda: z
    .string()
    .nullable()
    .describe("se manca un'informazione indispensabile, la domanda breve da fare all'utente"),
  vincolo: z
    .object({
      ricorrenza: z.enum(["settimanale", "data"]),
      giorni_settimana: z.array(z.number().int().min(0).max(6)),
      data: DateRefSchema.nullable(),
      dalle: hhmm,
      alle: hhmm,
      categoria: z.enum(CATEGORIES).describe("sconosciuta se l'utente non ha detto di cosa si tratta"),
      descrizione: z.string().describe("breve, es. 'allenamento di calcio'"),
      priorita_proposta: z.number().int().min(1).max(4).describe("1 inderogabile, 2 importante, 3 preferenza, 4 gradimento"),
      fino_al: DateRefSchema.nullable(),
    })
    .nullable(),
  disponibilita: z
    .object({
      fasce: z.array(
        z.object({ giorno_settimana: z.number().int().min(0).max(6), dalle: z.string(), alle: z.string() }),
      ),
      sostituisce_tutto: z.boolean().describe("true se descrive tutta la disponibilità settimanale"),
    })
    .nullable(),
  assenza: z
    .object({ dal: DateRefSchema, al: DateRefSchema.nullable(), dalle: hhmm, alle: hhmm, motivo: z.string() })
    .nullable(),
  richiesta_lezioni: z
    .object({
      materia: z.string(),
      lezioni_settimana: z.number().int().min(1).max(7).nullable(),
      durata_minuti: z.number().int().nullable(),
      modalita: z.enum(["presenza", "online", "indifferente"]).nullable(),
      argomento: z.string().nullable(),
      singola: z.boolean().describe("true per una lezione extra una tantum"),
      data: DateRefSchema.nullable(),
    })
    .nullable(),
  modifica_lezioni: z
    .object({
      lezioni_settimana: z.number().int().min(1).max(7).nullable(),
      durata_minuti: z.number().int().nullable(),
      nota: z.string(),
    })
    .nullable(),
  spostamento: z
    .object({ nuova_data: DateRefSchema.nullable(), nuovo_orario: hhmm, nota: z.string() })
    .nullable(),
  annullamento: z.object({ motivo: z.string() }).nullable(),
  trascrizione: z
    .string()
    .nullable()
    .describe("solo per messaggi vocali: trascrizione fedele in italiano, altrimenti null"),
  risposta: z
    .string()
    .describe("risposta breve e cordiale in italiano; non inventare mai orari, date, importi o promesse"),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export const interpretationJsonSchema = z.toJSONSchema(InterpretationSchema, { target: "draft-7" }) as Record<
  string,
  unknown
>;

/**
 * Priorità ammesse per categoria: il modello propone, ma resta dentro questi
 * limiti, così un errore di classificazione non rende inderogabile un hobby.
 */
export const PRIORITY_RANGE: Record<Category, [number, number]> = {
  scuola: [1, 1],
  terapia: [1, 1],
  salute: [1, 2],
  religione: [1, 2],
  altra_lezione: [2, 2],
  lavoro: [2, 3],
  sport: [2, 3],
  famiglia: [2, 3],
  preferenza: [3, 4],
  altro: [2, 4],
  sconosciuta: [2, 4],
};

export function clampPriority(category: Category, proposed: number): number {
  const [lo, hi] = PRIORITY_RANGE[category];
  return Math.min(hi, Math.max(lo, Math.round(proposed)));
}

export const CATEGORY_LABEL: Record<Category, string> = {
  scuola: "scuola",
  salute: "salute",
  terapia: "terapia",
  sport: "sport",
  altra_lezione: "altra lezione",
  lavoro: "lavoro",
  famiglia: "famiglia",
  religione: "religione",
  preferenza: "preferenza",
  altro: "altro",
  sconosciuta: "da chiarire",
};
