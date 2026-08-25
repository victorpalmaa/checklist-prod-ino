import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const PAGE_SIZE = 20;

const KNOWN_TABLES: ReadonlyArray<AuditLogRow["table_name"]> = [
  "checklist_runs",
  "run_values",
  "run_signatures",
  "run_attachments",
  "form_templates",
  "form_sections",
  "form_fields",
  "profiles",
];

const KNOWN_ACTIONS: ReadonlyArray<AuditLogRow["action"]> = [
  "INSERT",
  "UPDATE",
  "DELETE",
];

const TABLE_LABELS: Record<string, string> = {
  checklist_runs: "Checklists (runs)",
  run_values: "Valores do checklist",
  run_signatures: "Assinaturas",
  run_attachments: "Anexos",
  form_templates: "Templates",
  form_sections: "Seções de template",
  form_fields: "Campos de template",
  profiles: "Perfis",
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
};

function formatDateTimePtBr(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function prettyJson(value: Json | null): string {
  if (value === null || value === undefined) return "(vazio)";
  try {
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tableLabel(t: string): string {
  return TABLE_LABELS[t] ?? t;
}

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

export function AuditLog() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const tabelaParam = searchParams.get("tabela");
  const acaoParam = searchParams.get("acao");
  const pageParam = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const profile = auth.profile;
  const isAdmin = !!(profile && profile.role === "admin");

  const profilesQuery = useQuery({
    queryKey: ["profiles-all-for-audit"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) {
        toast.error("Não foi possível carregar perfis para auditoria.");
        throw error;
      }
      return (data ?? []) as Pick<ProfileRow, "id" | "full_name">[];
    },
    enabled: !auth.loading && !!auth.session && isAdmin,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const profilesById = new Map<string, string>();
  if (profilesQuery.data) {
    for (const p of profilesQuery.data) {
      profilesById.set(p.id, p.full_name);
    }
  }

  const auditQuery = useQuery({
    queryKey: ["audit-log", tabelaParam, acaoParam, pageParam] as const,
    queryFn: async () => {
      let builder = supabase
        .from("audit_log")
        .select(
          "id, table_name, record_id, action, actor_id, before, after, occurred_at",
          { count: "exact" }
        )
        .order("occurred_at", { ascending: false });

      if (tabelaParam) {
        builder = builder.eq("table_name", tabelaParam);
      }
      if (acaoParam) {
        builder = builder.eq("action", acaoParam);
      }
      builder = builder.range(
        (pageParam - 1) * PAGE_SIZE,
        pageParam * PAGE_SIZE - 1
      );

      const { data, count, error } = await builder;
      if (error) {
        toast.error("Não foi possível carregar o log de auditoria.");
        throw error;
      }
      return { data: (data ?? []) as AuditLogRow[], count: count ?? 0 };
    },
    enabled: !auth.loading && !!auth.session && isAdmin,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const totalPages = auditQuery.data
    ? Math.max(1, Math.ceil(auditQuery.data.count / PAGE_SIZE))
    : 1;

  const hasAnyFilter = !!tabelaParam || !!acaoParam;

  const clearFilters = () => {
    setSearchParams({});
  };

  const goToPage = (p: number) => {
    const target = Math.min(Math.max(1, p), totalPages);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(target));
      return next;
    });
  };

  const onTabelaChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") {
        next.set("tabela", value);
      } else {
        next.delete("tabela");
      }
      next.set("page", "1");
      return next;
    });
  };

  const onAcaoChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") {
        next.set("acao", value);
      } else {
        next.delete("acao");
      }
      next.set("page", "1");
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-8 text-center">
        <ShieldAlert
          className="h-12 w-12 shrink-0 text-[var(--color-danger-text)]"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h1 className="text-title text-[var(--color-danger-text)]">
            Acesso restrito a administradores
          </h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Esta página contém registros de auditoria e só pode ser acessada
            por usuários com perfil de administrador.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display">Auditoria</h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Registro de todas as alterações no sistema da Pronutrition.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-[260px]">
          <Select
            value={tabelaParam ?? "all"}
            onValueChange={onTabelaChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tabelas</SelectItem>
              {KNOWN_TABLES.map((t) => (
                <SelectItem key={t} value={t}>
                  {tableLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:w-[220px]">
          <Select value={acaoParam ?? "all"} onValueChange={onAcaoChange}>
            <SelectTrigger>
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {KNOWN_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {actionLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {auditQuery.isLoading && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-body text-[var(--color-fg-secondary)]">
          Carregando registros de auditoria…
        </div>
      )}

      {auditQuery.isError && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-6 text-body text-[var(--color-danger-text)]">
          Erro ao carregar o log de auditoria. Tente novamente.
        </div>
      )}

      {auditQuery.isSuccess &&
        auditQuery.data.data.length === 0 &&
        !hasAnyFilter && (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
            <p className="text-body text-[var(--color-fg-secondary)]">
              Nenhum registro de auditoria ainda
            </p>
          </div>
        )}

      {auditQuery.isSuccess &&
        auditQuery.data.data.length === 0 &&
        hasAnyFilter && (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
            <p className="text-body text-[var(--color-fg-secondary)]">
              Nenhum resultado para os filtros aplicados
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        )}

      {auditQuery.isSuccess && auditQuery.data.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28px]"></TableHead>
                <TableHead>Data / hora</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Quem fez</TableHead>
                <TableHead>ID do registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.data.data.map((row) => {
                const isOpen = expanded.has(row.id);
                const actorName = row.actor_id
                  ? profilesById.get(row.actor_id) ?? `ID: ${row.actor_id}`
                  : "(sistema)";
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-h-[32px] min-w-[32px]"
                          aria-label={isOpen ? "Recolher detalhes" : "Expandir detalhes"}
                          onClick={() => toggleExpand(row.id)}
                          type="button"
                        >
                          {isOpen ? (
                            <ChevronDown
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTimePtBr(row.occurred_at)}
                      </TableCell>
                      <TableCell>{tableLabel(row.table_name)}</TableCell>
                      <TableCell>
                        <span
                          className={
                            "inline-flex items-center rounded-[8px] px-2 py-0.5 text-[12px] font-medium " +
                            (row.action === "INSERT"
                              ? "bg-[var(--color-success-tint)] text-[var(--color-success-text)]"
                              : row.action === "UPDATE"
                                ? "bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]"
                                : row.action === "DELETE"
                                  ? "bg-[var(--color-danger-tint)] text-[var(--color-danger-text)]"
                                  : "bg-[var(--color-surface-subtle)] text-[var(--color-fg)]")
                          }
                        >
                          {actionLabel(row.action)}
                        </span>
                      </TableCell>
                      <TableCell>{actorName}</TableCell>
                      <TableCell className="font-mono text-[12px] text-[var(--color-fg-secondary)]">
                        {row.record_id}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-1">
                                <span className="text-caption text-[var(--color-fg-secondary)]">
                                  Antes (before)
                                </span>
                                <pre className="max-h-[320px] overflow-auto rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-3 text-[12px] leading-relaxed text-[var(--color-fg)]">
                                  {prettyJson(row.before)}
                                </pre>
                              </div>
                              <div className="space-y-1">
                                <span className="text-caption text-[var(--color-fg-secondary)]">
                                  Depois (after)
                                </span>
                                <pre className="max-h-[320px] overflow-auto rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-3 text-[12px] leading-relaxed text-[var(--color-fg)]">
                                  {prettyJson(row.after)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] px-4 py-3">
            <p className="text-caption text-[var(--color-fg-secondary)]">
              Página {pageParam} de {totalPages} · Total de{" "}
              {auditQuery.data.count} registro(s)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam <= 1}
                onClick={() => goToPage(pageParam - 1)}
                type="button"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageParam >= totalPages}
                onClick={() => goToPage(pageParam + 1)}
                type="button"
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
