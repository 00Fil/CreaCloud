import { z } from "zod";

import { amountCents, dateStr, note, uuid } from "./common";

const base = {
  amountCents,
  paidOn: dateStr,
  /** mese a cui si riferisce il pagamento, "AAAA-MM-01" */
  periodMonth: dateStr.nullable(),
  note,
};

export const familyPaymentSchema = z.object({ familyId: uuid, ...base });
export const tutorPayoutSchema = z.object({ tutorId: uuid, ...base });
export const deletePaymentSchema = z.object({ id: uuid });

export type FamilyPaymentInput = z.input<typeof familyPaymentSchema>;
export type TutorPayoutInput = z.input<typeof tutorPayoutSchema>;
