import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

export const ATTACHMENTS_BUCKET = "run-attachments";

/** Espelha allowed_mime_types do bucket (migration 0022). */
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Espelha file_size_limit do bucket: 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export type AttachmentRow = Tables<"run_attachments">;

/**
 * Reduz a foto antes do upload usando canvas nativo, sem dependencia
 * externa. Camera de celular gera arquivos de varios MB; no chao de
 * fabrica, com rede ruim, isso inviabiliza o upload. 1600px no lado
 * maior e resolucao de sobra para evidencia de etiqueta ou equipamento.
 *
 * Se qualquer etapa falhar, devolve o arquivo original: perder a
 * compressao e aceitavel, perder a evidencia nao.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));

    if (scale >= 1 && file.size <= 1_000_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function randomId(): string {
  return crypto.randomUUID();
}

/**
 * Envia o arquivo e registra a linha em run_attachments.
 *
 * O caminho segue "<run_id>/<uuid>.<ext>" porque as policies de
 * storage.objects (0022) leem o primeiro segmento para amarrar o objeto
 * ao run. Mudar essa convencao quebra a autorizacao.
 *
 * Se o INSERT na tabela falhar depois do upload, o arquivo e removido
 * para nao deixar objeto orfao no bucket — nao ha transacao entre
 * Storage e Postgres.
 */
export async function uploadAttachment(input: {
  runId: string;
  sectionKey: string;
  file: File;
  uploadedBy: string;
}): Promise<void> {
  const compressed = await compressImage(input.file);

  if (compressed.size > MAX_UPLOAD_BYTES) {
    throw new Error("A imagem excede 10 MB mesmo após a compressão.");
  }

  const ext = compressed.type === "image/png" ? "png"
    : compressed.type === "image/webp" ? "webp"
    : "jpg";
  const path = `${input.runId}/${randomId()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, compressed, {
      contentType: compressed.type,
      upsert: false,
    });
  if (upErr) throw upErr;

  const { error: rowErr } = await supabase.from("run_attachments").insert({
    run_id: input.runId,
    section_key: input.sectionKey,
    field_key: null,
    storage_path: path,
    file_name: input.file.name,
    mime_type: compressed.type,
    size_bytes: compressed.size,
    uploaded_by: input.uploadedBy,
  });

  if (rowErr) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    throw rowErr;
  }
}

/** Remove a evidencia do registro.
 *
 * Evidencia HERDADA (copied_from_attachment_id preenchido) compartilha o
 * objeto no Storage com um registro ANULADO, que e imutavel. Nesse caso
 * apaga-se apenas o vinculo: o arquivo continua sustentando o registro de
 * origem.
 *
 * Evidencia PROPRIA remove linha e objeto. A linha primeiro: se o Storage
 * falhar, sobra objeto orfao invisivel, o que e melhor que linha apontando
 * para arquivo inexistente. */
export async function deleteAttachment(row: AttachmentRow): Promise<void> {
  const { error } = await supabase
    .from("run_attachments")
    .delete()
    .eq("id", row.id);
  if (error) throw error;

  if (row.copied_from_attachment_id !== null) return;

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove([row.storage_path]);
}

/** Bucket e privado: exibir exige signed URL de curta duracao. */
export async function signedUrlFor(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export type ResolvedAttachment = {
  sectionKey: string;
  url: string;
  fileName: string;
};

/**
 * Resolve as signed URLs de todos os anexos de um run, para uso no PDF.
 * @react-pdf/renderer nao faz chamada assincrona durante a renderizacao,
 * entao as URLs precisam chegar prontas. Elas expiram em 1h, tempo de
 * sobra para a geracao do documento, que leva segundos.
 *
 * Anexos cuja URL falhar sao omitidos: um PDF sem uma foto e melhor que
 * um PDF que nao gera.
 */
export async function resolveAttachmentsForPdf(
  runId: string,
): Promise<ResolvedAttachment[]> {
  const rows = await listAttachments(runId);
  const resolved = await Promise.all(
    rows.map(async (r) => {
      const url = await signedUrlFor(r.storage_path, 3600);
      if (!url || !r.section_key) return null;
      return {
        sectionKey: r.section_key,
        url,
        fileName: r.file_name,
      } satisfies ResolvedAttachment;
    }),
  );
  return resolved.filter((r): r is ResolvedAttachment => r !== null);
}

export async function listAttachments(
  runId: string,
): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("run_attachments")
    .select("*")
    .eq("run_id", runId)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
