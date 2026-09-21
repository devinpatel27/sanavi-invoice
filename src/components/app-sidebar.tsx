"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Building2,
  Boxes,
  Tags,
  Wallet,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/invoices/upload", label: "Upload Invoice", icon: Upload },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/materials", label: "Rate Sheet", icon: Boxes },
  { href: "/vendors", label: "Vendors", icon: Building2, adminOnly: true },
  { href: "/categories", label: "Categories", icon: Tags, adminOnly: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
];

export function AppSidebar({ role }: { role: "ADMIN" | "STAFF" }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 flex-col gap-1 border-r bg-sidebar p-4">
      <div className="mb-4 px-2">
        <p className="text-sm font-semibold">Sanvicasa</p>
        <p className="text-xs text-muted-foreground">Invoice &amp; Billing</p>
      </div>
      {NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN").map(
        (item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        }
      )}
    </nav>
  );
}
