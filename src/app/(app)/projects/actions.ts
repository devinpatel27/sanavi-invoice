"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { assertProjectAccess } from "@/lib/projects/access";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
  userIds: z.array(z.string()).default([]),
});

type ProjectStatusValue = "ACTIVE" | "COMPLETED" | "ARCHIVED";

function normalizeStatus(status: string | undefined): ProjectStatusValue {
  return status === "ACTIVE" || status === "COMPLETED" || status === "ARCHIVED"
    ? status
    : "ACTIVE";
}

export async function createProject(input: {
  name: string;
  description?: string;
  address?: string;
  status?: string;
  userIds: string[];
}) {
  const admin = await requirePermission("project:manage");

  const parsed = projectSchema.parse(input);
  const status = normalizeStatus(parsed.status);

  const created = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: parsed.name,
        description: parsed.description || null,
        address: parsed.address || null,
        status,
        assignments:
          parsed.userIds.length > 0
            ? {
                create: parsed.userIds.map((userId) => ({ userId })),
              }
            : undefined,
      },
    });
    return project;
  });

  await logActivity({
    userId: admin.id,
    action: "PROJECT_CREATED",
    module: "PROJECT",
    entityId: created.id,
    details: { name: created.name, userIds: parsed.userIds },
  });

  revalidatePath("/projects");
  return created;
}

export async function updateProject(input: {
  id: string;
  name: string;
  description?: string;
  address?: string;
  status?: string;
  userIds: string[];
}) {
  const admin = await requirePermission("project:manage");

  const projectId = input.id;
  if (!projectId) throw new AppError("VALIDATION_001", "Project id is required");

  const parsed = projectSchema.parse(input);
  const status = normalizeStatus(parsed.status);

  const existing = await db.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new AppError("NOT_FOUND_001", "Project not found");

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: parsed.name,
        description: parsed.description || null,
        address: parsed.address || null,
        status,
      },
    });
    await tx.projectAssignment.deleteMany({ where: { projectId } });
    if (parsed.userIds.length > 0) {
      await tx.projectAssignment.createMany({
        data: parsed.userIds.map((userId) => ({
          userId,
          projectId,
        })),
      });
    }
  });

  await logActivity({
    userId: admin.id,
    action: "PROJECT_UPDATED",
    module: "PROJECT",
    entityId: projectId,
    details: { name: parsed.name, userIds: parsed.userIds },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const admin = await requirePermission("project:manage");

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { invoices: true } } },
  });
  if (!project) throw new AppError("NOT_FOUND_001", "Project not found");

  if (project._count.invoices > 0) {
    throw new AppError(
      "PROJECT_001",
      "Cannot delete a project that has invoices. Reassign the invoices first."
    );
  }

  await db.project.delete({ where: { id: projectId } });

  await logActivity({
    userId: admin.id,
    action: "PROJECT_DELETED",
    module: "PROJECT",
    entityId: projectId,
    details: { name: project.name },
  });

  revalidatePath("/projects");
}

export async function addProjectNote(input: {
  projectId: string;
  content: string;
}) {
  const user = await requirePermission("project:view");
  const content = input.content?.trim();
  if (!content) throw new AppError("VALIDATION_001", "Note content is required");

  await assertProjectAccess(input.projectId, user);

  const note = await db.projectNote.create({
    data: {
      projectId: input.projectId,
      userId: user.id,
      content,
    },
  });

  await logActivity({
    userId: user.id,
    action: "PROJECT_NOTE_ADDED",
    module: "PROJECT",
    entityId: input.projectId,
    details: { noteId: note.id },
  });

  revalidatePath(`/projects/${input.projectId}`);
  return note;
}
