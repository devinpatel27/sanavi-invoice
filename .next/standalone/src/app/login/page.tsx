import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.95_0.02_75),_transparent_55%),linear-gradient(to_bottom,_oklch(0.98_0.005_75),_oklch(0.96_0.01_240))]"
      />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Sanvicasa
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Invoice &amp; Billing
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Upload and track construction material purchase invoices
          </p>
        </div>
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-2xl border bg-card/80" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
