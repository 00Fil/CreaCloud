"use server";

import { revalidatePath } from "next/cache";

import { action, okRow } from "@/lib/actions/safe";
import { audit } from "@/lib/db/actions";
import { deletePaymentSchema, familyPaymentSchema, tutorPayoutSchema } from "@/lib/schemas/payments";

/** Incasso da una famiglia (contanti, bonifico…). */
export const addFamilyPayment = action(familyPaymentSchema, async (input, { db, staff }) => {
  const row = okRow(
    await db
      .from("family_payments")
      .insert({
        family_id: input.familyId,
        amount_cents: input.amountCents,
        paid_on: input.paidOn,
        period_month: input.periodMonth,
        note: input.note,
        recorded_by: staff.userId,
      })
      .select("id")
      .single(),
    "registrazione pagamento",
  );
  await audit(db, staff.userId, "pagamento_famiglia", "family_payments", row.id, input);
  revalidatePath("/conti");
  revalidatePath(`/persone/famiglia/${input.familyId}`);
  return { id: row.id };
});

/** Compenso pagato a un tutor. */
export const addTutorPayout = action(tutorPayoutSchema, async (input, { db, staff }) => {
  const row = okRow(
    await db
      .from("tutor_payouts")
      .insert({
        tutor_id: input.tutorId,
        amount_cents: input.amountCents,
        paid_on: input.paidOn,
        period_month: input.periodMonth,
        note: input.note,
        recorded_by: staff.userId,
      })
      .select("id")
      .single(),
    "registrazione compenso",
  );
  await audit(db, staff.userId, "compenso_tutor", "tutor_payouts", row.id, input);
  revalidatePath("/conti");
  revalidatePath(`/persone/tutor/${input.tutorId}`);
  return { id: row.id };
});

export const deleteFamilyPayment = action(deletePaymentSchema, async ({ id }, { db, staff }) => {
  const row = okRow(await db.from("family_payments").delete().eq("id", id).select("family_id, amount_cents, paid_on").single(), "eliminazione pagamento");
  await audit(db, staff.userId, "elimina_pagamento_famiglia", "family_payments", id, row);
  revalidatePath("/conti");
  revalidatePath(`/persone/famiglia/${row.family_id}`);
});

export const deleteTutorPayout = action(deletePaymentSchema, async ({ id }, { db, staff }) => {
  const row = okRow(await db.from("tutor_payouts").delete().eq("id", id).select("tutor_id, amount_cents, paid_on").single(), "eliminazione compenso");
  await audit(db, staff.userId, "elimina_compenso_tutor", "tutor_payouts", id, row);
  revalidatePath("/conti");
  revalidatePath(`/persone/tutor/${row.tutor_id}`);
});
