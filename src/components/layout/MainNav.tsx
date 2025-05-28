
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { LayoutDashboard, ListFilter, Users, Settings } from "lucide-react"; // Added Settings icon

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/audience-builder", label: "Audience Builder", icon: ListFilter },
  { href: "/settings", label: "Settings", icon: Settings },
  // Add more items here
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
              tooltip={{ children: item.label, className: "bg-popover text-popover-foreground" }}
              className={cn(
                "justify-start",
                (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)))
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <a> {/* <a> tag is needed when asChild is true for NextLink inside SidebarMenuButton */}
                <item.icon className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
