import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SnapshotField } from "@/types/form";

interface FieldRendererProps<T extends FieldValues> {
  field: SnapshotField;
  sectionKey: string;
  control: Control<T>;
  disabled?: boolean;
  fullKey?: string;
}

function formFieldKey(sectionKey: string, fieldKey: string) {
  return `${sectionKey}.${fieldKey}`;
}

function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

export function FieldRenderer<T extends FieldValues>({
  field,
  sectionKey,
  control,
  disabled = false,
  fullKey,
}: FieldRendererProps<T>) {
  const key = (fullKey ?? formFieldKey(sectionKey, field.key)) as Path<T>;
  const id = `field-${sectionKey}-${field.key}`;
  const unit = field.unit?.trim() ? field.unit.trim() : null;

  if (disabled && field.field_type !== "checkbox") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
          {field.label}
          {field.required ? (
            <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
              *
            </span>
          ) : null}
        </Label>
        <div
          id={id}
          className="min-h-[44px] w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-[14px] text-[var(--color-fg)]"
          style={{ paddingTop: "10px", paddingBottom: "10px" }}
        >
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <span className="tabular-nums">{formatValueForDisplay(f.value)}</span>
            )}
          />
        </div>
      </div>
    );
  }

  switch (field.field_type) {
    case "text": {
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <div className="relative">
            <Controller
              control={control}
              name={key}
              render={({ field: f }) => (
                <Input
                  id={id}
                  type="text"
                  disabled={disabled}
                  {...(unit
                    ? { className: "pr-14" }
                    : undefined)}
                  value={(f.value as string | null | undefined) ?? ""}
                  onChange={(e) => f.onChange(e.target.value || null)}
                  onBlur={f.onBlur}
                />
              )}
            />
            {unit ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[13px] text-[var(--color-fg-muted)]"
                aria-hidden
              >
                {unit}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    case "textarea": {
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <Textarea
                id={id}
                disabled={disabled}
                value={(f.value as string | null | undefined) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                onBlur={f.onBlur}
              />
            )}
          />
        </div>
      );
    }
    case "number": {
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <div className="relative">
            <Controller
              control={control}
              name={key}
              render={({ field: f }) => (
                <Input
                  id={id}
                  type="number"
                  disabled={disabled}
                  step="any"
                  {...(unit
                    ? { className: "pr-14" }
                    : undefined)}
                  value={
                    f.value === null || f.value === undefined || f.value === ""
                      ? ""
                      : String(f.value)
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      f.onChange(null);
                    } else {
                      const n = Number(raw);
                      f.onChange(Number.isNaN(n) ? null : n);
                    }
                  }}
                  onBlur={f.onBlur}
                />
              )}
            />
            {unit ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[13px] text-[var(--color-fg-muted)]"
                aria-hidden
              >
                {unit}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    case "date": {
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <Input
                id={id}
                type="date"
                disabled={disabled}
                value={(f.value as string | null | undefined) ?? ""}
                onChange={(e) => f.onChange(e.target.value || null)}
                onBlur={f.onBlur}
              />
            )}
          />
        </div>
      );
    }
    case "radio": {
      const options = field.options ?? [];
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <RadioGroup
                disabled={disabled}
                value={(f.value as string | null) ?? undefined}
                onValueChange={(v) => f.onChange(v)}
                className="pt-1"
              >
                <div className="flex flex-col gap-2">
                  {options.map((opt) => (
                    <div key={opt} className="flex items-center gap-3 min-h-[44px]">
                      <RadioGroupItem value={opt} id={`${id}-${opt}`} />
                      <Label htmlFor={`${id}-${opt}`} className="cursor-pointer text-[14px] text-[var(--color-fg)]">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            )}
          />
        </div>
      );
    }
    case "select": {
      const options = field.options ?? [];
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <Select
                disabled={disabled}
                value={(f.value as string | null) ?? undefined}
                onValueChange={(v) => f.onChange(v)}
              >
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      );
    }
    case "checkbox": {
      return (
        <div className="flex items-start gap-3 pt-1 min-h-[44px]">
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <Checkbox
                id={id}
                disabled={disabled}
                checked={Boolean(f.value ?? false)}
                onCheckedChange={(v) => f.onChange(v === true)}
              />
            )}
          />
          <Label htmlFor={id} className="cursor-pointer text-sm leading-6 text-[var(--color-fg)]">
            {field.label}
            {field.required ? (
              <span aria-hidden className="ml-1 text-[var(--color-danger-text)]">
                *
              </span>
            ) : null}
          </Label>
        </div>
      );
    }
    case "computed_avg": {
      return (
        <div className="flex flex-col gap-2">
          <Label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
            <span
              aria-hidden
              className="ml-2 text-[11px] font-normal text-[var(--color-fg-muted)]"
            >
              calculado
            </span>
          </Label>
          <div className="relative">
            <Controller
              control={control}
              name={key}
              render={({ field: f }) => {
                const raw = f.value;
                let display = "—";
                if (typeof raw === "number" && !Number.isNaN(raw)) {
                  display = raw.toFixed(4);
                } else if (
                  typeof raw === "string" &&
                  raw.length > 0 &&
                  !Number.isNaN(Number(raw))
                ) {
                  display = Number(raw).toFixed(4);
                }
                return (
                  <Input
                    id={id}
                    type="text"
                    disabled
                    readOnly
                    value={display}
                    {...(unit
                      ? { className: "pr-14 tabular-nums" }
                      : { className: "tabular-nums" })}
                  />
                );
              }}
            />
            {unit ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[13px] text-[var(--color-fg-muted)]"
                aria-hidden
              >
                {unit}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    default: {
      return (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-[var(--color-fg)]">
            {field.label}
          </Label>
          <div
            className="min-h-[44px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-[13px] text-[var(--color-fg-muted)]"
          >
            Tipo de campo não suportado nesta versão.
          </div>
        </div>
      );
    }
  }
}
