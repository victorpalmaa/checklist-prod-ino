import { isFieldVisible } from "@/lib/form/visibility";
import type { SnapshotSection } from "@/types/form";
import type { RunFormValues } from "./dynamic-form-meta";

export type SectionProgress = {
  filled: number;
  required: number;
};

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

/**
 * Conta obrigatorios preenchidos numa secao.
 *
 * Campo oculto por visible_if nao entra na conta: exigir preenchimento
 * de algo que o operador nao consegue ver tornaria o formulario
 * impossivel de completar.
 */
export function sectionProgress(
  section: SnapshotSection,
  sectionsData: RunFormValues["sections"],
): SectionProgress {
  const bucket = sectionsData?.[section.key] ?? {};
  let filled = 0;
  let required = 0;

  for (const field of section.fields) {
    if (!field.required) continue;
    if (field.field_type === "computed_avg") continue;
    if (!isFieldVisible(field, section.key, sectionsData ?? {})) continue;
    required += 1;
    if (isFilled(bucket[field.key])) filled += 1;
  }

  return { filled, required };
}

export function totalProgress(
  sections: readonly SnapshotSection[],
  sectionsData: RunFormValues["sections"],
): SectionProgress {
  let filled = 0;
  let required = 0;
  for (const s of sections) {
    const p = sectionProgress(s, sectionsData);
    filled += p.filled;
    required += p.required;
  }
  return { filled, required };
}
