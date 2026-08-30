import type { RunFormValues } from "@/components/form/dynamic-form-meta";

/**
 * Achata os valores do formulario em "secao.campo" -> valor, para
 * comparacao barata entre dois estados do form.
 */
export function flattenFormValues(
  values: RunFormValues,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const sectionKey of Object.keys(values.sections ?? {})) {
    const fields = values.sections[sectionKey];
    if (!fields) continue;
    for (const fieldKey of Object.keys(fields)) {
      const raw = fields[fieldKey];
      flat[`${sectionKey}.${fieldKey}`] = serializeValue(raw);
    }
  }

  const special = values.special ?? {};
  for (const k of Object.keys(special)) {
    flat[`special.${k}`] = serializeValue(
      (special as Record<string, unknown>)[k] as
        | string
        | number
        | boolean
        | null
        | undefined,
    );
  }

  return flat;
}

function serializeValue(
  v: string | number | boolean | null | undefined,
): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/**
 * Chaves "secao.campo" cujo valor difere entre dois estados.
 *
 * Existe porque performSave envia TODOS os campos, e cada linha de
 * run_values dispara o trigger de auditoria. Num template de 69 campos,
 * autosave sem diff geraria dezenas de milhares de linhas em audit_log
 * por checklist preenchido. Com diff, so o que mudou de fato e gravado.
 */
export function changedKeys(
  previous: Record<string, string>,
  current: Record<string, string>,
): string[] {
  const keys = new Set([
    ...Object.keys(previous),
    ...Object.keys(current),
  ]);
  const changed: string[] = [];
  for (const k of keys) {
    if ((previous[k] ?? "") !== (current[k] ?? "")) changed.push(k);
  }
  return changed;
}

export function hasChanges(
  previous: Record<string, string>,
  current: Record<string, string>,
): boolean {
  return changedKeys(previous, current).length > 0;
}

/**
 * Reduz os valores do formulario apenas as secoes/campos alterados,
 * preservando a forma que performSave espera. special vai inteiro
 * quando qualquer parte dele mudou: sao duas colunas em checklist_runs,
 * gravadas por UPDATE, nao por linha em run_values.
 */
export function pickChangedValues(
  values: RunFormValues,
  changed: readonly string[],
): RunFormValues {
  const sections: RunFormValues["sections"] = {};
  let specialChanged = false;

  for (const key of changed) {
    const dot = key.indexOf(".");
    if (dot < 0) continue;
    const head = key.slice(0, dot);
    const tail = key.slice(dot + 1);

    if (head === "special") {
      specialChanged = true;
      continue;
    }
    const bucket = values.sections?.[head];
    if (!bucket || !(tail in bucket)) continue;
    sections[head] = { ...(sections[head] ?? {}), [tail]: bucket[tail] };
  }

  return {
    special: specialChanged
      ? values.special
      : { batch_number: null, production_date: null },
    sections,
  } as RunFormValues;
}
