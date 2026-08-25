import * as React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Plus,
  LogOut,
  ScrollText,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { Logo } from "@/components/brand/Logo";
import { RoleGate } from "@/components/auth/RoleGate";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

const navItems = [
  {
    label: "Checklists",
    to: "/checklists",
    icon: ClipboardList,
  },
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Admin",
    to: "/admin/templates",
    icon: Settings,
  },
] as const;

function deriveInitials(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const raw = fullName.trim();
  if (raw.length === 0) return "";
  const parts = raw.split(/\s+/);
  const first = parts[0] ?? "";
  if (parts.length === 1) {
    return first.charAt(0).toUpperCase();
  }
  const last = parts[parts.length - 1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export function AppShell({ children, className }: AppShellProps) {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const userName = profile?.full_name ?? "";
  const userInitials = deriveInitials(profile?.full_name);

  return (
    <div className={cn("flex min-h-screen w-full bg-[var(--color-surface-page)]", className)}>
      <aside
        className="flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--color-primary-border)] bg-[var(--color-surface-card)]"
        aria-label="Navegação principal"
      >
        <div className="flex h-16 shrink-0 items-center px-5 border-b border-[var(--color-primary-border)]">
          <Logo variant="color" height={28} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-2">
            <span className="text-eyebrow">Menu</span>
          </div>
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-[10px] border-l-3 px-3 py-2 text-[14px] font-medium duration-150 ease-in-out",
                        isActive
                          ? "border-l-[var(--color-brand)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]"
                          : "border-l-transparent text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
                      )
                    }
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
            <RoleGate allow={["admin"]}>
              <li>
                <NavLink
                  to="/auditoria"
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-[10px] border-l-3 px-3 py-2 text-[14px] font-medium duration-150 ease-in-out",
                      isActive
                        ? "border-l-[var(--color-brand)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]"
                        : "border-l-transparent text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
                    )
                  }
                >
                  <ScrollText
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Auditoria</span>
                </NavLink>
              </li>
            </RoleGate>
          </ul>
        </nav>

        <div className="border-t border-[var(--color-primary-border)] px-5 py-4">
          <div className="mb-2">
            <span className="text-eyebrow">Sistema</span>
          </div>
          <p className="text-caption">
            RED-029 Rev. 06 — Checklist de produção
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-primary-border)] bg-[var(--color-surface-card)] px-6">
          <div className="min-w-0 flex-1">
            <span className="text-caption text-[var(--color-fg-muted)]">
              Checklist de produção
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/checklists/novo")}
              type="button"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Novo registro
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Conta de ${userName}`}
                  className="h-11 w-11"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{
                      backgroundColor: "var(--color-primary-tint)",
                      color: "var(--color-primary-text)",
                    }}
                    aria-hidden="true"
                  >
                    {userInitials}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-[var(--color-fg)]">
                      {userName}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6" id="conteudo-principal">
          {children}
        </main>
      </div>
    </div>
  );
}
