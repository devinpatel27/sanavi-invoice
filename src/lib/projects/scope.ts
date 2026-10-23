import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { projectAccessWhere, type ProjectUser } from "@/lib/projects/access";

export const PROJECT_SCOPE_COOKIE = "sanvicasa-project";

const getProjectScopeCached = cache(async (id: string, role: ProjectUser["role"]) => {
  const projects = await db.project.findMany({
    where: projectAccessWhere({ id, role }),
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { id: true, name: true, status: true },
  });

  const requested = (await cookies()).get(PROJECT_SCOPE_COOKIE)?.value;
  const selectedProjectId = projects.some((project) => project.id === requested)
    ? requested!
    : role === "ADMIN"
      ? null
      : projects[0]?.id ?? null;

  return { projects, selectedProjectId };
});

export function getProjectScope(user: ProjectUser) {
  return getProjectScopeCached(user.id, user.role);
}

