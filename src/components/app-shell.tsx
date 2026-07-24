"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AppShellProps = {
  role: "ADMIN" | "STAFF";
  name: string;
  email: string;
  children: React.ReactNode;
};

export function AppShell({ role, name, email, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh bg-muted/30">
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
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:gap-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[min(100%,18rem)] p-0">
              <SheetHeader className="border-b px-5 py-5 text-left">
                <SheetTitle className="text-base font-semibold">
                  Sanvicasa
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Invoice &amp; Billing
                </p>
              </SheetHeader>
              <div className="p-3">
                <AppNav role={role} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold md:hidden">Sanvicasa</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <Badge
              variant="secondary"
              className="hidden xs:inline-flex sm:inline-flex"
            >
              {role}
            </Badge>
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
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

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
