import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FolderKanban } from "lucide-react";
import { projectAccessWhere } from "@/lib/projects/access";
import { formatCurrency } from "@/lib/activity";
import { ProjectsManager, ProjectActions, type AssignableUser } from "./projects-manager";

function statusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "ARCHIVED") return "secondary" as const;
  return "outline" as const;
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const accessWhere = projectAccessWhere({
    id: session.user.id,
    role: session.user.role,
  });

  const [projects, users] = await Promise.all([
    db.project.findMany({
      where: accessWhere,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        invoices: {
          select: {
            total: true,
            status: true,
            payments: { select: { amount: true } },
          },
        },
      },
    }),
    isAdmin
      ? db.user.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  const rows = projects.map((project) => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    for (const invoice of project.invoices) {
      const t = Number(invoice.total);
      const p = invoice.payments.reduce((s, pay) => s + Number(pay.amount), 0);
      total += t;
      paid += p;
      const remaining = Math.max(0, t - p);
      pending += remaining;
      if (invoice.status === "PROCESSING" || invoice.status === "NEEDS_REVIEW") {
        pending -= remaining;
      }
    }
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      address: project.address,
      status: project.status,
      invoiceCount: project.invoices.length,
      memberNames: project.assignments.map((a) => a.user.name),
      userIds: project.assignments.map((a) => a.user.id),
      total,
      paid,
      pending: Math.max(0, pending),
    };
  });

  const assignableUsers: AssignableUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAdmin ? "Projects" : "My projects"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Construction sites and workspaces. Assign staff and track spend."
              : "Projects you have access to."}
          </p>
        </div>
        {isAdmin && (
          <ProjectsManager users={assignableUsers} />
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-full bg-muted p-4">
              <FolderKanban className="size-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No projects yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {isAdmin
                  ? "Create your first project to organize invoices and assign staff."
                  : "You have not been assigned to any projects yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="transition-shadow duration-200 hover:shadow-sm">
          <CardHeader>
            <CardTitle>All projects ({rows.length})</CardTitle>
            <CardDescription>
              Invoiced, paid, and pending totals per project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{project.name}</p>
                      {project.address && (
                        <p className="truncate text-xs text-muted-foreground">
                          {project.address}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusVariant(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Invoiced</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(project.total)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Paid</p>
                        <p className="text-sm font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(project.paid)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                        <p className="text-sm font-semibold tabular-nums text-amber-600">
                          {formatCurrency(project.pending)}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mt-3 border-t pt-3">
                        <ProjectActions project={project} users={assignableUsers} />
                      </div>
                    )}
                  </Link>
                ))}
              </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/projects/${project.id}`}
                          className="hover:underline underline-offset-4"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(project.status)}>
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.memberNames.length > 0
                          ? project.memberNames.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {project.invoiceCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(project.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCurrency(project.paid)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600">
                        {formatCurrency(project.pending)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <ProjectActions project={project} users={assignableUsers} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
