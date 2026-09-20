import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";

export type ProjectUser = { id: string; role: "ADMIN" | "STAFF" };

/** Prisma where clause for projects visible to the current user. */
export function projectAccessWhere(user: ProjectUser): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") return {};
  return {
    assignments: { some: { userId: user.id } },
  };
}

/** Verifies the user can access a project, returning the project or throwing. */
export async function assertProjectAccess(projectId: string, user: ProjectUser) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(user) },
  });
  if (!project) {
    throw new AppError("NOT_FOUND_001", "Project not found or access denied.");
  }
  return project;
}
