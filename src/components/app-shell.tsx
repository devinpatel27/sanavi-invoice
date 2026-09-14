"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { AppNav } from "@/components/app-nav";
import { MobileBottomBar } from "@/components/mobile-bottom-bar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type AppShellProps = {
  role: "ADMIN" | "STAFF";
  name: string;
  email: string;
  children: React.ReactNode;
};

export function AppShell({ role, name, email, children }: AppShellProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh bg-muted/30">
      {/* Desktop Sidebar (visible on md and up) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Sanvicasa
          </p>
          <p className="text-xs text-muted-foreground">Invoice &amp; Billing</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AppNav role={role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:gap-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile App Brand Title */}
            <div className="md:hidden">
              <p className="text-base font-bold tracking-tight text-foreground">
                Sanvicasa
              </p>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Invoice &amp; Billing
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Badge
              variant="secondary"
              className="text-[11px] font-semibold"
            >
              {role}
            </Badge>
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-sm font-medium leading-none">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 sm:hidden"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden shrink-0 sm:inline-flex"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </Button>
          </div>
        </header>

        {/* Main Content with bottom padding on mobile for MobileBottomBar */}
        <main className="flex-1 px-4 py-5 pb-28 sm:px-6 sm:py-6 sm:pb-8 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (visible only on mobile) */}
      <MobileBottomBar role={role} name={name} email={email} />
    </div>
  );
}
