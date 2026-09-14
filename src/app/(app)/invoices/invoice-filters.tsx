"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "PROCESSING", label: "Processing" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
] as const;

export function InvoiceFilters({
  vendors,
  categories,
}: {
  vendors: FilterOption[];
  categories: FilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [vendorId, setVendorId] = useState(searchParams.get("vendorId") ?? "");
  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") ?? ""
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "ALL");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  const apply = useCallback(
    (overrides?: Partial<Record<string, string>>) => {
      const params = new URLSearchParams();
      const next = {
        q,
        vendorId,
        categoryId,
        status,
        from,
        to,
        ...overrides,
      };
      if (next.q.trim()) params.set("q", next.q.trim());
      if (next.vendorId) params.set("vendorId", next.vendorId);
      if (next.categoryId) params.set("categoryId", next.categoryId);
      if (next.status && next.status !== "ALL") params.set("status", next.status);
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [q, vendorId, categoryId, status, from, to, pathname, router]
  );

  function clearAll() {
    setQ("");
    setVendorId("");
    setCategoryId("");
    setStatus("ALL");
    setFrom("");
    setTo("");
    startTransition(() => router.push(pathname));
  }

  const vendorItems = [
    { value: "ALL", label: "All vendors" },
    ...vendors.map((v) => ({ value: v.id, label: v.name })),
  ];
  const categoryItems = [
    { value: "ALL", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="grid gap-1.5 xl:col-span-2">
          <Label htmlFor="invoice-q" className="text-xs">
            Search
          </Label>
          <Input
            id="invoice-q"
            placeholder="Invoice # or vendor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Vendor</Label>
          <Select
            value={vendorId || "ALL"}
            onValueChange={(value) => {
              const next = value === "ALL" || !value ? "" : value;
              setVendorId(next);
              apply({ vendorId: next });
            }}
            items={vendorItems}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All vendors" />
            </SelectTrigger>
            <SelectContent>
              {vendorItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Category</Label>
          <Select
            value={categoryId || "ALL"}
            onValueChange={(value) => {
              const next = value === "ALL" || !value ? "" : value;
              setCategoryId(next);
              apply({ categoryId: next });
            }}
            items={categoryItems}
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
        <div className="grid gap-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={status || "ALL"}
            onValueChange={(value) => {
              const next = value ?? "ALL";
              setStatus(next);
              apply({ status: next });
            }}
            items={[...STATUS_OPTIONS]}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6 xl:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={() => apply()}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={clearAll}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
