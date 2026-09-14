"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  rateExclGst: z.coerce.number().nonnegative(),
  gstPercent: z.coerce.number().nonnegative().default(0),
  createMaterial: z.boolean().optional(),
});

const confirmSchema = z.object({
  invoiceId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  vendorId: z.string().min(1).optional().nullable(),
  vendorName: z.string().min(1),
  vendorGstin: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  projectId: z.string().min(1),
  subtotal: z.coerce.number().nonnegative(),
  sgst: z.coerce.number().nonnegative(),
  cgst: z.coerce.number().nonnegative(),
  igst: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
  lineItems: z.array(lineItemSchema).min(1),
  forceDuplicate: z.boolean().optional(),
});

export type ConfirmInvoiceInput = z.infer<typeof confirmSchema>;

function d(n: number) {
  return new Prisma.Decimal(n);
}

async function assertCanReview(invoiceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      payments: { orderBy: { paidOn: "desc" } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  if (session.user.role === "STAFF") {
    const isUploader = invoice.uploadedById === session.user.id;
    const assignment = await db.projectAssignment.findFirst({
      where: { userId: session.user.id, projectId: invoice.projectId },
    });
    if (!isUploader && !assignment) {
      throw new Error("You do not have access to this invoice");
    }
  }

  return { session, invoice };
}

export async function createCategoryInline(input: {
  name: string;
  unit?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");

  const existing = await db.category.findUnique({ where: { name } });
  if (existing) return existing;

  const created = await db.category.create({
    data: { name, unit: input.unit?.trim() || null },
  });
  revalidatePath("/categories");
  revalidatePath("/invoices");
  return created;
}

export async function createVendorInline(input: {
  name: string;
  gstin?: string | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = input.name.trim();
  if (!name) throw new Error("Vendor name is required");
  const gstin = input.gstin?.trim() || null;

  if (gstin) {
    const byGstin = await db.vendor.findUnique({ where: { gstin } });
    if (byGstin) return byGstin;
  }

  const byName = await db.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (byName) return byName;

  return db.vendor.create({ data: { name, gstin } });
}

export async function checkDuplicateInvoice(
  vendorId: string,
  invoiceNumber: string,
  excludeId?: string
) {
  const existing = await db.invoice.findFirst({
    where: {
      vendorId,
      invoiceNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, invoiceNumber: true, status: true },
  });
  return existing;
}

export async function confirmInvoiceReview(raw: ConfirmInvoiceInput) {
  const parsed = confirmSchema.parse(raw);
  const { session, invoice } = await assertCanReview(parsed.invoiceId);

  const wasDraft =
    invoice.status === "NEEDS_REVIEW" || invoice.status === "PROCESSING";

  let vendorId = parsed.vendorId ?? null;
  if (!vendorId) {
    const vendor = await createVendorInline({
      name: parsed.vendorName,
      gstin: parsed.vendorGstin,
    });
    vendorId = vendor.id;
  } else {
    await db.vendor.update({
      where: { id: vendorId },
      data: {
        name: parsed.vendorName.trim(),
        gstin: parsed.vendorGstin?.trim() || null,
      },
    });
  }

  const duplicate = await checkDuplicateInvoice(
    vendorId,
    parsed.invoiceNumber.trim(),
    invoice.id
  );
  if (duplicate && !parsed.forceDuplicate) {
    return {
      ok: false as const,
      duplicate: true,
      duplicateId: duplicate.id,
      message: `An invoice with number "${parsed.invoiceNumber}" already exists for this vendor.`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: invoice.id } });

    for (const item of parsed.lineItems) {
      let materialId: string | null = null;
      if (item.createMaterial && parsed.categoryId) {
        const existingMaterial = await tx.material.findFirst({
          where: {
            categoryId: parsed.categoryId,
            name: { equals: item.description, mode: "insensitive" },
          },
        });
        if (existingMaterial) {
          materialId = existingMaterial.id;
        } else {
          const created = await tx.material.create({
            data: {
              categoryId: parsed.categoryId,
              name: item.description,
              defaultUnit: item.unit,
            },
          });
          materialId = created.id;
        }
      }

      const gstAmount =
        Math.round(
          ((item.quantity * item.rateExclGst * item.gstPercent) / 100) * 100
        ) / 100;
      const lineTotal =
        Math.round((item.quantity * item.rateExclGst + gstAmount) * 100) / 100;

      await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          materialId,
          description: item.description,
          quantity: d(item.quantity),
          unit: item.unit,
          rateExclGst: d(item.rateExclGst),
          gstPercent: d(item.gstPercent),
          gstAmount: d(gstAmount),
          lineTotal: d(lineTotal),
        },
      });
    }

    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const nextStatus = wasDraft
      ? "UNPAID"
      : paidAmount >= parsed.total - 0.01
        ? "PAID"
        : paidAmount > 0
          ? "PARTIALLY_PAID"
          : parsed.dueDate && new Date(parsed.dueDate) < new Date()
            ? "OVERDUE"
            : "UNPAID";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        invoiceNumber: parsed.invoiceNumber.trim(),
        invoiceDate: new Date(parsed.invoiceDate),
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
        vendorId,
        categoryId: parsed.categoryId || null,
        projectId: parsed.projectId,
        subtotal: d(parsed.subtotal),
        sgst: d(parsed.sgst),
        cgst: d(parsed.cgst),
        igst: d(parsed.igst),
        total: d(parsed.total),
        status: nextStatus,
        paidAt:
          nextStatus === "PAID"
            ? invoice.paidAt ?? invoice.payments[0]?.paidOn ?? new Date()
            : null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoice.id}/review`);
  redirect(
    wasDraft
      ? `/invoices?confirmed=${invoice.id}`
      : `/invoices?updated=${invoice.id}`
  );
}
