import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Upload, Trash2, Eye, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { Database } from "@/types/database";
import { PRODUCT_TYPE_LABEL, TEMPLATE_STATUS_LABEL } from "@/lib/products";
import type { TemplateStatus } from "@/lib/products";
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
import { Input } from "@/components/ui/input";
import { FieldEditorDialog } from "@/components/admin/FieldEditorDialog";
import type { VisibleIfCandidate } from "@/components/admin/FieldEditorDialog";
import { useTemplateEditor } from "@/components/admin/useTemplateEditor";
import {
  canBeVisibleIfSource,
  emptyFieldDraft,
  nextSortOrder,
  slugifyKey,
} from "@/components/admin/template-editor-meta";
import type { FieldDraft } from "@/components/admin/template-editor-meta";

type TemplateRow = Database["public"]["Tables"]["form_templates"]["Row"];
type SectionRow = Database["public"]["Tables"]["form_sections"]["Row"];
type FieldRow = Database["public"]["Tables"]["form_fields"]["Row"];
type FieldType = Database["public"]["Enums"]["field_type"];

type SectionWithFields = SectionRow & { fields: FieldRow[] };

type TemplateDetail = {
  template: TemplateRow;
  sections: SectionWithFields[];
  currentPublished: TemplateRow | null;
};

const STATUS_STYLE: Record<TemplateStatus, string> = {
  published:
    "border-[var(--color-success-border)] bg-[var(--color-success-tint)] text-[var(--color-success-text)]",
  draft:
    "border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]",
  archived:
    "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-fg-muted)]",
};

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
  radio: "Escolha única",
  select: "Lista suspensa",
  checkbox: "Caixa de seleção",
  computed_avg: "Média calculada",
};

/**
 * options, visible_if e computed_from sao Json no database.ts, nao
 * string[] / objeto tipado. A leitura direta da tabela nao passa pelo
 * Zod do snapshot, entao normalizamos aqui em vez de confiar no shape.
 */
function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

function parseVisibleIf(
  raw: unknown,
): { field: string; equals: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.field !== "string") return null;
  if (typeof o.equals === "string") return { field: o.field, equals: o.equals };
  if (typeof o.equals === "boolean") {
    return { field: o.field, equals: o.equals ? "true" : "false" };
  }
  return null;
}

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

function formatRevision(revision: string): string {
  const r = revision.trim();
  if (/^rev\.?\s/i.test(r)) return r;
  return `REV. ${r}`;
}

export function AdminTemplateDetail() {
  const auth = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const templateId = params.id ?? "";

  const isAdmin = auth.profile?.role === "admin";
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  // nonce e um contador puro, nao Date.now(): serve so para forcar uma
  // key nova a cada abertura do editor, remontando o dialogo para que o
  // estado interno nasca de `initial` sem useEffect de sincronizacao.
  const [editorNonce, setEditorNonce] = useState(0);
  const [editorState, setEditorState] = useState<{
    sectionId: string;
    fieldId: string | null;
    initial: FieldDraft;
    nonce: number;
  } | null>(null);
  const editor = useTemplateEditor(templateId);

  const detailQuery = useQuery({
    queryKey: ["admin-template-detail", templateId] as const,
    queryFn: async (): Promise<TemplateDetail> => {
      const { data: template, error: tErr } = await supabase
        .from("form_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (tErr) throw tErr;

      const { data: sections, error: sErr } = await supabase
        .from("form_sections")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true });
      if (sErr) throw sErr;

      const sectionIds = (sections ?? []).map((s) => s.id);
      let fields: FieldRow[] = [];
      if (sectionIds.length > 0) {
        const { data: fieldRows, error: fErr } = await supabase
          .from("form_fields")
          .select("*")
          .in("section_id", sectionIds)
          .order("sort_order", { ascending: true });
        if (fErr) throw fErr;
        fields = fieldRows ?? [];
      }

      let currentPublished: TemplateRow | null = null;
      if (template.status === "draft") {
        const { data: pub, error: pErr } = await supabase
          .from("form_templates")
          .select("*")
          .eq("product_type", template.product_type)
          .eq("status", "published")
          .maybeSingle();
        if (pErr) throw pErr;
        currentPublished = pub ?? null;
      }

      const sectionsWithFields: SectionWithFields[] = (sections ?? []).map(
        (s) => ({
          ...s,
          fields: fields.filter((f) => f.section_id === s.id),
        }),
      );

      return { template, sections: sectionsWithFields, currentPublished };
    },
    enabled: !auth.loading && !!auth.session && isAdmin && !!templateId,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const rpcClient = supabase as unknown as {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { error } = await rpcClient.rpc("publish_template_revision", {
        p_template_id: templateId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-template-detail", templateId],
      });
      setPublishOpen(false);
      toast.success("Revisão publicada.");
    },
    onError: (err) => {
      setPublishOpen(false);
      toast.error(mapSupabaseError(err));
    },
  });

  const discardMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("form_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
      setDiscardOpen(false);
      toast.success("Rascunho descartado.");
      navigate("/admin/templates");
    },
    onError: (err) => {
      setDiscardOpen(false);
      toast.error(mapSupabaseError(err));
    },
  });

  const openNewField = (
    sectionId: string,
    existingOrders: readonly number[],
  ) => {
    setEditorState({
      sectionId,
      fieldId: null,
      initial: emptyFieldDraft(nextSortOrder(existingOrders)),
      nonce: editorNonce,
    });
    setEditorNonce((n) => n + 1);
  };

  const openEditField = (sectionId: string, field: FieldRow) => {
    setEditorState({
      sectionId,
      fieldId: field.id,
      initial: {
        key: field.key,
        label: field.label,
        field_type: field.field_type,
        unit: field.unit ?? "",
        required: field.required,
        help_text: field.help_text ?? "",
        sort_order: field.sort_order,
        options: parseStringArray(field.options),
        visible_if: parseVisibleIf(field.visible_if),
      },
      nonce: editorNonce,
    });
    setEditorNonce((n) => n + 1);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-8 text-center">
        <ShieldAlert
          className="h-12 w-12 shrink-0 text-[var(--color-danger-text)]"
          aria-hidden="true"
        />
        <h1 className="text-title text-[var(--color-danger-text)]">
          Acesso restrito a administradores
        </h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <p className="text-body text-[var(--color-fg-muted)]">Carregando…</p>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate("/admin/templates")}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-4">
          <p className="text-body text-[var(--color-danger-text)]">
            {detailQuery.error
              ? mapSupabaseError(detailQuery.error)
              : "Template não encontrado."}
          </p>
        </div>
      </div>
    );
  }

  const { template, sections, currentPublished } = detailQuery.data;
  const isDraft = template.status === "draft";
  const totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0);
  const isEmpty = sections.length === 0 || totalFields === 0;
  const busy = publishMutation.isPending || discardMutation.isPending;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/admin/templates")}>
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Templates
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display">
              {formatRevision(template.revision)}
            </h1>
            <span
              className={`text-caption rounded-[6px] border px-2 py-0.5 ${STATUS_STYLE[template.status]}`}
            >
              {TEMPLATE_STATUS_LABEL[template.status]}
            </span>
          </div>
          <p className="text-body text-[var(--color-fg-secondary)]">
            {template.document_code} ·{" "}
            {PRODUCT_TYPE_LABEL[template.product_type]} · {sections.length}{" "}
            seções · {totalFields} campos
          </p>
          <p className="text-caption text-[var(--color-fg-muted)]">
            {template.status === "published"
              ? `Publicado em ${formatDatePtBr(template.published_at)}`
              : `Criado em ${formatDatePtBr(template.created_at)}`}
          </p>
        </div>

        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setDiscardOpen(true)}
              disabled={busy}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Descartar rascunho
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNewSectionTitle("");
                setNewSectionOpen(true);
              }}
              disabled={busy || editor.busy}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nova seção
            </Button>
            <Button onClick={() => setPublishOpen(true)} disabled={isEmpty || busy}>
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              Publicar
            </Button>
          </div>
        )}
      </div>

      {!isDraft && (
        <div
          className="flex items-start gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4"
          role="note"
        >
          <Eye
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-fg-muted)]"
            aria-hidden="true"
          />
          <p className="text-body text-[var(--color-fg-secondary)]">
            Esta revisão é somente leitura. Para alterar campos, crie uma nova
            revisão a partir da tela de templates.
          </p>
        </div>
      )}

      {isDraft && isEmpty && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-4">
          <p className="text-body text-[var(--color-danger-text)]">
            Este rascunho não tem seções ou campos e não pode ser publicado.
          </p>
        </div>
      )}

      {sections.map((section) => (
        <section
          key={section.id}
          className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)]"
        >
          <header className="flex flex-wrap items-baseline gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-heading">{section.title}</h2>
            <span className="text-caption text-[var(--color-fg-muted)]">
              {section.key} · {section.fields.length} campos
            </span>
            {isDraft && (
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    openNewField(
                      section.id,
                      section.fields.map((f) => f.sort_order),
                    )
                  }
                  disabled={editor.busy}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Campo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteSectionId(section.id)}
                  disabled={editor.busy}
                  aria-label={`Excluir seção ${section.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </header>

          {section.fields.length === 0 ? (
            <p className="text-body px-4 py-4 text-[var(--color-fg-muted)]">
              Nenhum campo nesta seção.
            </p>
          ) : (
            <ul>
              {section.fields.map((field) => {
                const options = parseStringArray(field.options);
                const computedFrom = parseStringArray(field.computed_from);
                const visibleIf = parseVisibleIf(field.visible_if);
                return (
                  <li
                    key={field.id}
                    className="space-y-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium">
                        {field.label}
                      </span>
                      {field.required && (
                        <span className="text-caption rounded-[6px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-2 py-0.5 text-[var(--color-primary-text)]">
                          Obrigatório
                        </span>
                      )}
                      <span className="text-caption rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[var(--color-fg-muted)]">
                        {FIELD_TYPE_LABEL[field.field_type]}
                      </span>
                      {field.unit && (
                        <span className="text-caption text-[var(--color-fg-muted)]">
                          {field.unit}
                        </span>
                      )}
                    </div>
                    <p className="text-caption text-[var(--color-fg-muted)]">
                      {field.key}
                    </p>
                    {options.length > 0 && (
                      <p className="text-caption text-[var(--color-fg-secondary)]">
                        Opções: {options.join(" · ")}
                      </p>
                    )}
                    {computedFrom.length > 0 && (
                      <p className="text-caption text-[var(--color-fg-secondary)]">
                        Média de: {computedFrom.join(" · ")}
                      </p>
                    )}
                    {visibleIf && (
                      <p className="text-caption text-[var(--color-primary-text)]">
                        Visível quando {visibleIf.field} = {visibleIf.equals}
                      </p>
                    )}
                    {field.help_text && (
                      <p className="text-caption text-[var(--color-fg-muted)]">
                        {field.help_text}
                      </p>
                    )}
                    {isDraft && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="outline"
                          onClick={() => openEditField(section.id, field)}
                          disabled={editor.busy}
                        >
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setDeleteFieldId(field.id)}
                          disabled={editor.busy}
                          aria-label={`Excluir campo ${field.label}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {editorState && (
        <FieldEditorDialog
          key={`${editorState.fieldId ?? "new"}-${editorState.nonce}`}
          open={true}
          onOpenChange={(o) => {
            if (!o) setEditorState(null);
          }}
          initial={editorState.initial}
          isNew={editorState.fieldId === null}
          existingKeys={(
            sections.find((sec) => sec.id === editorState.sectionId)?.fields ??
            []
          )
            .filter((f) => f.id !== editorState.fieldId)
            .map((f) => f.key)}
          visibleIfCandidates={(
            sections.find((sec) => sec.id === editorState.sectionId)?.fields ??
            []
          )
            .filter(
              (f) =>
                canBeVisibleIfSource(f.field_type) &&
                f.id !== editorState.fieldId,
            )
            .map(
              (f): VisibleIfCandidate => ({
                key: f.key,
                label: f.label,
                options: parseStringArray(f.options),
              }),
            )}
          saving={editor.saveField.isPending}
          onSave={(draft) => {
            editor.saveField.mutate(
              {
                sectionId: editorState.sectionId,
                fieldId: editorState.fieldId,
                draft,
              },
              { onSuccess: () => setEditorState(null) },
            );
          }}
        />
      )}

      <AlertDialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nova seção</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block">
                A chave técnica é gerada a partir do título.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Input
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Processo de Mistura"
              aria-label="Título da seção"
            />
            <p className="text-caption text-[var(--color-fg-muted)]">
              {newSectionTitle.trim()
                ? slugifyKey(newSectionTitle)
                : "chave_gerada_do_titulo"}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editor.createSection.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const title = newSectionTitle.trim();
                const key = slugifyKey(title);
                if (!title || !key) return;
                editor.createSection.mutate(
                  {
                    key,
                    title,
                    sort_order: nextSortOrder(
                      sections.map((sec) => sec.sort_order),
                    ),
                  },
                  { onSuccess: () => setNewSectionOpen(false) },
                );
              }}
              disabled={
                editor.createSection.isPending || !newSectionTitle.trim()
              }
            >
              {editor.createSection.isPending ? "Criando…" : "Criar seção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteSectionId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteSectionId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta seção?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block">
                Todos os campos dentro dela também serão excluídos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editor.deleteSection.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deleteSectionId) return;
                editor.deleteSection.mutate(deleteSectionId, {
                  onSuccess: () => setDeleteSectionId(null),
                });
              }}
              disabled={editor.deleteSection.isPending}
            >
              {editor.deleteSection.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteFieldId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteFieldId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este campo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block">
                {(() => {
                  const target = sections
                    .flatMap((sec) => sec.fields)
                    .find((f) => f.id === deleteFieldId);
                  if (!target) return "Esta ação não pode ser desfeita.";
                  const dependents = sections
                    .flatMap((sec) => sec.fields)
                    .filter(
                      (f) =>
                        parseVisibleIf(f.visible_if)?.field === target.key,
                    );
                  if (dependents.length === 0) {
                    return "Esta ação não pode ser desfeita.";
                  }
                  return `Atenção: ${dependents
                    .map((d) => d.label)
                    .join(", ")} depende deste campo para aparecer e ficará invisível.`;
                })()}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editor.deleteField.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deleteFieldId) return;
                editor.deleteField.mutate(deleteFieldId, {
                  onSuccess: () => setDeleteFieldId(null),
                });
              }}
              disabled={editor.deleteField.isPending}
            >
              {editor.deleteField.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar esta revisão?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span className="block">
                  A partir da publicação, todo novo checklist de{" "}
                  {PRODUCT_TYPE_LABEL[template.product_type]} passará a usar{" "}
                  {formatRevision(template.revision)} — {sections.length} seções
                  e {totalFields} campos.
                </span>
                {currentPublished ? (
                  <span className="block">
                    {formatRevision(currentPublished.revision)} será arquivada.
                    Checklists já preenchidos não são afetados.
                  </span>
                ) : (
                  <span className="block">
                    Não há revisão publicada para este tipo de produto no
                    momento.
                  </span>
                )}
                <span className="block">Publicar não pode ser desfeito.</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                publishMutation.mutate();
              }}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? "Publicando…" : "Publicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              O rascunho {formatRevision(template.revision)} e todas as suas
              seções e campos serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discardMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                discardMutation.mutate();
              }}
              disabled={discardMutation.isPending}
            >
              {discardMutation.isPending ? "Descartando…" : "Descartar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
