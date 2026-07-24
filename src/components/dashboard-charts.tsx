"use client";

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
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type MonthSpendPoint = {
  month: string;
  label: string;
  total: number;
};

export type CategorySpendPoint = {
  name: string;
  total: number;
  count: number;
};

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
}: {
  monthlySpend: MonthSpendPoint[];
  categorySpend: CategorySpendPoint[];
}) {
  const hasMonthData = monthlySpend.some((p) => p.total > 0);
  const hasCategoryData = categorySpend.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="transition-shadow duration-200 hover:shadow-sm">
        <CardHeader>
          <CardTitle>Spend trend</CardTitle>
          <CardDescription>Month-wise invoiced total (last 12 months)</CardDescription>
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
                      <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
          <CardDescription>Spend breakdown across material categories</CardDescription>
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
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
    </div>
  );
}
