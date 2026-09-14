"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  confirmInvoiceReview,
  createCategoryInline,
  createVendorInline,
  checkDuplicateInvoice,
} from "./actions";
import { InvoiceFilePreview } from "@/components/invoice-file-preview";
import { InvoicePaymentControls } from "@/app/(app)/invoices/invoice-payment-controls";
import { InvoiceDeleteButton } from "@/app/(app)/invoices/invoice-delete-button";

export type ReviewVendor = { id: string; name: string; gstin: string | null };
export type ReviewCategory = { id: string; name: string; unit: string | null };
export type ReviewProject = { id: string; name: string };
export type ReviewLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rateExclGst: number;
  gstPercent: number;
  confidence?: number;
};

export type ReviewInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  vendorId: string;
  categoryId: string | null;
  categoryName: string | null;
  projectId: string;
  subtotal: number;
  sgst: number;
  cgst: number;
  igst: number;
  total: number;
  fileUrl: string;
  status: string;
  paidAt: string | null;
  paidAmount: number;
  lineItems: ReviewLineItem[];
  vendor: ReviewVendor;
};

type Props = {
  invoice: ReviewInvoice;
  vendors: ReviewVendor[];
  categories: ReviewCategory[];
  projects: ReviewProject[];
  possibleDuplicate: boolean;
};

function toDateInput(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ReviewForm({
  invoice,
  vendors: initialVendors,
  categories: initialCategories,
  projects,
  possibleDuplicate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendors, setVendors] = useState(initialVendors);
  const [categories, setCategories] = useState(initialCategories);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(
    toDateInput(invoice.invoiceDate)
  );
  const [dueDate, setDueDate] = useState(toDateInput(invoice.dueDate));
  const [vendorId, setVendorId] = useState(invoice.vendorId);
  const [vendorName, setVendorName] = useState(invoice.vendor.name);
  const [vendorGstin, setVendorGstin] = useState(invoice.vendor.gstin ?? "");
  const [categoryId, setCategoryId] = useState(invoice.categoryId ?? "");
  const [projectId, setProjectId] = useState(invoice.projectId);
  const [subtotal, setSubtotal] = useState(invoice.subtotal);
  const [sgst, setSgst] = useState(invoice.sgst);
  const [cgst, setCgst] = useState(invoice.cgst);
  const [igst, setIgst] = useState(invoice.igst);
  const [total, setTotal] = useState(invoice.total);
  const [lineItems, setLineItems] = useState(
    invoice.lineItems.map((li) => ({ ...li, createMaterial: false }))
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dupWarning, setDupWarning] = useState(possibleDuplicate);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  const lowConfidenceCount = useMemo(
    () => lineItems.filter((li) => (li.confidence ?? 1) < 0.7).length,
    [lineItems]
  );

  function updateLine(
    index: number,
    patch: Partial<(typeof lineItems)[number]>
  ) {
    setLineItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        description: "",
        quantity: 1,
        unit: "NOS",
        rateExclGst: 0,
        gstPercent: 0,
        createMaterial: false,
      },
    ]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const created = await createCategoryInline({ name: newCategoryName });
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setCategoryId(created.id);
      setNewCategoryName("");
      toast.success(`Category “${created.name}” created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    }
  }

  async function handleCreateVendor() {
    try {
      const created = await createVendorInline({
        name: vendorName,
        gstin: vendorGstin || null,
      });
      setVendors((prev) => {
        if (prev.some((v) => v.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setVendorId(created.id);
      setVendorName(created.name);
      setVendorGstin(created.gstin ?? "");
      toast.success(`Vendor “${created.name}” saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save vendor");
    }
  }

  async function onVendorSelect(id: string) {
    setVendorId(id);
    const v = vendors.find((x) => x.id === id);
    if (v) {
      setVendorName(v.name);
      setVendorGstin(v.gstin ?? "");
      const dup = await checkDuplicateInvoice(id, invoiceNumber, invoice.id);
      setDupWarning(Boolean(dup));
    }
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await confirmInvoiceReview({
          invoiceId: invoice.id,
          invoiceNumber,
          invoiceDate,
          dueDate: dueDate || null,
          vendorId,
          vendorName,
          vendorGstin: vendorGstin || null,
          categoryId: categoryId || null,
          projectId,
          subtotal,
          sgst,
          cgst,
          igst,
          total,
          forceDuplicate,
          lineItems: lineItems.map((li) => ({
            id: li.id,
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            rateExclGst: li.rateExclGst,
            gstPercent: li.gstPercent,
            createMaterial: li.createMaterial,
          })),
        });

        if (result && "duplicate" in result && result.duplicate) {
          setDupWarning(true);
          toast.error(result.message);
          return;
        }
      } catch (error) {
        // redirect() throws a NEXT_REDIRECT error — ignore those
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          return;
        }
        toast.error(
          error instanceof Error ? error.message : "Failed to confirm invoice"
        );
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {invoice.status === "NEEDS_REVIEW" || invoice.status === "PROCESSING"
              ? "Review extracted invoice"
              : "Edit invoice"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update invoice details, category, totals, and line items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{invoice.status.replace("_", " ")}</Badge>
          {lowConfidenceCount > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-700">
              <AlertTriangle className="size-3" />
              {lowConfidenceCount} low-confidence line(s)
            </Badge>
          )}
        </div>
      </div>

      {dupWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium">Possible duplicate invoice</p>
            <p className="text-muted-foreground dark:text-amber-200/80">
              Another invoice with this number may already exist for the selected
              vendor. Double-check before confirming.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forceDuplicate}
                onChange={(e) => setForceDuplicate(e.target.checked)}
              />
              Confirm anyway (force save)
            </label>
          </div>
        </div>
      )}

      <Card className="transition-shadow duration-200 hover:shadow-sm">
        <CardHeader>
          <CardTitle>Header</CardTitle>
          <CardDescription>Vendor, dates, and category</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="vendorSelect">Match vendor</Label>
            <Select
              value={vendorId}
              onValueChange={(value) => {
                if (value) void onVendorSelect(value);
              }}
              items={vendors.map((v) => ({
                value: v.id,
                label: v.gstin ? `${v.name} (${v.gstin})` : v.name,
              }))}
            >
              <SelectTrigger id="vendorSelect" className="w-full">
                <SelectValue placeholder="Select vendor…" />
              </SelectTrigger>
              <SelectContent align="start">
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                    {v.gstin ? ` (${v.gstin})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendorName">Vendor name</Label>
            <Input
              id="vendorName"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendorGstin">GSTIN</Label>
            <Input
              id="vendorGstin"
              value={vendorGstin}
              onChange={(e) => setVendorGstin(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCreateVendor()}>
              Save / create vendor from fields above
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoiceNumber">Invoice #</Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="projectId">Project</Label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                if (value) setProjectId(value);
              }}
              items={projects.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger id="projectId" className="w-full">
                <SelectValue placeholder="Select project…" />
              </SelectTrigger>
              <SelectContent align="start">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoiceDate">Invoice date</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="categoryId">Category</Label>
            <Select
              value={categoryId || null}
              onValueChange={(value) => setCategoryId(value ?? "")}
              items={categories.map((c) => ({ value: c.id, label: c.name }))}
            >
              <SelectTrigger id="categoryId" className="w-full">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent align="start">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="newCategory">Create category (STAFF allowed)</Label>
              <Input
                id="newCategory"
                placeholder="e.g. Electrical"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCreateCategory()}
            >
              <Plus className="size-4" />
              Add category
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="transition-shadow duration-200 hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Line items</CardTitle>
            <CardDescription>Edit quantities, rates, and descriptions</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-4" />
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {lineItems.map((li, index) => (
              <div
                key={li.id}
                className="space-y-3 rounded-lg border bg-muted/20 p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Line {index + 1}
                    {li.confidence != null && li.confidence < 0.7 && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {(li.confidence * 100).toFixed(0)}% conf
                      </Badge>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(index)}
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) =>
                    updateLine(index, { description: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Qty"
                    value={li.quantity}
                    onChange={(e) =>
                      updateLine(index, { quantity: Number(e.target.value) })
                    }
                  />
                  <Input
                    placeholder="Unit"
                    value={li.unit}
                    onChange={(e) => updateLine(index, { unit: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder="Rate"
                    value={li.rateExclGst}
                    onChange={(e) =>
                      updateLine(index, { rateExclGst: Number(e.target.value) })
                    }
                  />
                  <Input
                    type="number"
                    step="any"
                    placeholder="GST %"
                    value={li.gstPercent}
                    onChange={(e) =>
                      updateLine(index, { gstPercent: Number(e.target.value) })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={li.createMaterial}
                    onChange={(e) =>
                      updateLine(index, { createMaterial: e.target.checked })
                    }
                  />
                  Create material if unmatched
                </label>
              </div>
            ))}
          </div>

          {/* Desktop: table with horizontal scroll fallback */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Description</th>
                  <th className="pb-2 pr-2 font-medium">Qty</th>
                  <th className="pb-2 pr-2 font-medium">Unit</th>
                  <th className="pb-2 pr-2 font-medium">Rate</th>
                  <th className="pb-2 pr-2 font-medium">GST %</th>
                  <th className="pb-2 pr-2 font-medium">Material</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, index) => (
                  <tr key={li.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={li.description}
                          onChange={(e) =>
                            updateLine(index, { description: e.target.value })
                          }
                        />
                        {li.confidence != null && li.confidence < 0.7 && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {(li.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-2 w-24">
                      <Input
                        type="number"
                        step="any"
                        value={li.quantity}
                        onChange={(e) =>
                          updateLine(index, { quantity: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 w-24">
                      <Input
                        value={li.unit}
                        onChange={(e) =>
                          updateLine(index, { unit: e.target.value })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 w-28">
                      <Input
                        type="number"
                        step="any"
                        value={li.rateExclGst}
                        onChange={(e) =>
                          updateLine(index, {
                            rateExclGst: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 w-24">
                      <Input
                        type="number"
                        step="any"
                        value={li.gstPercent}
                        onChange={(e) =>
                          updateLine(index, {
                            gstPercent: Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={li.createMaterial}
                          onChange={(e) =>
                            updateLine(index, {
                              createMaterial: e.target.checked,
                            })
                          }
                        />
                        Create
                      </label>
                    </td>
                    <td className="py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLine(index)}
                        disabled={lineItems.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Subtotal", subtotal, setSubtotal],
              ["SGST", sgst, setSgst],
              ["CGST", cgst, setCgst],
              ["IGST", igst, setIgst],
              ["Total", total, setTotal],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label} className="grid gap-2">
              <Label>{label}</Label>
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setter(Number(e.target.value))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <InvoiceDeleteButton
          invoiceId={invoice.id}
          invoiceNumber={invoiceNumber}
          vendorName={vendorName}
          variant="button"
          redirectTo="/invoices"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/invoices")}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending}>
            {pending
              ? "Saving…"
              : invoice.status === "NEEDS_REVIEW" || invoice.status === "PROCESSING"
                ? "Confirm & save invoice"
                : "Save invoice changes"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Source file</CardTitle>
          <CardDescription>
            Uploaded invoice document — preview with zoom, or open in a new tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InvoiceFilePreview
            invoiceId={invoice.id}
            fileUrl={invoice.fileUrl}
          />
          <InvoicePaymentControls
            invoiceId={invoice.id}
            status={invoice.status}
            paidAt={invoice.paidAt}
            invoiceNumber={invoiceNumber}
            vendorName={
              vendors.find((v) => v.id === vendorId)?.name ??
              invoice.vendor.name
            }
            categoryName={
              categories.find((c) => c.id === categoryId)?.name ??
              invoice.categoryName
            }
            total={total}
            paidAmount={invoice.paidAmount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
