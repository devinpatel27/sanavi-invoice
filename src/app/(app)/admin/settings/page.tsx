import { redirect } from "next/navigation";
import { Database, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetDataPanel } from "./reset-data-panel";
import { ExportDataButton } from "@/components/export-data-button";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/invoices/upload");

  const [projects, invoices, payments, users] = await Promise.all([
    db.project.count(),
    db.invoice.count(),
    db.payment.count(),
    db.user.count(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Application information and administrative data controls.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4" />
            Stored data
          </CardTitle>
          <CardDescription>Current records across the application.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Projects", projects],
              ["Invoices", invoices],
              ["Payments", payments],
              ["Users", users],
            ].map(([label, count]) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data exports</CardTitle>
          <CardDescription>Download the complete database or an individual module. Password hashes are never exported.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <ExportDataButton label="Full database Excel" />
            <ExportDataButton label="Full JSON backup" format="json" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["projects", "Projects"], ["invoices", "Invoices"], ["payments", "Payments"],
              ["vendors", "Vendors"], ["categories", "Categories"], ["materials", "Rate sheet"],
              ["users", "Users"], ["activity-logs", "Activity logs"], ["error-logs", "Error logs"],
            ].map(([dataset, label]) => (
              <ExportDataButton key={dataset} dataset={dataset} label={label} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          <CardDescription>Destructive actions require password verification and explicit confirmation.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetDataPanel />
        </CardContent>
      </Card>
    </div>
  );
}
