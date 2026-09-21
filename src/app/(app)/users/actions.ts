"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "STAFF"]),
  projectIds: z.array(z.string()).default([]),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  role: z.enum(["ADMIN", "STAFF"]),
  projectIds: z.array(z.string()).default([]),
});

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "STAFF";
  projectIds: string[];
}) {
  const admin = await requireAdmin();
  const parsed = createSchema.parse(input);

  const existing = await db.user.findUnique({
    where: { email: parsed.email.toLowerCase() },
  });
  if (existing) throw new AppError("VALIDATION_001", "A user with this email already exists");

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const projectIds = parsed.role === "STAFF" ? parsed.projectIds : [];

  const created = await db.user.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash,
      role: parsed.role,
      projectAssignments:
        projectIds.length > 0
          ? {
              create: projectIds.map((projectId) => ({ projectId })),
            }
          : undefined,
    },
  });

  await logActivity({
    userId: admin.id,
    action: "USER_CREATED",
    module: "USER",
    entityId: created.id,
    details: { email: created.email, role: created.role },
  });

  revalidatePath("/users");
}

export async function updateUser(input: {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "STAFF";
  projectIds: string[];
}) {
  const admin = await requireAdmin();
  const parsed = updateSchema.parse(input);

  const user = await db.user.findUnique({ where: { id: parsed.id } });
  if (!user) throw new AppError("NOT_FOUND_001", "User not found");

  const emailTaken = await db.user.findFirst({
    where: {
      email: parsed.email.toLowerCase(),
      id: { not: parsed.id },
    },
  });
  if (emailTaken) throw new AppError("VALIDATION_001", "A user with this email already exists");

  const passwordHash = parsed.password
    ? await bcrypt.hash(parsed.password, 10)
    : undefined;
  const projectIds = parsed.role === "STAFF" ? parsed.projectIds : [];

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        role: parsed.role,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    await tx.projectAssignment.deleteMany({ where: { userId: parsed.id } });
    if (projectIds.length > 0) {
      await tx.projectAssignment.createMany({
        data: projectIds.map((projectId) => ({
          userId: parsed.id,
          projectId,
        })),
      });
    }
  });

  await logActivity({
    userId: admin.id,
    action: "USER_UPDATED",
    module: "USER",
    entityId: parsed.id,
    details: { email: parsed.email.toLowerCase(), role: parsed.role },
  });

  revalidatePath("/users");
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();
  if (admin.id === userId) {
    throw new AppError("VALIDATION_001", "You cannot delete your own account");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { uploadedInvoices: true, reviewedInvoices: true },
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND_001", "User not found");

  if (
    user._count.uploadedInvoices > 0 ||
    user._count.reviewedInvoices > 0
  ) {
    throw new AppError(
      "VALIDATION_001",
      "Cannot delete a user who has uploaded or reviewed invoices. Reassign their work first."
    );
  }

  await db.user.delete({ where: { id: userId } });

  await logActivity({
    userId: admin.id,
    action: "USER_DELETED",
    module: "USER",
    entityId: userId,
    details: { email: user.email },
  });

  revalidatePath("/users");
}
