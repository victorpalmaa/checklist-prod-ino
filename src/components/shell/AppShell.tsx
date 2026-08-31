import * as React from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Plus,
  LogOut,
  ScrollText,
  Users,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

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

/**
 * Caminho da tela atual, derivado da rota. Substitui o titulo fixo que
 * ficava na barra superior e apenas repetia a marca: em telas fundas,
 * o breadcrumb diz onde o usuario esta.
 */
function useBreadcrumb(): string[] {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return ["Checklists"];

  const LABELS: Record<string, string> = {
    checklists: "Checklists",
    dashboard: "Dashboard",
    admin: "Admin",
    templates: "Templates",
    usuarios: "Usuários",
    auditoria: "Auditoria",
    novo: "Novo",
    editar: "Editar",
    po: "Pó",
    gel: "Gel",
    capsula: "Cápsula",
    goma: "Goma",
  };

  // Telas de primeiro nivel ja tem o proprio H1: repetir o nome na
  // barra seria duplicacao. O caminho so aparece quando ha profundidade.
  if (parts.length < 2) return [];

  const crumbs: string[] = [];
  for (const part of parts) {
    const label = LABELS[part];
    // Segmento sem rotulo conhecido e um id: vira reticencias em vez de
    // despejar um UUID na barra.
    crumbs.push(label ?? "…");
  }
  return crumbs;
}

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
  const breadcrumb = useBreadcrumb();
  const { profile, signOut } = useAuth();
  const userName = profile?.full_name ?? "";
  const userInitials = deriveInitials(profile?.full_name);

  return (
    <div className={cn("flex min-h-screen w-full bg-[var(--color-surface-page)]", className)}>
      <aside
        className="flex h-screen w-[280px] shrink-0 flex-col border-r border-[var(--color-primary-border)] bg-[var(--color-surface-card)]"
        aria-label="Navegação principal"
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-4 border-b border-[var(--color-primary-border)]">
          <Logo variant="color" height={24} />
          <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--color-fg)]">
            Checklist de produção
          </span>
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
            <RoleGate allow={["admin"]}>
              <li>
                <NavLink
                  to="/admin/usuarios"
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-[10px] border-l-3 px-3 py-2 text-[14px] font-medium duration-150 ease-in-out",
                      isActive
                        ? "border-l-[var(--color-brand)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]"
                        : "border-l-transparent text-[var(--color-fg-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
                    )
                  }
                >
                  <Users
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Usuários</span>
                </NavLink>
              </li>
            </RoleGate>
          </ul>
        </nav>

        <div className="border-t border-[var(--color-primary-border)] px-5 py-4">
          <div className="mb-2">
            <span className="text-eyebrow">Sistema</span>
          </div>
          <p className="whitespace-nowrap text-[11px] leading-tight text-[var(--color-fg-muted)]">
            RED-029 — Checklist de produção
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-primary-border)] bg-[var(--color-surface-card)] px-6">
          <nav className="min-w-0 flex-1" aria-label="Caminho da página">
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumb.map((crumb, i) => (
                <li key={`${crumb}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span
                      className="text-caption text-[var(--color-fg-muted)]"
                      aria-hidden="true"
                    >
                      /
                    </span>
                  )}
                  <span
                    className={
                      i === breadcrumb.length - 1
                        ? "text-caption font-medium text-[var(--color-fg)]"
                        : "text-caption text-[var(--color-fg-muted)]"
                    }
                  >
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

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
