import { z } from "zod";

import { dateStr, minutes, uuid } from "./common";

/**
 * approva: applica l'azione proposta dall'assistente (per gli spostamenti si
 * possono correggere data e ora); rifiuta; senza_compenso: annullamento
 * senza addebito; fatto: già gestito a mano.
 */
export const decisionSchema = z.object({
  id: uuid,
  decision: z.enum(["approva", "rifiuta", "senza_compenso", "fatto"]),
  /** messaggio WhatsApp da mandare alla persona dopo l'approvazione */
  notify: z.string().trim().max(4096).default(""),
  date: dateStr.nullable().optional(),
  startMin: minutes.nullable().optional(),
});
