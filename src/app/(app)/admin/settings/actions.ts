"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteInvoiceFiles } from "@/lib/azure/blob";
import { requireAdmin } from "@/lib/permissions";
import { PROJECT_SCOPE_COOKIE } from "@/lib/projects/scope";

const resetSchema = z.object({
  password: z.string().min(1),
  confirmation: z.literal("RESET SANVICASA"),
});

export type ResetDataResult =
  | { ok: true; fileCleanupFailures: number }
  | { ok: false; error: string };

export async function resetApplicationData(input: {
  password: string;
  confirmation: string;
}): Promise<ResetDataResult> {
  const admin = await requireAdmin();
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter your password and the exact confirmation phrase." };
  }

  const account = await db.user.findUnique({
    where: { id: admin.id },
    select: { passwordHash: true },
  });
  if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
    return { ok: false, error: "The current admin password is incorrect." };
  }

  const invoiceFiles = await db.invoice.findMany({ select: { fileUrl: true } });

  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.payment.deleteMany();
    await tx.invoiceLineItem.deleteMany();
    await tx.invoice.deleteMany();
    await tx.projectNote.deleteMany();
    await tx.projectAssignment.deleteMany();
    await tx.activityLog.deleteMany();
    await tx.apiErrorLog.deleteMany();
    await tx.material.deleteMany();
    await tx.category.deleteMany();
    await tx.vendor.deleteMany();
    await tx.project.deleteMany();
    await tx.user.deleteMany({ where: { id: { not: admin.id } } });
  });

  (await cookies()).delete(PROJECT_SCOPE_COOKIE);
  const failures = await deleteInvoiceFiles(invoiceFiles.map((file) => file.fileUrl));
  return { ok: true, fileCleanupFailures: failures.length };
}
