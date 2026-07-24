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
} from "@/components/dashboard-charts";

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

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STAFF") {
    redirect("/invoices/upload");
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    monthTotal,
    ytdTotal,
    paidTotal,
    unpaidCount,
    overdueCount,
    categoryBreakdown,
    trendInvoices,
  ] = await Promise.all([
    db.invoice.aggregate({
      where: {
        invoiceDate: { gte: startOfMonth },
        status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] },
      },
      _sum: { total: true },
    }),
    db.invoice.aggregate({
      where: {
        invoiceDate: { gte: startOfYear },
        status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] },
      },
      _sum: { total: true },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
    }),
    db.invoice.count({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.invoice.groupBy({
      by: ["categoryId"],
      where: { status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] } },
      _sum: { total: true },
      _count: true,
    }),
    db.invoice.findMany({
      where: {
        invoiceDate: { gte: trendStart },
        status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] },
      },
      select: { invoiceDate: true, total: true },
    }),
  ]);

  const categoryIds = categoryBreakdown
    .map((row) => row.categoryId)
    .filter((id): id is string => Boolean(id));
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

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

  const categorySpend: CategorySpendPoint[] = categoryBreakdown
    .map((row) => ({
      name: row.categoryId
        ? categoryNameById.get(row.categoryId) ?? "Unknown"
        : "Uncategorized",
      total: Number(row._sum.total ?? 0),
      count: row._count,
    }))
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
      value: formatCurrency(Number(paidTotal._sum.amount ?? 0)),
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
          Overview of material purchase invoices and spend.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <DashboardCharts
        monthlySpend={monthlySpend}
        categorySpend={categorySpend}
      />

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
                  <span className="min-w-0 truncate font-medium">{row.name}</span>
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
