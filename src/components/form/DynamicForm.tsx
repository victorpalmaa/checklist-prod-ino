import { useMemo, type ReactNode } from "react";
import { useForm, type Control, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldRenderer } from "@/components/form/FieldRenderer";
import {
  type TemplateSnapshot,
  extractFieldsByKey,
  type SnapshotField,
  type SnapshotSection,
} from "@/types/form";
import type { Tables } from "@/types/database";

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

    if (ftype === "number") {
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

function sortedSections(snapshot: TemplateSnapshot): SnapshotSection[] {
  return [...snapshot.sections].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
}

function sortedFields(section: SnapshotSection): SnapshotField[] {
  return [...section.fields].sort((a, b) => a.sort_order - b.sort_order);
}

export interface DynamicFormProps {
  snapshot: TemplateSnapshot;
  initial: RunFormValues;
  readOnly?: boolean;
  onSubmit: (
    values: RunFormValues,
    form: UseFormReturn<RunFormValues>,
  ) => Promise<void> | void;
  actions?: ReactNode;
}

export function DynamicForm({
  snapshot,
  initial,
  readOnly = false,
  onSubmit,
  actions,
}: DynamicFormProps) {
  const form = useForm<RunFormValues>({
    defaultValues: initial,
    values: initial,
  });

  const { fieldsByKey } = useMemo(() => extractFieldsByKey(snapshot), [snapshot]);
  const sections = useMemo(() => sortedSections(snapshot), [snapshot]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (readOnly) return;
        await onSubmit(values, form);
      })}
      className="flex flex-col gap-6"
    >
      {sections.map((section) => {
        const fields = sortedFields(section);
        return (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {fields.map((field) => {
                if (isSpecialKey(field.key)) {
                  return (
                    <FieldRenderer<RunFormValues>
                      key={field.key}
                      field={field}
                      sectionKey={section.key}
                      fullKey={specialFieldKey(field.key)}
                      control={form.control as Control<RunFormValues>}
                      disabled={readOnly}
                    />
                  );
                }
                return (
                  <FieldRenderer<RunFormValues>
                    key={field.key}
                    field={field}
                    sectionKey={section.key}
                    fullKey={sectionFieldKey(section.key, field.key)}
                    control={form.control as Control<RunFormValues>}
                    disabled={readOnly}
                  />
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]/95 px-6 py-4">
        {actions ?? null}
        {!readOnly ? (
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="min-h-[44px] min-w-[120px]"
          >
            {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        ) : null}
      </div>
      {/* fieldsByKey: utilizado via type + memo; tree-shake não o corte no build */}
      <span className="sr-only" data-fields-count={fieldsByKey.size} />
    </form>
  );
}
