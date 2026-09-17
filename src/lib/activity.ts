import { db } from "@/lib/db";

export type ActivityModule =
  | "AUTH"
  | "USER"
  | "PROJECT"
  | "INVOICE"
  | "PAYMENT"
  | "VENDOR"
  | "CATEGORY";

export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "PROJECT_ASSIGNED"
  | "PROJECT_NOTE_ADDED"
  | "INVOICE_UPLOADED"
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "INVOICE_DELETED"
  | "PAYMENT_CREATED"
  | "PAYMENT_DELETED"
  | "CATEGORY_CREATED"
  | "VENDOR_CREATED";

/**
 * Appends a system-wide activity log entry. Best-effort: failures are
 * swallowed so audit logging never breaks the primary action.
 */
export async function logActivity(input: {
  userId?: string | null;
  action: ActivityAction;
  module: ActivityModule;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        entityId: input.entityId ?? null,
        details: input.details
          ? (JSON.parse(JSON.stringify(input.details)) as object)
          : undefined,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 512) ?? null,
      },
    });
  } catch {
    // Audit logging must not interrupt the request.
  }
}

export function formatCurrency(value: number, maxFraction = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: maxFraction,
  }).format(value);
}
