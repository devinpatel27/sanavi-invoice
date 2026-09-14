import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invoiceAccessWhere } from "@/lib/invoices/access";
import { PaymentDeleteButton } from "./payment-delete-button";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(value);
}

export default async function PaymentsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const access = invoiceAccessWhere({ id: session.user.id, role: session.user.role });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [payments, payableInvoices] = await Promise.all([
    db.payment.findMany({
      where: { invoice: { is: access } },
      include: { invoice: { include: { vendor: true, category: true, project: true } } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.invoice.findMany({
      where: {
        ...access,
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE", "PAID"] },
      },
      select: { total: true, payments: { select: { amount: true, paidOn: true } } },
    }),
  ]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const paidThisMonth = payments
    .filter((p) => p.paidOn >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = payableInvoices.reduce((sum, invoice) => {
    const paid = invoice.payments.reduce((value, p) => value + Number(p.amount), 0);
    return sum + Math.max(0, Number(invoice.total) - paid);
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Payment transactions linked directly to confirmed invoices.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Paid this month", formatCurrency(paidThisMonth)],
          ["Total recorded", formatCurrency(totalPaid)],
          ["Outstanding balance", formatCurrency(outstanding)],
        ].map(([label, value]) => (
          <Card key={label}><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl tabular-nums">{value}</CardTitle></CardHeader></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <CardDescription>{payments.length} transaction(s), newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <p>No payments recorded yet.</p>
              <Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/invoices" />}>Open invoices</Button>
            </div>
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="space-y-3 md:hidden">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border bg-card p-3.5 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/invoices/${payment.invoiceId}/review`}
                          className="font-semibold text-primary underline-offset-4 hover:underline text-sm"
                        >
                          Invoice #{payment.invoice.invoiceNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {payment.invoice.vendor.name}
                          {payment.invoice.category?.name ? ` · ${payment.invoice.category.name}` : ""}
                        </p>
                      </div>
                      <span className="font-semibold text-sm tabular-nums text-foreground">
                        {formatCurrency(Number(payment.amount))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {payment.paidOn.toLocaleDateString("en-IN")}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {payment.mode ?? "Other"}
                        </Badge>
                      </div>
                      {session.user.role === "ADMIN" && (
                        <PaymentDeleteButton invoiceId={payment.invoiceId} paymentId={payment.id} />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Vendor</TableHead><TableHead>Category</TableHead><TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap">{payment.paidOn.toLocaleDateString("en-IN")}</TableCell>
                        <TableCell><Link className="font-medium underline-offset-4 hover:underline" href={`/invoices/${payment.invoiceId}/review`}>{payment.invoice.invoiceNumber}</Link></TableCell>
                        <TableCell>{payment.invoice.vendor.name}</TableCell>
                        <TableCell>{payment.invoice.category?.name ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{payment.mode ?? "Other"}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{payment.reference ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(Number(payment.amount))}</TableCell>
                        <TableCell className="text-right">{session.user.role === "ADMIN" && <PaymentDeleteButton invoiceId={payment.invoiceId} paymentId={payment.id} />}</TableCell>
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
