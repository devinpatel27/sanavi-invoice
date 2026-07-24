import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
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
import { FileText, Upload } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PROCESSING: "outline",
  NEEDS_REVIEW: "secondary",
  UNPAID: "secondary",
  PARTIALLY_PAID: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
};

type SearchParams = Promise<{ confirmed?: string }>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const { confirmed } = await searchParams;
  const isStaff = session?.user.role === "STAFF";

  const where = isStaff
    ? {
        OR: [
          { uploadedById: session!.user.id },
          {
            status: "NEEDS_REVIEW" as const,
            project: { assignments: { some: { userId: session!.user.id } } },
          },
        ],
      }
    : {};

  const invoices = await db.invoice.findMany({
    where,
    include: { vendor: true, project: true, category: true },
    orderBy: [{ status: "asc" }, { invoiceDate: "desc" }],
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isStaff ? "My invoices" : "Invoices"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStaff
              ? "Uploads and drafts awaiting your review."
              : "All material purchase invoices across projects."}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          nativeButton={false}
          render={<Link href="/invoices/upload" />}
        >
          <Upload className="size-4" />
          Upload invoice
        </Button>
      </div>

      {confirmed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Invoice confirmed and saved as unpaid.
        </div>
      )}

      <Card className="transition-shadow duration-200 hover:shadow-sm">
        <CardHeader>
          <CardTitle>{isStaff ? "Your invoices" : "All invoices"}</CardTitle>
          <CardDescription>
            {invoices.length} shown · newest first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="rounded-full bg-muted p-4">
                <FileText className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No invoices yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Upload a purchase invoice to extract fields and start a review.
                </p>
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/invoices/upload" />}
              >
                Upload invoice
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={
                      invoice.status === "NEEDS_REVIEW" ||
                      invoice.status === "PROCESSING"
                        ? `/invoices/${invoice.id}/review`
                        : `/invoices/${invoice.id}/review`
                    }
                    className="block rounded-xl border bg-card p-4 transition-all duration-200 hover:border-foreground/20 hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {invoice.vendor.name}
                        </p>
                      </div>
                      <Badge
                        variant={STATUS_VARIANT[invoice.status] ?? "outline"}
                      >
                        {invoice.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {invoice.invoiceDate.toLocaleDateString("en-IN")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(Number(invoice.total))}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>{invoice.vendor.name}</TableCell>
                        <TableCell>{invoice.project.name}</TableCell>
                        <TableCell>
                          {invoice.category?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {invoice.invoiceDate.toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(invoice.total))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_VARIANT[invoice.status] ?? "outline"
                            }
                          >
                            {invoice.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(invoice.status === "NEEDS_REVIEW" ||
                            invoice.status === "PROCESSING") && (
                            <Button
                              size="sm"
                              variant="outline"
                              nativeButton={false}
                              render={
                                <Link
                                  href={`/invoices/${invoice.id}/review`}
                                />
                              }
                            >
                              Review
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
