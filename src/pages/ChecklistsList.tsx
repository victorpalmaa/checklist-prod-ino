import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { RunStatus } from "@/types/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RunStatusBadge } from "@/components/status/RunStatus";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RunRow = Database["public"]["Tables"]["checklist_runs"]["Row"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS: RunStatus[] = ["draft", "submitted", "signed", "voided"];
const STATUS_LABELS: Record<RunStatus, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  signed: "Assinado",
  voided: "Anulado",
};

function formatDatePtBr(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

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
    });
  } catch {
    return iso;
  }
}

function escapePostgrestValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function ChecklistsList() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") as RunStatus | null;
  const pageParam = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [qDraft, setQDraft] = useState(qParam);
  const [debouncedQ, setDebouncedQ] = useState(qParam);

  useEffect(() => {
    setQDraft(qParam);
    setDebouncedQ(qParam);
  }, [qParam]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const draftTrim = qDraft.trim();
        if (draftTrim) {
          next.set("q", draftTrim);
        } else {
          next.delete("q");
        }
        next.set("page", "1");
        return next;
      });
      setDebouncedQ(qDraft);
    }, 400);
    return () => clearTimeout(t);
  }, [qDraft, setSearchParams]);

  const q = debouncedQ.trim();
  const status = statusParam;
  const page = pageParam;

  const runsQuery = useQuery({
    queryKey: ["checklist-runs", q, status, page] as const,
    queryFn: async () => {
      let builder = supabase
        .from("checklist_runs")
        .select(
          "id, product_name, client, batch_number, production_date, status, created_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (q) {
        const escaped = escapePostgrestValue(q);
        builder = builder.or(
          `product_name.ilike.%${escaped}%,client.ilike.%${escaped}%,batch_number.ilike.%${escaped}%`
        );
      }
      if (status) {
        builder = builder.eq("status", status);
      }
      builder = builder.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, count, error } = await builder;
      if (error) {
        toast.error("Não foi possível carregar a lista de checklists.");
        throw error;
      }
      return { data: (data ?? []) as RunRow[], count: count ?? 0 };
    },
    enabled: !auth.loading && !!auth.session,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const totalPages = runsQuery.data
    ? Math.max(1, Math.ceil(runsQuery.data.count / PAGE_SIZE))
    : 1;

  const hasAnyFilter = !!q || !!status;

  const onStatusChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") {
        next.set("status", value);
      } else {
        next.delete("status");
      }
      next.set("page", "1");
      return next;
    });
  };

  const clearFilters = () => {
    setSearchParams({});
    setQDraft("");
    setDebouncedQ("");
  };

  const goToPage = (p: number) => {
    const target = Math.min(Math.max(1, p), totalPages);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(target));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display">Checklists</h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Registros de produção da Pronutrition.
          </p>
        </div>
        <Button asChild>
          <Link to="/checklists/novo">Novo checklist</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Buscar por produto, cliente ou lote…"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
          />
        </div>
        <div className="sm:w-[220px]">
          <Select
            value={status ?? "all"}
            onValueChange={onStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {runsQuery.isLoading && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-body text-[var(--color-fg-secondary)]">
          Carregando registros…
        </div>
      )}

      {runsQuery.isError && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-6 text-body text-[var(--color-danger-text)]">
          Erro ao carregar a lista. Tente novamente.
        </div>
      )}

      {runsQuery.isSuccess && runsQuery.data.data.length === 0 && !hasAnyFilter && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum checklist registrado
          </p>
          <Button variant="outline" asChild>
            <Link to="/checklists/novo">Criar primeiro checklist</Link>
          </Button>
        </div>
      )}

      {runsQuery.isSuccess && runsQuery.data.data.length === 0 && hasAnyFilter && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum resultado para os filtros aplicados
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

      {runsQuery.isSuccess && runsQuery.data.data.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Produção</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsQuery.data.data.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/checklists/${run.id}`)}
                >
                  <TableCell className="font-medium">{run.product_name}</TableCell>
                  <TableCell>{run.client}</TableCell>
                  <TableCell>{run.batch_number ?? "—"}</TableCell>
                  <TableCell>{formatDatePtBr(run.production_date)}</TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-[var(--color-fg-secondary)]">
                    {formatDateTimePtBr(run.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] px-4 py-3">
            <p className="text-caption text-[var(--color-fg-secondary)]">
              Página {page} de {totalPages} · Total de {runsQuery.data.count} registro(s)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
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
