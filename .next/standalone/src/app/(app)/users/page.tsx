import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/invoices/upload");

  const [users, projects] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        projectAssignments: { include: { project: true } },
      },
    }),
    db.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          ADMIN users see everything; STAFF users are scoped to assigned
          projects.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users ({users.length})</CardTitle>
          <CardDescription>
            Create, edit, or remove accounts and assign staff to projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersManager
            currentUserId={session.user.id}
            projects={projects}
            users={users.map((user) => ({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              projectIds: user.projectAssignments.map((a) => a.projectId),
              projectNames: user.projectAssignments.map(
                (a) => a.project.name
              ),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
