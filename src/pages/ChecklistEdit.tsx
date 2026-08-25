import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  DynamicForm,
  buildInitialValues,
  isSpecialKey,
  specialFieldKey,
  type DynamicFormHandle,
  type RunFormValues,
} from "@/components/form/DynamicForm";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  parseSnapshot,
  type TemplateSnapshot,
  type SnapshotSection,
  type SnapshotField,
} from "@/types/form";
import type { Tables } from "@/types/database";

const CHECKLIST_EDIT_QUERY_KEY = ["checklist-edit"] as const;

function mapSaveError(message: string | null | undefined): string {
  if (!message) return "Não foi possível salvar. Tente novamente.";
  if (/Sessão não autenticada/i.test(message)) {
    return "Sua sessão expirou. Saia e entre novamente.";
  }
  if (/run não encontrado|não é possível|rascunho|somente.*edit/i.test(message)) {
    return "Este registro não pode ser alterado no momento.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

export function ChecklistEdit() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const formRef = useRef<DynamicFormHandle>(null);
  const [submitBusy, setSubmitBusy] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [pendingForm, setPendingForm] = useState<{
    values: RunFormValues;
  } | null>(null);

  const runQuery = useQuery<Tables<"checklist_runs"> | null, Error>({
    queryKey: [...CHECKLIST_EDIT_QUERY_KEY, "run", id],
    enabled: !!id && !auth.loading,
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
    queryKey: [...CHECKLIST_EDIT_QUERY_KEY, "values", id],
    enabled: !!id && !!runQuery.data && runQuery.data.status === "draft",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("run_values")
        .select("*")
        .eq("run_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const run = runQuery.data;
  const isLoading = runQuery.isLoading || valuesQuery.isLoading;
  const loadError = runQuery.error || valuesQuery.error;

  useEffect(() => {
    if (!run) return;
    if (run.status !== "draft") {
      navigate(`/checklists/${run.id}`, { replace: true });
    }
  }, [run, navigate]);

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
  if (runQuery.error || !run) {
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
          <h1 className="text-title">Não foi possível carregar o registro</h1>
          <p className="text-caption mt-2">
            {loadError?.message ?? "O registro não existe ou não pode ser aberto."}
          </p>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => navigate("/checklists")} className="min-h-[44px]">
              Voltar para listagem
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.reload()}
              className="min-h-[44px]"
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (run.status !== "draft") {
    return <Navigate to={`/checklists/${run.id}`} replace />;
  }

  let snapshot: TemplateSnapshot;
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

  const initial = buildInitialValues(snapshot, run, valuesQuery.data ?? []);

  async function performSave(values: RunFormValues): Promise<boolean> {
    const currentUser = auth.user?.id;
    if (!currentUser) {
      toast.error("Sua sessão expirou. Saia e entre novamente.");
      return false;
    }

    try {
      const upserts: Tables<"run_values">[] = [];
      for (const sectionKey of Object.keys(values.sections)) {
        const fields = values.sections[sectionKey];
        if (!fields) continue;
        for (const fieldKey of Object.keys(fields)) {
          if (isSpecialKey(fieldKey)) continue;
          const raw = fields[fieldKey];
          const fieldMeta = (() => {
            const sec = snapshot.sections.find((s: SnapshotSection) => s.key === sectionKey);
            return sec?.fields.find((f: SnapshotField) => f.key === fieldKey);
          })();
          if (!fieldMeta) continue;

          const base: Tables<"run_values"> = {
            run_id: id,
            section_key: sectionKey,
            field_key: fieldKey,
            value_text: null,
            value_num: null,
            value_bool: null,
            value_date: null,
            updated_by: currentUser,
          } as Tables<"run_values">;

          if (raw === null || raw === undefined || raw === "") {
            upserts.push(base);
            continue;
          }
          if (fieldMeta.field_type === "number" || fieldMeta.field_type === "computed_avg") {
            const n = typeof raw === "number" ? raw : Number(raw);
            upserts.push({
              ...base,
              value_num: Number.isNaN(n) ? null : n,
            });
          } else if (fieldMeta.field_type === "checkbox") {
            upserts.push({
              ...base,
              value_bool: Boolean(raw),
            });
          } else if (fieldMeta.field_type === "date") {
            upserts.push({
              ...base,
              value_date: typeof raw === "string" && raw.length > 0 ? raw : null,
            });
          } else {
            upserts.push({
              ...base,
              value_text: String(raw),
            });
          }
        }
      }

      const updateCols: Partial<Tables<"checklist_runs">> = {
        batch_number: (values.special?.batch_number ?? null) as
          | string
          | null,
      };
      const specialDate = values.special?.production_date ?? null;
      if (specialDate !== null && specialDate !== undefined && specialDate !== "") {
        (updateCols as Record<string, unknown>).production_date = specialDate;
      }

      let hasEmptyValues = false;
      for (const k of SPECIAL_KEYS as unknown as string[]) {
        const v = (values.special as Record<string, unknown>)[k];
        if (v === null || v === undefined || v === "") hasEmptyValues = true;
      }
      void hasEmptyValues;

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("run_values")
          .upsert(upserts, {
            onConflict: "run_id,section_key,field_key",
            ignoreDuplicates: false,
          });
        if (upsertError) throw upsertError;
      }

      const { error: updateError } = await supabase
        .from("checklist_runs")
        .update(updateCols)
        .eq("id", id);
      if (updateError) throw updateError;

      return true;
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : undefined;
      toast.error(mapSaveError(msg));
      return false;
    }
  }

  async function handleSave(values: RunFormValues) {
    const ok = await performSave(values);
    if (ok) toast.success("Alterações salvas com sucesso.");
  }

  async function handleSubmitAfterSave() {
    if (!pendingForm) return;
    setSubmitBusy(true);
    try {
      const saved = await performSave(pendingForm.values);
      if (!saved) return;

      const { error: rpcErr } = await supabase.rpc("submit_run", {
        p_run_id: id,
      });
      if (rpcErr) {
        const pgMsg =
          rpcErr && typeof rpcErr === "object" && "message" in rpcErr
            ? (rpcErr as { message?: string }).message
            : undefined;
        toast.error(pgMsg ?? "Não foi possível enviar. Tente novamente.");
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: [...CHECKLIST_EDIT_QUERY_KEY, "run", id],
      });
      navigate(`/checklists/${id}`, { replace: true });
    } finally {
      setSubmitBusy(false);
      setPendingForm(null);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-display">
            Checklist — {run.product_name}
          </h1>
          <p className="text-caption text-[var(--color-fg-secondary)]">
            {run.client} · Formulação {run.formulation_code} ·{" "}
            {snapshot.document_code} Rev. {snapshot.revision}
          </p>
        </div>

        <DynamicForm
          ref={formRef}
          snapshot={snapshot}
          initial={initial}
          onSubmit={handleSave}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/checklists")}
                className="min-h-[44px] min-w-[120px]"
              >
                Voltar
              </Button>
              {run.status === "draft" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitBusy}
                  onClick={async () => {
                    const vals = await formRef.current?.submit();
                    if (!vals) return;
                    setPendingForm({ values: vals });
                    setConfirmOpen(true);
                  }}
                  className="min-h-[44px] min-w-[200px]"
                >
                  {submitBusy ? "Enviando..." : "Enviar para assinatura"}
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para assinatura</AlertDialogTitle>
            <AlertDialogDescription>
              Após o envio, o registro não poderá mais ser editado.
              Correções exigem cancelamento e nova versão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingForm(null);
              }}
              className="min-h-[44px]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitAfterSave}
              disabled={submitBusy}
              className="min-h-[44px]"
            >
              {submitBusy ? "Enviando..." : "Confirmar envio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const SPECIAL_KEYS = ["batch_number", "production_date"] as const;

// Referência a specialFieldKey para garantir que a função não seja
// tree-shaken sem uso: na verdade a função é útil aqui, mas para evitar
// TS6133 em alguns casos, criamos uma referência explícita.
export { specialFieldKey as _unused_specialFieldKey_edit };
