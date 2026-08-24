import * as React from "react";
import { ClipboardCheck, Plus } from "lucide-react";

import { AppShell } from "@/components/shell/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const DesignSystemLazy = import.meta.env.DEV
  ? React.lazy(() => import("@/pages/DesignSystem"))
  : null;

function ProductionHome() {
  return (
    <AppShell pageTitle="Checklist de produção">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-eyebrow">Portal industrial</span>
              <Badge
                variant="default"
                style={{
                  backgroundColor: "var(--color-success-tint)",
                  color: "var(--color-success-text)",
                  border: "1px solid var(--color-success-border)",
                  borderRadius: "6px",
                }}
              >
                Sistema operacional
              </Badge>
            </div>
            <h1 className="text-display">Checklist de produção</h1>
            <p className="text-body text-[var(--color-fg-secondary)] max-w-2xl">
              Registro e acompanhamento de conformidade durante o processo
              fabril, conforme procedimento RED-029 Rev. 06 da Pronutrition.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline">
              <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              Relatórios
            </Button>
            <Button variant="default">
              <Plus className="h-5 w-5" aria-hidden="true" />
              Novo checklist
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-eyebrow">Hoje</span>
              </div>
              <CardTitle className="text-[24px] font-semibold -tracking-[0.02em]">
                0
              </CardTitle>
              <CardDescription>
                Checklists iniciados no turno atual
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-eyebrow">Em andamento</span>
              </div>
              <CardTitle className="text-[24px] font-semibold -tracking-[0.02em]">
                0
              </CardTitle>
              <CardDescription>
                Lotes aguardando preenchimento
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span className="text-eyebrow">Conformes</span>
              </div>
              <CardTitle
                className="text-[24px] font-semibold -tracking-[0.02em]"
                style={{ color: "var(--color-success-text)" }}
              >
                0
              </CardTitle>
              <CardDescription>
                Liberados sem não-conformidades nos últimos 7 dias
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Últimos checklists</CardTitle>
              <CardDescription>
                Registros mais recentes de conformidade de produção.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] py-12">
              <ClipboardCheck
                className="h-10 w-10 text-[var(--color-fg-muted)]"
                aria-hidden="true"
              />
              <div className="space-y-1 text-center">
                <p className="text-heading text-[var(--color-fg)]">
                  Nenhum checklist registrado ainda
                </p>
                <p className="text-caption max-w-md mx-auto">
                  Ao iniciar um novo lote de produção, o registro aparecerá
                  aqui para acompanhamento e auditoria.
                </p>
              </div>
              <Button variant="default" size="sm">
                <Plus className="h-5 w-5" aria-hidden="true" />
                Criar primeiro checklist
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function isDesignSystemRoute(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return window.location.pathname === "/design-system";
  } catch {
    return false;
  }
}

export default function App() {
  const [isDs, setIsDs] = React.useState<boolean>(() => isDesignSystemRoute());

  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onChange = () => setIsDs(isDesignSystemRoute());
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return (
    <>
      {import.meta.env.DEV && isDs && DesignSystemLazy ? (
        <React.Suspense
          fallback={
            <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)]">
              <span className="text-caption text-[var(--color-fg-muted)]">
                Carregando design system...
              </span>
            </div>
          }
        >
          <DesignSystemLazy />
        </React.Suspense>
      ) : (
        <ProductionHome />
      )}

      <Toaster
        richColors={false}
        closeButton
        position="top-right"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] p-4 pr-6 text-[14px]",
            title: "text-[14px] font-semibold text-[var(--color-fg)]",
            description:
              "text-[13px] text-[var(--color-fg-secondary)] leading-relaxed mt-0.5",
            actionButton:
              "inline-flex h-9 items-center justify-center rounded-[10px] bg-[var(--color-primary)] px-3 text-[12px] font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] min-w-[44px]",
            cancelButton:
              "inline-flex h-9 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-transparent px-3 text-[12px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)] min-w-[44px]",
            closeButton:
              "absolute right-1.5 top-1.5 rounded-[6px] p-1 text-[var(--color-fg-muted)] opacity-70 transition-opacity hover:opacity-100 focus:opacity-100 h-8 w-8 inline-flex items-center justify-center",
          },
        }}
      />
    </>
  );
}
