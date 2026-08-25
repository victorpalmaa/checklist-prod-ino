import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
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

export function ChecklistsList() {
  const auth = useAuth();
  const navigate = useNavigate();

  const runsQuery = useQuery({
    queryKey: ["checklist-runs"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_runs")
        .select(
          "id, product_name, client, batch_number, production_date, status, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Não foi possível carregar a lista de checklists.");
        throw error;
      }
      return data as RunRow[];
    },
    enabled: !auth.loading && !!auth.session,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

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

      {runsQuery.isSuccess && runsQuery.data.length === 0 && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum checklist registrado
          </p>
          <Button variant="outline" asChild>
            <Link to="/checklists/novo">Criar primeiro checklist</Link>
          </Button>
        </div>
      )}

      {runsQuery.isSuccess && runsQuery.data.length > 0 && (
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
            {runsQuery.data.map((run) => (
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
      )}
    </div>
  );
}
