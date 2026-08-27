import type { SnapshotField } from "@/types/form";

export type SectionsData = Record<
  string,
  Record<string, string | number | boolean | null | undefined>
>;

/**
 * Normaliza qualquer valor de campo para string comparável.
 * Campo checkbox salva boolean, radio/select salva string, number salva
 * number. Sem esta normalização a comparação estrita falha em silêncio
 * quando o tipo de visible_if.equals difere do tipo salvo.
 */
function normalizeForComparison(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim().toLowerCase();
}

export function isFieldVisible(
  field: SnapshotField,
  sectionKey: string,
  sectionsData: SectionsData,
): boolean {
  if (!field.visible_if) return true;
  const sectionBucket = sectionsData[sectionKey] ?? {};
  const currentValue = sectionBucket[field.visible_if.field];
  return (
    normalizeForComparison(currentValue) ===
    normalizeForComparison(field.visible_if.equals)
  );
}
