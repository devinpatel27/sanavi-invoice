import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export type Permission =
  | "dashboard:view"
  | "invoice:view"
  | "invoice:upload"
  | "invoice:review"
  | "invoice:delete"
  | "payment:create"
  | "payment:delete"
  | "project:view"
  | "project:manage"
  | "user:manage"
  | "vendor:manage"
  | "category:manage"
  | "material:view"
  | "logs:view";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard:view",
  "invoice:view",
  "invoice:upload",
  "invoice:review",
  "invoice:delete",
  "payment:create",
  "payment:delete",
  "project:view",
  "project:manage",
  "user:manage",
  "vendor:manage",
  "category:manage",
  "material:view",
  "logs:view",
];

const ROLE_PERMISSIONS: Record<"ADMIN" | "STAFF", Set<Permission>> = {
  ADMIN: new Set(ALL_PERMISSIONS),
  // STAFF: upload-first workflow — view/review their own invoices, record
  // payments on invoices they can access, and view assigned projects.
  STAFF: new Set<Permission>([
    "invoice:view",
    "invoice:upload",
    "invoice:review",
    "invoice:delete",
    "payment:create",
    "project:view",
  ]),
};

export function hasPermission(
  role: "ADMIN" | "STAFF" | undefined,
  permission: Permission
) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export type SessionUser = {
  id: string;
  role: "ADMIN" | "STAFF";
  name?: string | null;
  email?: string | null;
};

/**
 * Returns the authenticated session or throws AUTH_001 (401). Never trusts a
 * role/amount/id coming from the client — the role is read from the session.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AppError("AUTH_001");
  }
  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
  };
}

/** Requires an authenticated user who holds the given permission (403 if not). */
export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new AppError("PERMISSION_001");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AppError("PERMISSION_001");
  }
  return user;
}
