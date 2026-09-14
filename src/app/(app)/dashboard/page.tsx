import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DashboardCharts,
  type CategorySpendPoint,
  type MonthSpendPoint,
  type StatusPoint,
  type VendorSpendPoint,
} from "@/components/dashboard-charts";
import type { Prisma } from "@/generated/prisma/client";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildMonthBuckets(now: Date): MonthSpendPoint[] {
  const points: MonthSpendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: key,
      label: d.toLocaleString("en-IN", { month: "short" }),
      total: 0,
    });
  }
  return points;
}

type SearchParams = Promise<{ categoryId?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STAFF") {
    redirect("/invoices/upload");
  }

  const { categoryId: selectedCategoryId = "" } = await searchParams;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const confirmed: Prisma.InvoiceWhereInput = {
    status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] },
  };
  const categoryFilter: Prisma.InvoiceWhereInput = selectedCategoryId
    ? { categoryId: selectedCategoryId }
    : {};

  const [
    monthTotal,
    ytdTotal,
    paymentTotal,
    unpaidCount,
    overdueCount,
    categoryBreakdown,
    trendInvoices,
    allCategories,
    reportInvoices,
  ] = await Promise.all([
    db.invoice.aggregate({
      where: {
        invoiceDate: { gte: startOfMonth },
        ...confirmed,
        ...categoryFilter,
      },
      _sum: { total: true },
    }),
    db.invoice.aggregate({
      where: {
        invoiceDate: { gte: startOfYear },
        ...confirmed,
        ...categoryFilter,
      },
      _sum: { total: true },
    }),
    db.payment.aggregate({
      where: {
        invoice: {
          is: {
            ...confirmed,
            ...categoryFilter,
          },
        },
      },
      _sum: { amount: true },
    }),
    db.invoice.count({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        ...categoryFilter,
      },
    }),
    db.invoice.count({
      where: { status: "OVERDUE", ...categoryFilter },
    }),
    db.invoice.groupBy({
      by: ["categoryId"],
      where: { ...confirmed },
      _sum: { total: true },
      _count: true,
    }),
    db.invoice.findMany({
      where: {
        invoiceDate: { gte: trendStart },
        ...confirmed,
        ...categoryFilter,
      },
      select: { invoiceDate: true, total: true },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.invoice.findMany({
      where: { ...confirmed, ...categoryFilter },
      select: {
        total: true,
        status: true,
        vendor: { select: { name: true } },
        payments: { select: { amount: true } },
      },
    }),
  ]);

  const categoryIds = categoryBreakdown
    .map((row) => row.categoryId)
    .filter((id): id is string => Boolean(id));
  const categoriesForNames = await db.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryNameById = new Map(
    categoriesForNames.map((c) => [c.id, c.name])
  );

  const monthlySpend = buildMonthBuckets(now);
  const monthIndex = new Map(monthlySpend.map((p, i) => [p.month, i]));
  for (const inv of trendInvoices) {
    const d = inv.invoiceDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx != null) {
      monthlySpend[idx].total += Number(inv.total);
    }
  }

  let categorySpend: CategorySpendPoint[] = categoryBreakdown
    .map((row) => ({
      id: row.categoryId,
      name: row.categoryId
        ? categoryNameById.get(row.categoryId) ?? "Unknown"
        : "Uncategorized",
      total: Number(row._sum.total ?? 0),
      count: row._count,
    }))
    .sort((a, b) => b.total - a.total);

  if (selectedCategoryId) {
    categorySpend = categorySpend.filter((c) => c.id === selectedCategoryId);
  }

  const outstandingTotal = reportInvoices.reduce((sum, invoice) => {
    const paid = invoice.payments.reduce(
      (value, payment) => value + Number(payment.amount),
      0
    );
    return sum + Math.max(0, Number(invoice.total) - paid);
  }, 0);

  const statusMap = new Map<string, StatusPoint>();
  const vendorMap = new Map<string, VendorSpendPoint>();
  for (const invoice of reportInvoices) {
    const status = invoice.status.replaceAll("_", " ");
    const statusRow = statusMap.get(status) ?? { name: status, value: 0, count: 0 };
    statusRow.value += Number(invoice.total);
    statusRow.count += 1;
    statusMap.set(status, statusRow);

    const vendorRow = vendorMap.get(invoice.vendor.name) ?? {
      name: invoice.vendor.name,
      total: 0,
      count: 0,
    };
    vendorRow.total += Number(invoice.total);
    vendorRow.count += 1;
    vendorMap.set(invoice.vendor.name, vendorRow);
  }
  const statusBreakdown = [...statusMap.values()].sort((a, b) => b.value - a.value);
  const vendorSpend = [...vendorMap.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const cards = [
    {
      label: "Invoiced this month",
      value: formatCurrency(Number(monthTotal._sum.total ?? 0)),
    },
    {
      label: "Invoiced YTD",
      value: formatCurrency(Number(ytdTotal._sum.total ?? 0)),
    },
    {
      label: "Total paid",
      value: formatCurrency(Number(paymentTotal._sum.amount ?? 0)),
    },
    {
      label: "Outstanding",
      value: formatCurrency(outstandingTotal),
    },
    {
      label: "Unpaid invoices",
      value: String(unpaidCount),
    },
    {
      label: "Overdue invoices",
      value: String(overdueCount),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of material purchase invoices and spend
          {selectedCategoryId
            ? ` · filtered by category`
            : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {card.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Suspense fallback={null}>
        <DashboardCharts
          monthlySpend={monthlySpend}
          categorySpend={categorySpend}
          statusBreakdown={statusBreakdown}
          vendorSpend={vendorSpend}
          categories={allCategories}
          selectedCategoryId={selectedCategoryId}
        />
      </Suspense>

      <Card className="transition-shadow duration-200 hover:shadow-sm">
        <CardHeader>
          <CardTitle>Category list</CardTitle>
          <CardDescription>Totals alongside the chart above</CardDescription>
        </CardHeader>
        <CardContent>
          {categorySpend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices yet. Upload and confirm your first invoice to see spend
              by category.
            </p>
          ) : (
            <div className="divide-y">
              {categorySpend.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {row.count} invoice(s)
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatCurrency(row.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
