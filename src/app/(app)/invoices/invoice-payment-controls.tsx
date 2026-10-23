"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordInvoicePayment } from "./actions";

const PAYMENT_MODES = [
  { value: "NEFT", label: "NEFT", referenceLabel: "UTR number", placeholder: "NEFT UTR number" },
  { value: "RTGS", label: "RTGS", referenceLabel: "UTR number", placeholder: "RTGS UTR number" },
  { value: "IMPS", label: "IMPS", referenceLabel: "Transaction reference", placeholder: "IMPS transaction reference" },
  { value: "CHEQUE", label: "Cheque", referenceLabel: "Cheque number", placeholder: "Cheque number" },
  { value: "BANK_TRANSFER", label: "Bank to bank", referenceLabel: "Bank reference", placeholder: "Bank transfer reference" },
  { value: "UPI", label: "UPI", referenceLabel: "UPI transaction ID", placeholder: "UPI transaction ID / UTR" },
] as const;

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(value);
}

function formatPaidAt(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InvoicePaymentControls({
  invoiceId, status, paidAt, invoiceNumber, vendorName, categoryName,
  total, paidAmount, compact,
}: {
  invoiceId: string;
  status: string;
  paidAt: string | null;
  invoiceNumber: string;
  vendorName: string;
  categoryName: string | null;
  total: number;
  paidAmount: number;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const balance = Math.max(0, total - paidAmount);
  const [amount, setAmount] = useState(String(balance || total));
  const [paidOn, setPaidOn] = useState(today());
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const canPay = balance > 0.009 &&
    ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(status);

  function submitPayment() {
    startTransition(async () => {
      try {
        await recordInvoicePayment({
          invoiceId, amount: Number(amount), paidOn, mode, reference, notes,
        });
        toast.success("Payment recorded");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Payment failed");
      }
    });
  }

  function handlePrint() {
    const paidLabel = paidAt ? formatPaidAt(new Date(paidAt)) : "—";
    const html = `<!doctype html><html><head><title>Invoice ${escapeHtml(invoiceNumber)}</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0;font-size:14px}.muted{color:#666}.box{border:1px solid #ddd;border-radius:12px;padding:20px;max-width:420px}</style></head><body><div class="box"><h1>Invoice ${escapeHtml(invoiceNumber)}</h1><p><span class="muted">Vendor:</span> ${escapeHtml(vendorName)}</p><p><span class="muted">Category:</span> ${escapeHtml(categoryName ?? "—")}</p><p><span class="muted">Total:</span> ${escapeHtml(formatCurrency(total))}</p><p><span class="muted">Paid:</span> ${escapeHtml(formatCurrency(paidAmount))}</p><p><span class="muted">Balance:</span> ${escapeHtml(formatCurrency(balance))}</p><p><span class="muted">Status:</span> ${escapeHtml(status.replaceAll("_", " "))}</p><p><span class="muted">Fully paid at:</span> ${escapeHtml(paidLabel ?? "—")}</p></div><script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
    if (!w) return toast.error("Allow pop-ups to print");
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex flex-col gap-2"}>
      {!compact && paidAmount > 0 && (
        <p className="text-xs text-muted-foreground">
          Paid {formatCurrency(paidAmount)} · Balance {formatCurrency(balance)}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        {canPay && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                >
                  <CreditCard className="size-3.5" />
                  Pay
                </Button>
              }
            />
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record payment</DialogTitle>
                <DialogDescription className="break-words pr-5">
                  {invoiceNumber} · {vendorName} · Balance {formatCurrency(balance)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`amount-${invoiceId}`}>Amount</Label>
                  <Input
                    id={`amount-${invoiceId}`}
                    type="number"
                    min="0.01"
                    max={balance}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`date-${invoiceId}`}>Payment date</Label>
                  <DatePicker
                    id={`date-${invoiceId}`}
                    value={paidOn}
                    onChange={setPaidOn}
                    placeholder="Select payment date"
                  />
                </div>
                <div className="grid min-w-0 gap-2 sm:col-span-2">
                  <Label id={`mode-${invoiceId}`}>Payment mode</Label>
                  <Tabs
                    value={mode}
                    onValueChange={(value) => {
                      if (typeof value !== "string") return;
                      setMode(value);
                      setReference("");
                    }}
                  >
                    <TabsList
                      aria-labelledby={`mode-${invoiceId}`}
                      className="grid w-full grid-cols-3 gap-1 group-data-horizontal/tabs:h-auto"
                    >
                      {PAYMENT_MODES.map((method) => (
                        <TabsTrigger
                          key={method.value}
                          value={method.value}
                          disabled={pending}
                          className="h-10 min-w-0 px-2 text-xs sm:text-sm"
                        >
                          {method.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {PAYMENT_MODES.map((method) => (
                      <TabsContent key={method.value} value={method.value} className="pt-2">
                        <div className="grid gap-2">
                          <Label htmlFor={`ref-${invoiceId}-${method.value}`}>
                            {method.referenceLabel} (optional)
                          </Label>
                          <Input
                            id={`ref-${invoiceId}-${method.value}`}
                            placeholder={method.placeholder}
                            value={reference}
                            maxLength={100}
                            autoComplete="off"
                            disabled={pending}
                            onChange={(e) => setReference(e.target.value)}
                          />
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={`notes-${invoiceId}`}>Notes</Label>
                  <Input
                    id={`notes-${invoiceId}`}
                    placeholder="Optional payment notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    pending ||
                    !paidOn ||
                    Number(amount) <= 0 ||
                    Number(amount) > balance + 0.01
                  }
                  onClick={submitPayment}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Save payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={handlePrint}
          title="Print invoice"
        >
          <Printer className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
