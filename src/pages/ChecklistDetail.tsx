import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { RunStatusBadge } from "@/components/status/RunStatus";
import type { RunStatusValue } from "@/components/status/run-status-meta";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { SignaturePanel } from "@/components/signatures/SignaturePanel";
import {
  CHECKLIST_SIGNATURES_QUERY_KEY,
  type SignatureRow,
} from "@/components/signatures/signature-panel-meta";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import { parseSnapshot, type RunStatus } from "@/types/form";
import type { Tables } from "@/types/database";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function displayValueFromField(
  field: { field_type: string; unit?: string | null },
  rv: Tables<"run_values"> | undefined,
  colSpecial?: string | number | boolean | null,
): string {
  if (field.field_type === "computed_avg") return "—";
  if (colSpecial !== undefined && colSpecial !== null) {
    if (typeof colSpecial === "boolean") return colSpecial ? "Sim" : "Não";
    const s = String(colSpecial);
    if (s.length === 0) return "—";
    return field.unit ? `${s} ${field.unit}` : s;
  }
  if (!rv) return "—";
  if (field.field_type === "number") {
    const v = rv.value_num;
    if (v === null || v === undefined) return "—";
    return field.unit ? `${v} ${field.unit}` : String(v);
  }
  if (field.field_type === "checkbox") {
    return rv.value_bool ? "Sim" : "Não";
  }
  if (field.field_type === "date") {
    return rv.value_date ? formatDate(rv.value_date) : "—";
  }
  return rv.value_text && rv.value_text.length > 0 ? rv.value_text : "—";
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^\w\-.]/g, "_").replace(/_+/g, "_");
}

export function ChecklistDetail() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const auth = useAuth();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");

  async function handleDownloadPdf() {
    if (!runQuery.data || !valuesQuery.data || !signaturesQuery.data) return;
    let snapshotLocal;
    try {
      snapshotLocal = parseSnapshot(runQuery.data.template_snapshot as unknown);
    } catch {
      toast.error("Não foi possível ler o formulário para gerar o PDF.");
      return;
    }
    setPdfLoading(true);
    try {
      const [{ pdf }, { ChecklistPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/ChecklistPdfDocument"),
      ]);
      const run = runQuery.data;
      const blob = await pdf(
        <ChecklistPdfDocument
          run={run}
          snapshot={snapshotLocal}
          values={valuesQuery.data}
          signatures={signaturesQuery.data}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const batchPart = run.batch_number && run.batch_number.length > 0
        ? run.batch_number
        : "sem-lote";
      const idPart = run.id.slice(0, 8);
      const filename = sanitizeFilename(
        `${snapshotLocal.document_code}_${snapshotLocal.revision}_${batchPart}_${idPart}.pdf`,
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setPdfLoading(false);
    }
  }

  const runQuery = useQuery<Tables<"checklist_runs"> | null, Error>({
    queryKey: ["checklist-detail", "run", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_runs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        if (/no rows|not found/i.test(error.message) || error.code === "PGRST116") {
          return null;
        }
        throw error;
      }
      return data;
    },
  });

  const valuesQuery = useQuery<Tables<"run_values">[], Error>({
    queryKey: ["checklist-detail", "values", id],
    enabled: !!id && !!runQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("run_values")
        .select("*")
        .eq("run_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const signaturesQuery = useQuery<SignatureRow[], Error>({
    queryKey: [...CHECKLIST_SIGNATURES_QUERY_KEY, id],
    enabled: !!id && !!runQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("run_signatures")
        .select("*")
        .eq("run_id", id)
        .order("signed_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SignatureRow[];
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Cadeia de correcao. Um run pode apontar para o que ele corrige
  // (supersedes_run_id) e ser apontado por quem o corrigiu. As duas
  // pontas sao lidas aqui para montar a navegacao entre versoes.
  const chainQuery = useQuery({
    queryKey: ["checklist-detail", "chain", id] as const,
    enabled: !!id && !!runQuery.data,
    queryFn: async () => {
      const supersededId = runQuery.data?.supersedes_run_id ?? null;

      const { data: successor, error: sErr } = await supabase
        .from("checklist_runs")
        .select("id, created_at, status")
        .eq("supersedes_run_id", id as string)
        .maybeSingle();
      if (sErr) throw sErr;

      let predecessor: {
        id: string;
        created_at: string;
        status: string;
      } | null = null;
      if (supersededId) {
        const { data: pred, error: pErr } = await supabase
          .from("checklist_runs")
          .select("id, created_at, status")
          .eq("id", supersededId)
          .maybeSingle();
        if (pErr) throw pErr;
        predecessor = pred ?? null;
      }

      return { successor: successor ?? null, predecessor };
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const isLoading =
    runQuery.isLoading || valuesQuery.isLoading || signaturesQuery.isLoading;
  const loadError = runQuery.error || valuesQuery.error || signaturesQuery.error;

  if (!id) {
    return <Navigate to="/checklists" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-caption text-[var(--color-fg-muted)]">Carregando...</span>
      </div>
    );
  }

  if (loadError || !runQuery.data) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-4">
        <div
          className="rounded-[var(--radius-lg)] border p-6"
          style={{
            borderColor: "var(--color-danger-border)",
            backgroundColor: "var(--color-danger-tint)",
            color: "var(--color-danger-text)",
          }}
        >
          <h1 className="text-title">Registro não encontrado</h1>
          <p className="text-caption mt-2">
            {loadError ? mapSupabaseError(loadError) : "Este checklist não existe ou não pode ser exibido."}
          </p>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => navigate("/checklists")} className="min-h-[44px]">
              Voltar para listagem
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const run = runQuery.data;

  let snapshot;
  try {
    snapshot = parseSnapshot(run.template_snapshot as unknown);
  } catch (err) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-4">
        <div
          className="rounded-[var(--radius-lg)] border p-6"
          style={{
            borderColor: "var(--color-danger-border)",
            backgroundColor: "var(--color-danger-tint)",
            color: "var(--color-danger-text)",
          }}
        >
          <h1 className="text-title">Snapshot corrompido</h1>
          <p className="text-caption mt-2">
            {err instanceof Error ? err.message : "Não foi possível ler o formulário."}
          </p>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => navigate("/checklists")} className="min-h-[44px]">
              Voltar para listagem
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const valuesByKey = new Map<string, Tables<"run_values">>();
  for (const rv of valuesQuery.data ?? []) {
    valuesByKey.set(`${rv.section_key}.${rv.field_key}`, rv);
  }

  const sortedSections = [...snapshot.sections].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const status = (run.status ?? "draft") as RunStatus;

  const successor = chainQuery.data?.successor ?? null;
  const predecessor = chainQuery.data?.predecessor ?? null;

  // O front replica as condicoes da RPC apenas para esconder o botao.
  // A autorizacao real e a validacao de 20 caracteres vivem em
  // void_and_supersede_run; forcar a chamada nao contorna nada.
  const canCorrect =
    status === "signed" &&
    !successor &&
    !!auth.profile &&
    (auth.profile.role === "admin" || run.created_by === auth.profile.id);

  const reasonTrimmed = correctionReason.trim();

  const submitCorrection = async () => {
    if (reasonTrimmed.length < 20) return;
    setCorrecting(true);
    try {
      const { data: newId, error } = await supabase.rpc(
        "void_and_supersede_run",
        { p_run_id: run.id, p_reason: reasonTrimmed },
      );
      if (error) throw error;
      if (!newId) throw new Error("RPC não retornou o id da correção.");
      toast.success("Correção emitida.");
      setCorrectOpen(false);
      navigate(`/checklists/${newId}/editar`);
    } catch (err) {
      toast.error(mapSupabaseError(err));
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {successor ? (
        <div
          className="rounded-[var(--radius-lg)] border px-4 py-3"
          style={{
            borderColor: "var(--color-danger-border)",
            backgroundColor: "var(--color-danger-tint)",
            color: "var(--color-danger-text)",
          }}
        >
          <p className="text-body">
            Este registro foi cancelado e substituído por uma correção.
          </p>
          {run.voided_reason ? (
            <p className="text-caption mt-1">
              Justificativa: {run.voided_reason}
            </p>
          ) : null}
          <Link
            to={`/checklists/${successor.id}`}
            className="text-caption mt-2 inline-block underline"
          >
            Ver o registro que o substitui
          </Link>
        </div>
      ) : null}

      {predecessor ? (
        <div
          className="rounded-[var(--radius-lg)] border px-4 py-3"
          style={{
            borderColor: "var(--color-primary-border)",
            backgroundColor: "var(--color-primary-tint)",
            color: "var(--color-primary-text)",
          }}
        >
          <p className="text-body">
            Este registro é uma correção de outro checklist.
          </p>
          <Link
            to={`/checklists/${predecessor.id}`}
            className="text-caption mt-2 inline-block underline"
          >
            Ver o registro original
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-display">{run.product_name}</h1>
          <p className="text-caption text-[var(--color-fg-secondary)]">
            {run.client} · Formulação {run.formulation_code} ·{" "}
            {snapshot.document_code} Rev. {snapshot.revision}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-eyebrow">Lote</dt>
              <dd className="text-[15px] text-[var(--color-fg)] tabular-nums">
                {run.batch_number ?? "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-eyebrow">Produção</dt>
              <dd className="text-[15px] text-[var(--color-fg)] tabular-nums">
                {formatDate(run.production_date)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-eyebrow">Status</dt>
              <dd className="flex flex-wrap items-center gap-2 pt-1">
                <RunStatusBadge status={status as RunStatusValue} />
                {status === "signed" && run.completed_at ? (
                  <span className="text-caption text-[var(--color-fg-secondary)] tabular-nums">
                    Finalizado em {formatDateTime(run.completed_at)}
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-eyebrow">Criado em</dt>
              <dd className="text-[15px] text-[var(--color-fg)] tabular-nums">
                {formatDateTime(run.created_at)}
              </dd>
            </div>
            {run.submitted_at ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-eyebrow">Enviado em</dt>
                <dd className="text-[15px] text-[var(--color-fg)] tabular-nums">
                  {formatDateTime(run.submitted_at)}
                </dd>
              </div>
            ) : null}
            {run.completed_at ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-eyebrow">Finalizado em</dt>
                <dd className="text-[15px] text-[var(--color-fg)] tabular-nums">
                  {formatDateTime(run.completed_at)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          {run.accompaniment_reason ? (
            <div
              className="rounded-[10px] border px-4 py-2.5 text-[13px] leading-relaxed"
              style={{
                backgroundColor: "var(--color-primary-tint)",
                borderColor: "var(--color-primary-border)",
                color: "var(--color-primary-text)",
              }}
            >
              <span className="text-eyebrow">Motivo</span>
              <div className="mt-1">{run.accompaniment_reason}</div>
            </div>
          ) : null}
          <Button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="min-h-[44px]"
            variant="secondary"
          >
            {pdfLoading ? "Gerando..." : "Baixar PDF"}
          </Button>
          {status === "draft" ? (
            <Button
              onClick={() => navigate(`/checklists/${run.id}/editar`)}
              className="min-h-[44px]"
            >
              Editar
            </Button>
          ) : null}
          {canCorrect ? (
            <Button
              onClick={() => {
                setCorrectionReason("");
                setCorrectOpen(true);
              }}
              className="min-h-[44px]"
              variant="outline"
            >
              Emitir correção
            </Button>
          ) : null}
        </div>
      </div>

      {sortedSections.map((sec) => {
        const sortedFields = [...sec.fields].sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={sec.key}>
            <CardHeader>
              <CardTitle>{sec.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
              {sortedFields.map((field) => {
                let specialVal: string | number | boolean | undefined | null = undefined;
                if (field.key === "batch_number") specialVal = run.batch_number;
                if (field.key === "production_date") specialVal = run.production_date;
                const rv = valuesByKey.get(`${sec.key}.${field.key}`);
                const value = displayValueFromField(field, rv, specialVal);
                return (
                  <div key={field.key} className="flex flex-col gap-1">
                    <span className="text-eyebrow">{field.label}</span>
                    <span
                      className="min-h-[44px] w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-[14px] leading-6 text-[var(--color-fg)] whitespace-pre-wrap tabular-nums"
                      style={{ paddingTop: "10px", paddingBottom: "10px" }}
                    >
                      {value}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <AttachmentsPanel
        runId={run.id}
        snapshot={snapshot}
        canEdit={false}
        currentUserId={auth.profile?.id ?? null}
      />
      <SignaturePanel
        runId={id}
        runStatus={status as RunStatusValue}
        signatures={signaturesQuery.data}
      />

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          to="/checklists"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-5 text-[14px] font-medium text-[var(--color-fg-secondary)] duration-150 ease-in-out hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-fg)]"
        >
          Voltar para listagem
        </Link>
      </div>

      <AlertDialog open={correctOpen} onOpenChange={setCorrectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir correção deste registro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span className="block">
                  Este registro será cancelado e um novo será criado em
                  rascunho, com os mesmos valores, para você corrigir e
                  coletar as assinaturas novamente.
                </span>
                <span className="block">
                  O registro original permanece no sistema com a
                  justificativa. Nada é excluído.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1">
            <Textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Descreva o motivo da correção"
              rows={4}
              aria-label="Justificativa da correção"
            />
            <p className="text-caption text-[var(--color-fg-muted)]">
              {reasonTrimmed.length < 20
                ? `Mínimo de 20 caracteres. Faltam ${20 - reasonTrimmed.length}.`
                : `${reasonTrimmed.length} caracteres.`}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={correcting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submitCorrection();
              }}
              disabled={correcting || reasonTrimmed.length < 20}
            >
              {correcting ? "Emitindo…" : "Emitir correção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
