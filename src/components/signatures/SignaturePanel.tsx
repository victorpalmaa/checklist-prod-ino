import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { RunStatusValue } from "@/components/status/run-status-meta";
import {
  SIGNATURE_ROLES_ORDER,
  SIGNATURE_ROLE_LABEL,
  STATEMENT_BY_ROLE,
  type SignatureRole,
} from "./signatureMeta";
import {
  type SignatureRow,
  CHECKLIST_SIGNATURES_QUERY_KEY,
} from "./signature-panel-meta";

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

export function SignaturePanel({
  runId,
  runStatus,
  signatures,
}: {
  runId: string;
  runStatus: RunStatusValue;
  signatures: SignatureRow[] | undefined;
}) {
  const queryClient = useQueryClient();
  const [confirmRole, setConfirmRole] = useState<SignatureRole | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const byRole = useMemo(() => {
    const map = new Map<SignatureRole, SignatureRow>();
    for (const s of signatures ?? []) {
      map.set(s.role, s);
    }
    return map;
  }, [signatures]);

  async function confirmSign() {
    if (!confirmRole) return;
    const statement = STATEMENT_BY_ROLE[confirmRole];
    setBusy(true);
    try {
      const { error } = await supabase.rpc("sign_run", {
        p_run_id: runId,
        p_role: confirmRole,
        p_statement: statement,
      });
      if (error) {
        toast.error(mapSupabaseError(error));
        return;
      }
      toast.success("Assinatura registrada com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...CHECKLIST_SIGNATURES_QUERY_KEY, runId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["checklist-run-detail", "run", runId],
        }),
      ]);
    } finally {
      setBusy(false);
      setConfirmRole(null);
    }
  }

  const activeRole = confirmRole;
  const activeStatement = activeRole ? STATEMENT_BY_ROLE[activeRole] : "";
  const activeLabel = activeRole ? SIGNATURE_ROLE_LABEL[activeRole] : "";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {SIGNATURE_ROLES_ORDER.map((role) => {
            const sig = byRole.get(role);
            const label = SIGNATURE_ROLE_LABEL[role];
            if (sig) {
              return (
                <div
                  key={role}
                  className="flex flex-col gap-2 rounded-[12px] border border-[var(--color-success-border)] bg-[var(--color-success-tint)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="success">{label}</Badge>
                      <span className="text-body font-medium text-[var(--color-success-text)]">
                        Assinado
                      </span>
                    </div>
                    <span className="text-caption text-[var(--color-fg-secondary)]">
                      {formatDateTimePtBr(sig.signed_at)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-body text-[var(--color-fg)]">
                      {sig.signed_name}
                    </div>
                    <div className="text-caption text-[var(--color-fg-secondary)]">
                      {sig.statement}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={role}
                className="flex flex-col gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{label}</Badge>
                    <span
                      className="inline-flex items-center gap-2 text-caption"
                      style={{ color: "var(--color-primary-text)" }}
                    >
                      <span
                        aria-hidden
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ backgroundColor: "var(--color-brand)" }}
                      />
                      Pendente
                    </span>
                  </div>
                  {runStatus === "submitted" ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmRole(role)}
                      className="min-h-[44px] min-w-[120px]"
                    >
                      Assinar
                    </Button>
                  ) : null}
                </div>
                <p className="text-caption text-[var(--color-fg-secondary)]">
                  Aguardando assinatura.
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmRole !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmRole(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assinar como {activeLabel}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-4 pt-2">
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4 text-body text-[var(--color-fg)]">
                  “{activeStatement}”
                </div>
                <p className="text-body text-[var(--color-fg-secondary)]">
                  A assinatura é definitiva e não pode ser removida.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy}
              className="min-h-[44px]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={confirmSign}
              className="min-h-[44px]"
            >
              {busy ? "Assinando..." : "Confirmar assinatura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
