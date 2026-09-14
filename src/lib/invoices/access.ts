import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  role: "ADMIN" | "STAFF";
};

/** Prisma where clause for invoices visible to the current user. */
export function invoiceAccessWhere(user: SessionUser) {
  if (user.role === "ADMIN") return {};
  return {
    OR: [
      { uploadedById: user.id },
      {
        project: { assignments: { some: { userId: user.id } } },
      },
    ],
  };
}

export async function assertInvoiceAccess(
  invoiceId: string,
  user: SessionUser
) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, ...invoiceAccessWhere(user) },
  });
  if (!invoice) {
    throw new Error("Invoice not found or access denied");
  }
  return invoice;
}

export function isPayableStatus(status: string) {
  return (
    status === "UNPAID" ||
    status === "PAID" ||
    status === "OVERDUE" ||
    status === "PARTIALLY_PAID"
  );
}

export function formatPaidAt(date: Date | null | undefined) {
  if (!date) return null;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
