import * as React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Plus,
  LogOut,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  className?: string;
}

const navItems = [
  {
    label: "Checklists",
    href: "#",
    icon: ClipboardList,
    active: true,
  },
  {
    label: "Dashboard",
    href: "#",
    icon: LayoutDashboard,
    active: false,
  },
  {
    label: "Admin",
    href: "#",
    icon: Settings,
    active: false,
  },
] as const;

const USER_NAME = "Operador de produção";
const USER_INITIALS = "OP";

export function AppShell({ children, pageTitle, className }: AppShellProps) {
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
                  <a
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium duration-150 ease-in-out",
                      "min-w-[44px]",
                      item.active
                        ? "bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]"
                        : "text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
                    )}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
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
            {pageTitle ? (
              <h2 className="text-title truncate">{pageTitle}</h2>
            ) : (
              <span className="text-caption text-[var(--color-fg-muted)]">
                Checklist de produção
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="default" size="sm">
              <Plus className="h-5 w-5" aria-hidden="true" />
              Novo registro
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Conta de ${USER_NAME}`}
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
                    {USER_INITIALS}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-[var(--color-fg)]">
                      {USER_NAME}
                    </span>
                    <span className="text-caption text-[var(--color-fg-muted)] font-normal">
                      Turno diurno
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
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
