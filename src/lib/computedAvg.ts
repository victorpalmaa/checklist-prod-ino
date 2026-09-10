import type { SnapshotField } from "@/types/form";
import type { SectionsData } from "@/lib/form/visibility";

export type ComputedAvgResult = {
  value: number | null;
  filled: number;
  total: number;
};

type SectionBucket = Record<
  string,
  string | number | boolean | null | undefined
>;

export function computeAvg(
  computedFrom: readonly string[] | null | undefined,
  sectionKey: string,
  sectionBucket: SectionBucket,
  fieldsByKey: Map<string, SnapshotField>,
  sectionsData: SectionsData,
  isFieldVisible: (
    field: SnapshotField,
    sectionKey: string,
    sectionsData: SectionsData,
  ) => boolean,
): ComputedAvgResult {
  const srcKeys = computedFrom ?? [];
  if (srcKeys.length === 0) {
    return { value: null, filled: 0, total: 0 };
  }

  let total = 0;
  const nums: number[] = [];

  for (const k of srcKeys) {
    const srcField = fieldsByKey.get(k);
    if (srcField && !isFieldVisible(srcField, sectionKey, sectionsData)) {
      continue;
    }
    total++;
    const raw = sectionBucket[k];
    if (typeof raw === "number" && !Number.isNaN(raw)) {
      nums.push(raw);
    } else if (
      typeof raw === "string" &&
      raw.length > 0 &&
      !Number.isNaN(Number(raw))
    ) {
      nums.push(Number(raw));
    }
  }

  if (nums.length === 0) {
    return { value: null, filled: 0, total };
  }

  const sum = nums.reduce((acc, n) => acc + n, 0);
  const avg = sum / nums.length;
  const value = Math.round(avg * 10000) / 10000;

  return { value, filled: nums.length, total };
}
