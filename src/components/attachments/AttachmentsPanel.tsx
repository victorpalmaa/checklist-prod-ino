import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapSupabaseError } from "@/lib/errors";
import {
  ACCEPTED_MIME,
  deleteAttachment,
  listAttachments,
  signedUrlFor,
  uploadAttachment,
} from "@/lib/attachments";
import type { AttachmentRow } from "@/lib/attachments";
import type { TemplateSnapshot } from "@/types/form";

type Props = {
  runId: string;
  snapshot: TemplateSnapshot;
  /** Anexar só é permitido em rascunho, e só para o autor: a policy de
   * storage.objects (0022) e a de run_attachments recusam o resto. */
  canEdit: boolean;
  currentUserId: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentThumb({
  row,
  canEdit,
  onDelete,
  deleting,
}: {
  row: AttachmentRow;
  canEdit: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  // Bucket privado: cada thumb resolve sua propria signed URL.
  const urlQuery = useQuery({
    queryKey: ["attachment-url", row.id] as const,
    queryFn: () => signedUrlFor(row.storage_path),
    staleTime: 50 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return (
    <figure className="overflow-hidden rounded-[10px] border border-[var(--color-border)]">
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-surface-subtle)]">
        {urlQuery.data ? (
          <img
            src={urlQuery.data}
            alt={row.file_name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff
            className="h-6 w-6 text-[var(--color-fg-muted)]"
            aria-hidden="true"
          />
        )}
      </div>
      <figcaption className="space-y-1 px-2 py-2">
        <p className="text-caption truncate text-[var(--color-fg-secondary)]">
          {row.file_name}
        </p>
        <p className="text-caption text-[var(--color-fg-muted)]">
          {formatSize(row.size_bytes)}
        </p>
        {canEdit && (
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Remover ${row.file_name}`}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Remover
          </Button>
        )}
      </figcaption>
    </figure>
  );
}

export function AttachmentsPanel({
  runId,
  snapshot,
  canEdit,
  currentUserId,
}: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sectionKey, setSectionKey] = useState("");

  const sections = [...snapshot.sections].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const listQuery = useQuery({
    queryKey: ["run-attachments", runId] as const,
    queryFn: () => listAttachments(runId),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["run-attachments", runId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!currentUserId) throw new Error("Sessão não identificada.");
      if (!sectionKey) throw new Error("Escolha a etapa antes de anexar.");
      return uploadAttachment({
        runId,
        sectionKey,
        file,
        uploadedBy: currentUserId,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Foto anexada.");
    },
    onError: (err) => toast.error(mapSupabaseError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: AttachmentRow) => deleteAttachment(row),
    onSuccess: () => {
      invalidate();
      toast.success("Foto removida.");
    },
    onError: (err) => toast.error(mapSupabaseError(err)),
  });

  const rows = listQuery.data ?? [];
  const bySection = new Map<string, AttachmentRow[]>();
  for (const r of rows) {
    const k = r.section_key ?? "";
    bySection.set(k, [...(bySection.get(k) ?? []), r]);
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5">
      <div className="space-y-1">
        <h2 className="text-heading">Evidências fotográficas</h2>
        <p className="text-caption text-[var(--color-fg-secondary)]">
          As fotos aparecem no PDF ao final da etapa correspondente.
        </p>
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1">
            <Label htmlFor="att-section">Etapa da produção</Label>
            <Select value={sectionKey} onValueChange={setSectionKey}>
              <SelectTrigger id="att-section">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) uploadMutation.mutate(f);
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={!sectionKey || uploadMutation.isPending}
            className="min-h-[44px]"
          >
            <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
            {uploadMutation.isPending ? "Enviando…" : "Anexar foto"}
          </Button>
        </div>
      )}

      {listQuery.isLoading && (
        <p className="text-caption mt-4 text-[var(--color-fg-muted)]">
          Carregando…
        </p>
      )}

      {!listQuery.isLoading && rows.length === 0 && (
        <p className="text-caption mt-4 text-[var(--color-fg-muted)]">
          Nenhuma evidência anexada.
        </p>
      )}

      {sections.map((s) => {
        const items = bySection.get(s.key) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={s.key} className="mt-5">
            <h3 className="text-label">{s.title}</h3>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((row) => (
                <AttachmentThumb
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  deleting={deleteMutation.isPending}
                  onDelete={() => deleteMutation.mutate(row)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
