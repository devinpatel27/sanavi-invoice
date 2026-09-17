import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import {
  DashboardView,
  type CategorySpendPoint,
  type MonthSpendPoint,
  type StatusPoint,
  type VendorSpendPoint,
  type ProjectSpendPoint,
  type RecentInvoice,
} from "@/components/dashboard-view";

function buildMonthBuckets(now: Date): MonthSpendPoint[] {
  const points: MonthSpendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: key,
      label: d.toLocaleString("en-IN", { month: "short" }),
      total: 0,
      paid: 0,
    });
  }
  return points;
}

type SearchParams = Promise<{
  categoryId?: string;
  from?: string;
  to?: string;
}>;

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

  const params = await searchParams;
  const selectedCategoryId = params.categoryId ?? "";

  const now = new Date();
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const from = params.from ? new Date(params.from) : undefined;
  let to: Date | undefined;
  if (params.to) {
    to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
  }

  const confirmed: Prisma.InvoiceWhereInput = {
    status: { notIn: ["PROCESSING", "NEEDS_REVIEW"] },
  };
  const categoryFilter: Prisma.InvoiceWhereInput = selectedCategoryId
    ? { categoryId: selectedCategoryId }
    : {};
  const dateFilter: Prisma.InvoiceWhereInput = {};
  if (from || to) {
    dateFilter.invoiceDate = {};
    if (from) dateFilter.invoiceDate = { ...dateFilter.invoiceDate, gte: from };
    if (to) dateFilter.invoiceDate = { ...dateFilter.invoiceDate, lte: to };
  }
  const paymentDateFilter: Prisma.PaymentWhereInput = {};
  if (from || to) {
    paymentDateFilter.paidOn = {};
    if (from) paymentDateFilter.paidOn = { ...paymentDateFilter.paidOn, gte: from };
    if (to) paymentDateFilter.paidOn = { ...paymentDateFilter.paidOn, lte: to };
  }

  const [
    revenueAgg,
    paidAgg,
    unpaidCount,
    overdueCount,
    projectsCount,
    vendorsCount,
    categoryBreakdown,
    trendInvoices,
    allCategories,
    reportInvoices,
    recentInvoices,
    projectBreakdown,
  ] = await Promise.all([
    db.invoice.aggregate({
      where: { ...confirmed, ...categoryFilter, ...dateFilter },
      _sum: { total: true },
    }),
    db.payment.aggregate({
      where: {
        ...paymentDateFilter,
        invoice: { is: { ...confirmed, ...categoryFilter } },
      },
      _sum: { amount: true },
    }),
    db.invoice.count({
      where: {
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        ...categoryFilter,
        ...dateFilter,
      },
    }),
    db.invoice.count({
      where: { status: "OVERDUE", ...categoryFilter, ...dateFilter },
    }),
    db.project.count(),
    db.vendor.count({
      where: { invoices: { some: { ...confirmed, ...dateFilter } } },
    }),
    db.invoice.groupBy({
      by: ["categoryId"],
      where: { ...confirmed, ...dateFilter },
      _sum: { total: true },
      _count: true,
    }),
    db.invoice.findMany({
      where: { invoiceDate: { gte: trendStart }, ...confirmed, ...categoryFilter },
      select: { invoiceDate: true, total: true, payments: { select: { amount: true } } },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.invoice.findMany({
      where: { ...confirmed, ...categoryFilter, ...dateFilter },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        invoiceDate: true,
        vendor: { select: { name: true } },
        project: { select: { name: true } },
        payments: { select: { amount: true } },
      },
    }),
    db.invoice.findMany({
      where: { ...confirmed, ...categoryFilter, ...dateFilter },
      orderBy: { invoiceDate: "desc" },
      take: 8,
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        invoiceDate: true,
        vendor: { select: { name: true } },
      },
    }),
    db.invoice.groupBy({
      by: ["projectId"],
      where: { ...confirmed, ...categoryFilter, ...dateFilter },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const categoryIds = categoryBreakdown
    .map((row) => row.categoryId)
    .filter((id): id is string => Boolean(id));
  const categoriesForNames = await db.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const categoryNameById = new Map(categoriesForNames.map((c) => [c.id, c.name]));

  const projectIds = projectBreakdown
    .map((row) => row.projectId)
    .filter((id): id is string => Boolean(id));
  const projectsForNames = projectIds.length
    ? await db.project.findMany({ where: { id: { in: projectIds } } })
    : [];
  const projectNameById = new Map(projectsForNames.map((p) => [p.id, p.name]));

  const monthlySpend = buildMonthBuckets(now);
  const monthIndex = new Map(monthlySpend.map((p, i) => [p.month, i]));
  for (const inv of trendInvoices) {
    const d = inv.invoiceDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx != null) {
      monthlySpend[idx].total += Number(inv.total);
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      monthlySpend[idx].paid += paid;
    }
  }

  const categorySpend: CategorySpendPoint[] = categoryBreakdown
    .map((row) => ({
      id: row.categoryId,
      name: row.categoryId
        ? categoryNameById.get(row.categoryId) ?? "Unknown"
        : "Uncategorized",
      total: Number(row._sum.total ?? 0),
      count: row._count,
    }))
    .sort((a, b) => b.total - a.total);

  const projectSpend: ProjectSpendPoint[] = projectBreakdown
    .map((row) => ({
      id: row.projectId,
      name: row.projectId
        ? projectNameById.get(row.projectId) ?? "Unknown"
        : "Unassigned",
      total: Number(row._sum.total ?? 0),
      count: row._count,
    }))
    .sort((a, b) => b.total - a.total);

  let outstandingTotal = 0;
  const statusMap = new Map<string, StatusPoint>();
  const vendorMap = new Map<string, VendorSpendPoint>();
  for (const invoice of reportInvoices) {
    const total = Number(invoice.total);
    const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
    outstandingTotal += Math.max(0, total - paid);

    const status = invoice.status.replaceAll("_", " ");
    const statusRow = statusMap.get(status) ?? { name: status, value: 0, count: 0 };
    statusRow.value += total;
    statusRow.count += 1;
    statusMap.set(status, statusRow);

    const vendorName = invoice.vendor.name;
    const vendorRow = vendorMap.get(vendorName) ?? {
      name: vendorName,
      total: 0,
      count: 0,
    };
    vendorRow.total += total;
    vendorRow.count += 1;
    vendorMap.set(vendorName, vendorRow);
  }
  const statusBreakdown = [...statusMap.values()].sort((a, b) => b.value - a.value);
  const vendorSpend = [...vendorMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);

  const recentInvoicesMapped: RecentInvoice[] = recentInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorName: inv.vendor.name,
    total: Number(inv.total),
    status: inv.status,
    invoiceDate: inv.invoiceDate.toISOString(),
  }));

  const revenue = Number(revenueAgg._sum.total ?? 0);
  const paid = Number(paidAgg._sum.amount ?? 0);
  const pending = Math.max(0, outstandingTotal);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of material purchase invoices and spend
          {selectedCategoryId ? " · filtered by category" : ""}.
        </p>
      </div>

      <Suspense fallback={null}>
        <DashboardView
          revenue={revenue}
          paid={paid}
          pending={pending}
          unpaidCount={unpaidCount}
          overdueCount={overdueCount}
          projectsCount={projectsCount}
          clientsCount={vendorsCount}
          monthlySpend={monthlySpend}
          categorySpend={categorySpend}
          statusBreakdown={statusBreakdown}
          vendorSpend={vendorSpend}
          projectSpend={projectSpend}
          recentInvoices={recentInvoicesMapped}
          categories={allCategories}
          selectedCategoryId={selectedCategoryId}
          from={params.from ?? ""}
          to={params.to ?? ""}
        />
      </Suspense>
    </div>
  );
}
