"use client";

import { Download, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { AppNav } from "@/components/app-nav";
import { MobileBottomBar } from "@/components/mobile-bottom-bar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProjectSwitcher } from "@/components/project-switcher";
import Image from "next/image";
import { ExportDataButton } from "@/components/export-data-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppShellProps = {
  role: "ADMIN" | "STAFF";
  name: string;
  email: string;
  projects: { id: string; name: string; status: string }[];
  selectedProjectId: string | null;
  children: React.ReactNode;
};

export function AppShell({ role, name, email, projects, selectedProjectId, children }: AppShellProps) {
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
          <Image src="/sanvicasa-logo.png" alt="Sanvicasa" width={168} height={35} className="h-7 w-auto object-contain object-left" priority unoptimized />
          <p className="text-xs text-muted-foreground">Invoice &amp; Billing</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AppNav role={role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {/* Mobile App Brand Title */}
            <div className="md:hidden">
              <Image src="/sanvicasa-logo.png" alt="Sanvicasa" width={118} height={25} className="h-5 w-auto object-contain object-left" priority unoptimized />
            </div>
            <div className="min-w-0 flex-1 md:max-w-xs">
              <ProjectSwitcher
                role={role}
                projects={projects}
                selectedProjectId={selectedProjectId}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {role === "ADMIN" && (
              <div className="hidden sm:block">
                <ExportDataButton label="Download all data" />
              </div>
            )}
            <Badge
              variant="secondary"
              className="hidden text-[11px] font-semibold sm:inline-flex"
            >
              {role}
            </Badge>
            <Avatar className="hidden size-8 shrink-0 sm:flex">
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-sm font-medium leading-none">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex size-9 shrink-0 items-center justify-center rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
                aria-label="Open account menu"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{role}</Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {role === "ADMIN" && (
                    <>
                      <DropdownMenuItem
                        render={<a href="/api/admin/export?dataset=all&format=xlsx" download />}
                        className="px-2 py-2"
                      >
                        <Download className="size-4" />
                        Download all data
                      </DropdownMenuItem>
                      <DropdownMenuItem render={<a href="/admin/settings" />} className="px-2 py-2">
                        <Settings className="size-4" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    render={<a href="/docs/Staff_User_Guide.html" target="_blank" rel="noopener noreferrer" />}
                    className="px-2 py-2 text-sky-600 dark:text-sky-400 font-medium"
                  >
                    <span>📖</span>
                    User Guide (માર્ગદર્શિકા)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="px-2 py-2"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
