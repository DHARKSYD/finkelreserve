import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { ADMIN_NAV } from "./nav-config";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="font-display font-black text-sm leading-none truncate">
                Finkel Reserve
              </p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-mono mt-1">
                — Control room
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_NAV.map((item) => {
                  const isActive =
                    item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link to={item.to} className="font-medium">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.status === "soon" && (
                            <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                              Soon
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground">Admin</p>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="shrink-0 h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:bg-destructive hover:text-destructive-foreground transition"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="flex md:hidden items-center gap-3 border-b border-border px-4 py-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
          <SidebarTrigger />
          <p className="font-display font-black text-sm">Admin</p>
        </header>
        <div className="flex-1 w-full max-w-[1400px] mx-auto px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
