import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldRenderer } from "@/components/form/FieldRenderer";
import { extractFieldsByKey } from "@/types/form";
import {
  SPECIAL_FIELD_KEYS,
  type SpecialFieldKey,
  type RunFormValues,
  sectionFieldKey,
  specialFieldKey,
  isSpecialKey,
  type DynamicFormHandle,
  type DynamicFormProps,
  sortedSections,
  sortedFields,
  isFieldVisible,
} from "./dynamic-form-meta";

export const DynamicForm = forwardRef<DynamicFormHandle, DynamicFormProps>(
  function DynamicForm(
    {
      snapshot,
      initial,
      readOnly = false,
      onSubmit,
      actions,
    }: DynamicFormProps,
    ref,
  ) {
    const form = useForm<RunFormValues>({
      defaultValues: initial,
      values: initial,
    });

    useImperativeHandle(
      ref,
      () => ({
        getValues: () => form.getValues(),
        submit: async () => {
          const valid = await form.trigger();
          if (!valid) return null;
          return form.getValues();
        },
      }),
      [form],
    );

  const fieldsByKeyMap = useMemo(() => extractFieldsByKey(snapshot), [snapshot]);
  const sections = useMemo(() => sortedSections(snapshot), [snapshot]);
  void SPECIAL_FIELD_KEYS;

  const watchedSections = useWatch({
    control: form.control,
    name: "sections",
    disabled: readOnly,
  });

  useEffect(() => {
    if (readOnly) return;
    const allSectionsData = form.getValues("sections") ?? {};
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.field_type !== "computed_avg") continue;
        if (!isFieldVisible(field, section.key, allSectionsData)) continue;
        const srcKeys = field.computed_from ?? [];
        if (srcKeys.length === 0) continue;
        const sectionBucket = form.getValues(`sections.${section.key}`) ?? {};
        const { fieldsByKey: fb } = fieldsByKeyMap;
        const nums: number[] = [];
        for (const k of srcKeys) {
          const srcField = fb.get(k);
          if (srcField && !isFieldVisible(srcField, section.key, allSectionsData)) continue;
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
        let next: number | null = null;
        if (nums.length > 0) {
          const sum = nums.reduce((acc, n) => acc + n, 0);
          const avg = sum / nums.length;
          next = Math.round(avg * 10000) / 10000;
        }
        const current = sectionBucket[field.key];
        if (current === next) continue;
        if (current === null && next === null) continue;
        if (
          typeof current === "number" &&
          typeof next === "number" &&
          Number.isNaN(current) === Number.isNaN(next) &&
          Math.abs(current - next) < 1e-9
        ) {
          continue;
        }
        form.setValue(`sections.${section.key}.${field.key}`, next, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [watchedSections, sections, form, readOnly, fieldsByKeyMap]);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        if (readOnly) return;
        await onSubmit(values, form);
      })}
      className="flex flex-col gap-6"
      data-dynamic-checklist-form
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
                if (!isFieldVisible(field, section.key, watchedSections ?? {})) return null;
                if (isSpecialKey(field.key)) {
                  return (
                    <FieldRenderer<RunFormValues>
                      key={field.key}
                      field={field}
                      sectionKey={section.key}
                      fullKey={specialFieldKey(field.key as SpecialFieldKey)}
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
      {/* fieldsByKeyMap: utilizado via type + memo; tree-shake não o corte no build */}
      <span className="sr-only" data-fields-count={fieldsByKeyMap.fieldsByKey.size} />
    </form>
  );
  },
);
