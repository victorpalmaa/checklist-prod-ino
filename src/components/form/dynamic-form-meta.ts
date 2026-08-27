import type { FieldValues } from "react-hook-form";
import type {
  TemplateSnapshot,
  SnapshotField,
  SnapshotSection,
} from "@/types/form";
import type { Tables } from "@/types/database";
import { isFieldVisible } from "@/lib/form/visibility";
export { isFieldVisible };

export const SPECIAL_FIELD_KEYS = ["batch_number", "production_date"] as const;
export type SpecialFieldKey = (typeof SPECIAL_FIELD_KEYS)[number];

export type RunFormValues = FieldValues & {
  special: {
    batch_number: string | null;
    production_date: string | null;
  };
  sections: Record<
    string,
    Record<string, string | number | boolean | null | undefined>
  >;
};

export function sectionFieldKey(sectionKey: string, fieldKey: string) {
  return `sections.${sectionKey}.${fieldKey}`;
}

export function specialFieldKey(fieldKey: SpecialFieldKey) {
  return `special.${fieldKey}`;
}

export function isSpecialKey(key: string): key is SpecialFieldKey {
  return SPECIAL_FIELD_KEYS.includes(key as SpecialFieldKey);
}

export function buildInitialValues(
  snapshot: TemplateSnapshot,
  run: Tables<"checklist_runs">,
  runValues: Tables<"run_values">[],
): RunFormValues {
  const initial: RunFormValues = {
    special: {
      batch_number: run.batch_number ?? null,
      production_date: run.production_date ?? null,
    },
    sections: {},
  };

  for (const section of snapshot.sections) {
    const sectionBucket: Record<string, string | number | boolean | null | undefined> = {};
    for (const field of section.fields) {
      sectionBucket[field.key] = null;
    }
    initial.sections[section.key] = sectionBucket;
  }

  for (const value of runValues) {
    const sec = initial.sections[value.section_key];
    if (!sec) continue;
    if (!(value.field_key in sec)) continue;

    const fMeta = (() => {
      const targetSection = snapshot.sections.find((s) => s.key === value.section_key);
      return targetSection?.fields.find((f) => f.key === value.field_key);
    })();
    const ftype = fMeta?.field_type ?? "text";

    if (ftype === "number" || ftype === "computed_avg") {
      sec[value.field_key] = value.value_num ?? null;
    } else if (ftype === "checkbox") {
      sec[value.field_key] = value.value_bool ?? null;
    } else if (ftype === "date") {
      sec[value.field_key] = value.value_date ?? null;
    } else {
      sec[value.field_key] = value.value_text ?? null;
    }
  }

  return initial;
}

export interface DynamicFormHandle {
  getValues: () => RunFormValues;
  submit: () => Promise<RunFormValues | null>;
}

export interface DynamicFormProps {
  snapshot: TemplateSnapshot;
  initial: RunFormValues;
  readOnly?: boolean;
  onSubmit: (
    values: RunFormValues,
    form: import("react-hook-form").UseFormReturn<RunFormValues>,
  ) => Promise<void> | void;
  actions?: import("react").ReactNode;
}

export function sortedSections(snapshot: TemplateSnapshot): SnapshotSection[] {
  return [...snapshot.sections].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

export function sortedFields(section: SnapshotSection): SnapshotField[] {
  return [...section.fields].sort((a, b) => a.sort_order - b.sort_order);
}
