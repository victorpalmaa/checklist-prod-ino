import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, FilePlus2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { Database } from "@/types/database";
import {
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPE_ORDER,
  TEMPLATE_STATUS_LABEL,
} from "@/lib/products";
import type { ProductType, TemplateStatus } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TemplateRow = Database["public"]["Tables"]["form_templates"]["Row"];

type TemplateWithCounts = TemplateRow & {
  sections_count: number;
  fields_count: number;
};

const STATUS_STYLE: Record<TemplateStatus, string> = {
  published:
    "border-[var(--color-success-border)] bg-[var(--color-success-tint)] text-[var(--color-success-text)]",
  draft:
    "border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]",
  archived:
    "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-fg-muted)]",
};

function formatDatePtBr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Normaliza a exibição da revisão. Os seeds antigos de Pó e Gel
 * gravaram "06" sem prefixo; os novos usam "REV. 07". A linha antiga é
 * archived e o trigger de imutabilidade impede corrigir no banco, então
 * a normalização acontece só na exibição.
 */
function formatRevision(revision: string): string {
  const r = revision.trim();
  if (/^rev\.?\s/i.test(r)) return r;
  return `REV. ${r}`;
}

export function AdminTemplates() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = auth.profile?.role === "admin";
  const [openFormFor, setOpenFormFor] = useState<ProductType | null>(null);
  const [revisionInput, setRevisionInput] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["admin-templates"] as const,
    queryFn: async (): Promise<TemplateWithCounts[]> => {
      const { data: templates, error: tErr } = await supabase
        .from("form_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (tErr) throw tErr;

      const { data: sections, error: sErr } = await supabase
        .from("form_sections")
        .select("id, template_id");
      if (sErr) throw sErr;

      const { data: fields, error: fErr } = await supabase
        .from("form_fields")
        .select("id, section_id");
      if (fErr) throw fErr;

      const sectionToTemplate = new Map<string, string>();
      const sectionsByTemplate = new Map<string, number>();
      for (const s of sections ?? []) {
        sectionToTemplate.set(s.id, s.template_id);
        sectionsByTemplate.set(
          s.template_id,
          (sectionsByTemplate.get(s.template_id) ?? 0) + 1,
        );
      }

      const fieldsByTemplate = new Map<string, number>();
      for (const f of fields ?? []) {
        const templateId = sectionToTemplate.get(f.section_id);
        if (!templateId) continue;
        fieldsByTemplate.set(
          templateId,
          (fieldsByTemplate.get(templateId) ?? 0) + 1,
        );
      }

      return (templates ?? []).map((t) => ({
        ...t,
        sections_count: sectionsByTemplate.get(t.id) ?? 0,
        fields_count: fieldsByTemplate.get(t.id) ?? 0,
      }));
    },
    enabled: !auth.loading && !!auth.session && isAdmin,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const grouped = useMemo(() => {
    const list = templatesQuery.data ?? [];
    return PRODUCT_TYPE_ORDER.map((pt) => {
      const items = list.filter((t) => t.product_type === pt);
      return {
        productType: pt,
        published: items.find((t) => t.status === "published") ?? null,
        draft: items.find((t) => t.status === "draft") ?? null,
        items,
      };
    });
  }, [templatesQuery.data]);

  const cloneMutation = useMutation({
    mutationFn: async ({
      sourceId,
      newRevision,
    }: {
      sourceId: string;
      newRevision: string;
    }) => {
      // RPC não tipada em database.ts (mesmo padrão de AdminUsers).
      const rpcClient = supabase as unknown as {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await rpcClient.rpc("clone_template_revision", {
        p_source_template_id: sourceId,
        p_new_revision: newRevision,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
      setOpenFormFor(null);
      setRevisionInput("");
      toast.success("Rascunho criado.");
      if (typeof newId === "string" && newId) {
        navigate(`/admin/templates/${newId}`);
      }
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const startNewRevision = (pt: ProductType) => {
    setOpenFormFor(pt);
    setRevisionInput("");
  };

  const confirmNewRevision = (sourceId: string) => {
    const rev = revisionInput.trim();
    if (!rev) {
      toast.error("Informe o número da nova revisão.");
      return;
    }
    cloneMutation.mutate({ sourceId, newRevision: rev });
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
            A administração de templates define o conteúdo dos checklists de
            produção e só pode ser acessada por administradores.
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
      <div className="space-y-1">
        <h1 className="text-display">Templates</h1>
        <p className="text-body text-[var(--color-fg-secondary)]">
          Revisões do RED-029 por tipo de produto. Templates publicados são
          somente leitura — alterações exigem uma nova revisão.
        </p>
      </div>

      {templatesQuery.isLoading && (
        <p className="text-body text-[var(--color-fg-muted)]">Carregando…</p>
      )}

      {templatesQuery.isError && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-4">
          <p className="text-body text-[var(--color-danger-text)]">
            {mapSupabaseError(templatesQuery.error)}
          </p>
        </div>
      )}

      {!templatesQuery.isLoading &&
        !templatesQuery.isError &&
        grouped.map((group) => {
          const cloneSource = group.published ?? group.items[0] ?? null;
          const canCreate = !group.draft && !!cloneSource;
          return (
            <section
              key={group.productType}
              className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)]"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
                <h2 className="text-heading">
                  {PRODUCT_TYPE_LABEL[group.productType]}
                </h2>
                {canCreate && cloneSource && (
                  <Button
                    variant="outline"
                    onClick={() => startNewRevision(group.productType)}
                    disabled={cloneMutation.isPending}
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Nova revisão
                  </Button>
                )}
                {group.draft && (
                  <span className="text-caption text-[var(--color-fg-muted)]">
                    Rascunho em andamento
                  </span>
                )}
              </header>

              {openFormFor === group.productType && cloneSource && (
                <div className="flex flex-wrap items-end gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3">
                  <div className="space-y-1">
                    <label
                      className="text-label block"
                      htmlFor={`rev-${group.productType}`}
                    >
                      Número da nova revisão
                    </label>
                    <Input
                      id={`rev-${group.productType}`}
                      value={revisionInput}
                      onChange={(e) => setRevisionInput(e.target.value)}
                      placeholder="REV. 08"
                      className="w-[200px]"
                    />
                  </div>
                  <Button
                    onClick={() => confirmNewRevision(cloneSource.id)}
                    disabled={cloneMutation.isPending}
                  >
                    {cloneMutation.isPending ? "Criando…" : "Criar rascunho"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setOpenFormFor(null)}
                    disabled={cloneMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <p className="text-caption w-full text-[var(--color-fg-muted)]">
                    Copia {cloneSource.sections_count} seções e{" "}
                    {cloneSource.fields_count} campos de{" "}
                    {formatRevision(cloneSource.revision)}.
                  </p>
                </div>
              )}

              {group.items.length === 0 ? (
                <p className="text-body px-4 py-4 text-[var(--color-fg-muted)]">
                  Nenhuma revisão cadastrada para este tipo de produto.
                </p>
              ) : (
                <ul>
                  {group.items.map((t) => (
                    <li
                      key={t.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/templates/${t.id}`)}
                        className="flex min-h-[44px] w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                      >
                        <span className="text-body font-medium">
                          {formatRevision(t.revision)}
                        </span>
                        <span
                          className={`text-caption rounded-[6px] border px-2 py-0.5 ${STATUS_STYLE[t.status]}`}
                        >
                          {TEMPLATE_STATUS_LABEL[t.status]}
                        </span>
                        <span className="text-caption text-[var(--color-fg-muted)]">
                          {t.sections_count} seções · {t.fields_count} campos
                        </span>
                        <span className="text-caption text-[var(--color-fg-muted)]">
                          {t.status === "published"
                            ? `Publicado em ${formatDatePtBr(t.published_at)}`
                            : `Criado em ${formatDatePtBr(t.created_at)}`}
                        </span>
                        <ChevronRight
                          className="ml-auto h-4 w-4 shrink-0 text-[var(--color-fg-muted)]"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
