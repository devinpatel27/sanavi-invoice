"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assertInvoiceAccess,
  isPayableStatus,
} from "@/lib/invoices/access";

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidOn: z.string().min(1),
  mode: z.string().trim().max(50).optional(),
  reference: z.string().trim().max(100).optional(),
});

export async function recordInvoicePayment(input: {
  invoiceId: string;
  amount: number;
  paidOn: string;
  mode?: string;
  reference?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = paymentSchema.parse(input);
  const invoice = await assertInvoiceAccess(parsed.invoiceId, {
    id: session.user.id,
    role: session.user.role,
  });

  if (!isPayableStatus(invoice.status)) {
    throw new Error(
      "Only confirmed invoices can be marked paid or unpaid. Finish review first."
    );
  }

  const paidOn = new Date(parsed.paidOn);
  if (Number.isNaN(paidOn.getTime())) throw new Error("Invalid payment date");

  const aggregate = await db.payment.aggregate({
    where: { invoiceId: invoice.id },
    _sum: { amount: true },
  });
  const alreadyPaid = Number(aggregate._sum.amount ?? 0);
  const invoiceTotal = Number(invoice.total);
  const remaining = Math.max(0, invoiceTotal - alreadyPaid);
  if (parsed.amount > remaining + 0.01) {
    throw new Error(`Payment cannot exceed the remaining balance of ₹${remaining.toFixed(2)}`);
  }

  const newPaidTotal = alreadyPaid + parsed.amount;
  const fullyPaid = newPaidTotal >= invoiceTotal - 0.01;

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: parsed.amount,
        paidOn,
        mode: parsed.mode || null,
        reference: parsed.reference || null,
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid ? paidOn : null,
      },
    });
    return created;
  });

  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoice.id}/review`);

  return {
    paymentId: payment.id,
    status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
    paidAmount: newPaidTotal,
    balance: Math.max(0, invoiceTotal - newPaidTotal),
  };
}

export async function deleteInvoicePayment(input: {
  invoiceId: string;
  paymentId: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") {
    throw new Error("Only administrators can delete payments");
  }

  const invoice = await assertInvoiceAccess(input.invoiceId, {
    id: session.user.id,
    role: session.user.role,
  });
  const payment = await db.payment.findFirst({
    where: { id: input.paymentId, invoiceId: invoice.id },
  });
  if (!payment) throw new Error("Payment not found");

  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });
    const remainingPayments = await tx.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });
    const paid = Number(remainingPayments._sum.amount ?? 0);
    const total = Number(invoice.total);
    const status =
      paid >= total - 0.01
        ? "PAID"
        : paid > 0
          ? "PARTIALLY_PAID"
          : invoice.dueDate && invoice.dueDate < new Date()
            ? "OVERDUE"
            : "UNPAID";
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status, paidAt: status === "PAID" ? invoice.paidAt : null },
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoice.id}/review`);
}

export async function deleteInvoice(invoiceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, invoiceNumber: true, status: true, uploadedById: true },
  });

  if (!invoice) throw new Error("Invoice not found");

  if (session.user.role !== "ADMIN") {
    if (
      invoice.uploadedById !== session.user.id ||
      (invoice.status !== "NEEDS_REVIEW" && invoice.status !== "PROCESSING")
    ) {
      throw new Error("You do not have permission to delete this invoice");
    }
  }

  await db.invoice.delete({
    where: { id: invoiceId },
  });

  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/materials");
}
