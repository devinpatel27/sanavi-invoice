import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  extractInvoice,
  type ExtractedInvoice,
} from "@/lib/azure/document-intelligence";
import { uploadInvoiceFile } from "@/lib/azure/blob";
import { assertProjectAccess } from "@/lib/projects/access";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function halfTax(totalTax: number | undefined) {
  if (totalTax == null || Number.isNaN(totalTax)) {
    return { sgst: 0, cgst: 0, igst: 0 };
  }
  // Assume intra-state CGST+SGST split when only TotalTax is present.
  const half = Math.round((totalTax / 2) * 100) / 100;
  return { sgst: half, cgst: half, igst: 0 };
}

async function resolveVendor(extracted: ExtractedInvoice) {
  const gstin = extracted.vendorGstin?.trim().toUpperCase() || undefined;
  const name = (extracted.vendorName?.trim() || "UNKNOWN VENDOR").toUpperCase();

  if (gstin) {
    const byGstin = await db.vendor.findUnique({ where: { gstin } });
    if (byGstin) return byGstin;
  }

  const byName = await db.vendor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (byName) return byName;

  return db.vendor.create({
    data: { name, gstin: gstin ?? null },
  });
}

function decimal(value: number | undefined | null, fallback = 0) {
  const n =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return new Prisma.Decimal(n);
}

/**
 * Persist uploaded file, run Document Intelligence, and create a draft
 * invoice in NEEDS_REVIEW with extracted line items.
 */
export async function processInvoiceUpload(params: {
  file: File;
  userId: string;
  role: "ADMIN" | "STAFF";
  projectId: string;
  categoryId?: string | null;
}) {
  const { file, userId, role, projectId, categoryId } = params;

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only PDF, JPG, or PNG files are supported.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 20MB or smaller.");
  }

  const resolvedCategoryId: string | null = categoryId?.trim() || null;
  if (resolvedCategoryId) {
    const category = await db.category.findUnique({
      where: { id: resolvedCategoryId },
    });
    if (!category) {
      throw new Error("Selected category was not found. Pick another category.");
    }
  } else {
    throw new Error("Please select a category before extracting.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileUrl = await uploadInvoiceFile(file.name, buffer, file.type);

  let extracted: ExtractedInvoice;
  try {
    extracted = await extractInvoice(buffer);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Document Intelligence failed: ${error.message}`
        : "Document Intelligence failed."
    );
  }

  await assertProjectAccess(projectId, { id: userId, role });
  const vendor = await resolveVendor(extracted);

  const invoiceNumber = (
    extracted.invoiceNumber?.trim() || `DRAFT-${Date.now()}`
  ).toUpperCase();
  const invoiceDate = extracted.invoiceDate
    ? new Date(extracted.invoiceDate)
    : new Date();
  const dueDate = extracted.dueDate ? new Date(extracted.dueDate) : null;
  const taxes = halfTax(extracted.totalTax);
  const total =
    extracted.invoiceTotal ??
    (extracted.subtotal ?? 0) + (extracted.totalTax ?? 0);

  // Check for duplicate invoice on upload
  // If invoice already exists for this vendor, throw an error and reject the upload!
  const isAutoDraft = invoiceNumber.startsWith("DRAFT-");
  if (!isAutoDraft) {
    const existing = await db.invoice.findFirst({
      where: {
        vendorId: vendor.id,
        invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
      },
      select: { id: true, invoiceNumber: true },
    });
    if (existing) {
      throw new Error(
        `Invoice #${invoiceNumber} already exists for vendor "${vendor.name}". Duplicate invoice cannot be uploaded.`
      );
    }
  }

  // Strip non-serializable bits; keep a small normalized summary for the review UI
  const rawJson = JSON.parse(
    JSON.stringify(
      {
        ...extracted.raw,
        _normalized: {
          vendorName: vendor.name,
          vendorGstin: vendor.gstin,
          invoiceNumber,
          lineItemConfidences: extracted.lineItems.map((i) => i.confidence),
        },
      },
      (_key, value) => (value instanceof Date ? value.toISOString() : value)
    )
  ) as Prisma.InputJsonValue;

  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        projectId,
        vendorId: vendor.id,
        categoryId: resolvedCategoryId,
        invoiceDate,
        dueDate,
        subtotal: decimal(extracted.subtotal),
        sgst: decimal(taxes.sgst),
        cgst: decimal(taxes.cgst),
        igst: decimal(taxes.igst),
        total: decimal(total),
        status: "NEEDS_REVIEW",
        fileUrl,
        extractionRaw: rawJson,
        uploadedById: userId,
        lineItems: {
          create: extracted.lineItems.map((item) => {
            const qty = item.quantity ?? 1;
            const rate = item.unitPrice ?? 0;
            const amount = item.amount ?? qty * rate;
            return {
              description: (item.description || "LINE ITEM").trim().toUpperCase(),
              quantity: decimal(qty, 1),
              unit: (item.unit || "NOS").trim().toUpperCase(),
              rateExclGst: decimal(rate),
              gstPercent: decimal(0),
              gstAmount: decimal(0),
              lineTotal: decimal(amount),
            };
          }),
        },
      },
      include: { lineItems: true, vendor: true },
    });
    return created;
  });

  return {
    invoiceId: invoice.id,
    duplicateWarning: false,
    originalInvoiceNumber: null,
  };
}
