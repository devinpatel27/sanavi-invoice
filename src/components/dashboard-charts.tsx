"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MonthSpendPoint = {
  month: string;
  label: string;
  total: number;
};

export type CategorySpendPoint = {
  id: string | null;
  name: string;
  total: number;
  count: number;
};

export type CategoryOption = { id: string; name: string };
export type StatusPoint = { name: string; value: number; count: number };
export type VendorSpendPoint = { name: string; total: number; count: number };

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function DashboardCharts({
  monthlySpend,
  categorySpend,
  statusBreakdown,
  vendorSpend,
  categories,
  selectedCategoryId,
}: {
  monthlySpend: MonthSpendPoint[];
  categorySpend: CategorySpendPoint[];
  statusBreakdown: StatusPoint[];
  vendorSpend: VendorSpendPoint[];
  categories: CategoryOption[];
  selectedCategoryId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const hasMonthData = monthlySpend.some((p) => p.total > 0);
  const hasCategoryData = categorySpend.length > 0;

  const categoryItems = [
    { value: "ALL", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  function onCategoryChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") params.delete("categoryId");
    else params.set("categoryId", value);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const selectedName =
    categories.find((c) => c.id === selectedCategoryId)?.name ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1.5">
        <Label className="text-xs">Chart by category</Label>
        <Select
          value={selectedCategoryId || "ALL"}
          onValueChange={onCategoryChange}
          items={categoryItems}
          disabled={pending}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="transition-shadow duration-200 hover:shadow-sm">
          <CardHeader>
            <CardTitle>Spend trend</CardTitle>
            <CardDescription>
              Month-wise invoiced total (last 12 months)
              {selectedName ? ` · ${selectedName}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {!hasMonthData ? (
              <ChartEmpty message="No invoice totals yet. Upload and confirm invoices to see the trend." />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlySpend}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="var(--foreground)"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--foreground)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={56}
                      tickFormatter={(v) =>
                        v >= 100000
                          ? `${(v / 100000).toFixed(1)}L`
                          : v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatInr(Number(value ?? 0)),
                        "Spend",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      fill="url(#spendFill)"
                      animationDuration={700}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-sm">
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription>
              Spend breakdown across material categories
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {!hasCategoryData ? (
              <ChartEmpty message="No categorized invoices yet. Confirm a review with a category selected." />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categorySpend}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(v) =>
                        v >= 100000
                          ? `${(v / 100000).toFixed(1)}L`
                          : v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <Tooltip
                      formatter={(value, _name, item) => [
                        formatInr(Number(value ?? 0)),
                        `${(item?.payload as CategorySpendPoint | undefined)?.count ?? 0} invoice(s)`,
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--foreground)"
                      radius={[0, 6, 6, 0]}
                      animationDuration={700}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-sm">
          <CardHeader>
            <CardTitle>Invoice status</CardTitle>
            <CardDescription>Value split by payment status</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {statusBreakdown.length === 0 ? (
              <ChartEmpty message="No confirmed invoices to summarize." />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                      {statusBreakdown.map((row, index) => <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value, _name, item) => [formatInr(Number(value ?? 0)), `${(item?.payload as StatusPoint | undefined)?.count ?? 0} invoice(s)`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-sm">
          <CardHeader>
            <CardTitle>Top vendors</CardTitle>
            <CardDescription>Invoice value by supplier</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {vendorSpend.length === 0 ? (
              <ChartEmpty message="No vendor spend available yet." />
            ) : (
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorSpend} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip formatter={(value, _name, item) => [formatInr(Number(value ?? 0)), `${(item?.payload as VendorSpendPoint | undefined)?.count ?? 0} invoice(s)`]} />
                    <Bar dataKey="total" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
