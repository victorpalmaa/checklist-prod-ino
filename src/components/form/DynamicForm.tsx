import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldRenderer } from "@/components/form/FieldRenderer";
import {
  sectionProgress,
  totalProgress,
} from "@/components/form/section-progress";
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

function SectionBadge({ filled, required }: { filled: number; required: number }) {
  if (required === 0) return null;
  const done = filled >= required;
  return (
    <span
      className="text-caption shrink-0 rounded-[6px] border px-2 py-0.5"
      style={{
        borderColor: done
          ? "var(--color-success-border)"
          : "var(--color-border-strong)",
        backgroundColor: done
          ? "var(--color-success-tint)"
          : "var(--color-surface-subtle)",
        color: done ? "var(--color-success-text)" : "var(--color-fg-muted)",
      }}
    >
      {filled}/{required}
    </span>
  );
}

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

  // Accordion controlado por estado proprio em vez de <details>: uma
  // secao com erro de validacao precisa abrir sozinha, senao o operador
  // clica em enviar e nao ve o que esta faltando.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const first = sortedSections(snapshot)[0]?.key;
      return first ? { [first]: true } : {};
    },
  );

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const progressBySection = useMemo(() => {
    const map = new Map<string, { filled: number; required: number }>();
    for (const sec of sections) {
      map.set(sec.key, sectionProgress(sec, watchedSections ?? {}));
    }
    return map;
  }, [sections, watchedSections]);

  const overall = useMemo(
    () => totalProgress(sections, watchedSections ?? {}),
    [sections, watchedSections],
  );

  const sectionHasError = (sectionKey: string): boolean => {
    const errs = form.formState.errors?.sections as
      | Record<string, unknown>
      | undefined;
    return !!errs?.[sectionKey];
  };

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
      {!readOnly && overall.required > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-caption text-[var(--color-fg-secondary)]">
              Campos obrigatórios preenchidos
            </span>
            <span className="text-caption tabular-nums text-[var(--color-fg-secondary)]">
              {overall.filled}/{overall.required}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-[6px]"
            style={{ backgroundColor: "var(--color-surface-subtle)" }}
            role="progressbar"
            aria-valuenow={overall.filled}
            aria-valuemin={0}
            aria-valuemax={overall.required}
          >
            <div
              className="h-full duration-150 ease-in-out"
              style={{
                width: `${Math.round((overall.filled / overall.required) * 100)}%`,
                backgroundColor:
                  overall.filled >= overall.required
                    ? "var(--color-success)"
                    : "var(--color-brand)",
              }}
            />
          </div>
        </div>
      ) : null}

      {sections.map((section) => {
        const fields = sortedFields(section);
        const prog = progressBySection.get(section.key) ?? {
          filled: 0,
          required: 0,
        };
        const isOpen =
          readOnly || openSections[section.key] === true || sectionHasError(section.key);
        return (
          <Card key={section.key}>
            <CardHeader className={isOpen ? undefined : "pb-6"}>
              {readOnly ? (
                <CardTitle>{section.title}</CardTitle>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={isOpen}
                  className="flex min-h-[44px] w-full items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[var(--color-fg-muted)] duration-150 ease-in-out ${isOpen ? "" : "-rotate-90"}`}
                    aria-hidden="true"
                  />
                  <CardTitle className="flex-1">{section.title}</CardTitle>
                  <SectionBadge filled={prog.filled} required={prog.required} />
                </button>
              )}
            </CardHeader>
            <CardContent
              className={`grid grid-cols-1 gap-5 lg:grid-cols-2 ${isOpen ? "" : "hidden"}`}
            >
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
