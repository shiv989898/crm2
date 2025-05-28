
"use client";

import type { ReactNode } from 'react';
import { MainNav } from "./MainNav";
import { UserNav } from "./UserNav";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter, 
  SidebarInset,
  SidebarTrigger,
  SidebarMenuButton // Added import for consistency if used directly
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeft, Settings } from "lucide-react";
import Link from "next/link";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarHeader className="p-4 flex justify-between items-center">
           <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-primary"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
            <h1 className="text-xl font-semibold text-foreground">Nexus CRM</h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <MainNav />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <Link href="/settings" passHref legacyBehavior>
            <SidebarMenuButton 
              asChild 
              className="justify-start w-full hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              tooltip={{ children: "Settings", className: "bg-popover text-popover-foreground" }}
            >
              <a> {/* <a> tag is needed for NextLink */}
                <Settings className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">Settings</span>
              </a>
            </SidebarMenuButton>
          </Link>
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <div className="flex-1">
            {/* Placeholder for breadcrumbs or page title */}
          </div>
          <UserNav />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
