import type { Database } from "@/types/database";

export type FieldType = Database["public"]["Enums"]["field_type"];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
  radio: "Escolha única",
  select: "Lista suspensa",
  checkbox: "Caixa de seleção",
  computed_avg: "Média calculada",
};

export const FIELD_TYPE_ORDER: readonly FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "radio",
  "select",
  "checkbox",
  "computed_avg",
] as const;

/** Tipos que exigem options nao vazio (constraint
 * form_fields_options_required_for_enum_types). O banco rejeita INSERT
 * sem options nesses tipos: nao existe caminho de INSERT vazio seguido
 * de UPDATE. */
export const TYPES_REQUIRING_OPTIONS: readonly FieldType[] = [
  "radio",
  "select",
] as const;

export function requiresOptions(t: FieldType): boolean {
  return TYPES_REQUIRING_OPTIONS.includes(t);
}

/** Tipos que podem ser alvo de visible_if. Um campo condicional se
 * ancora no valor de outro campo; so faz sentido em campos de valor
 * fechado e previsivel. */
export function canBeVisibleIfSource(t: FieldType): boolean {
  return t === "radio" || t === "select";
}

/**
 * Gera a chave tecnica a partir do rotulo, no mesmo padrao dos seeds:
 * minusculas, sem acento, underscore no lugar de separador.
 * "Cápsula vazia conforme?" -> "capsula_vazia_conforme"
 */
export function slugifyKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function isValidKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key) && key.length <= 60;
}

export type FieldDraft = {
  key: string;
  label: string;
  field_type: FieldType;
  unit: string;
  required: boolean;
  help_text: string;
  sort_order: number;
  options: string[];
  visible_if: { field: string; equals: string } | null;
};

export function emptyFieldDraft(nextSortOrder: number): FieldDraft {
  return {
    key: "",
    label: "",
    field_type: "text",
    unit: "",
    required: false,
    help_text: "",
    sort_order: nextSortOrder,
    options: [],
    visible_if: null,
  };
}

/**
 * Valida o rascunho de campo ANTES de tocar o banco. Cada regra aqui
 * espelha uma constraint ou indice unico real: falhar no client evita
 * rollback e mensagem crua do Postgres.
 */
export function validateFieldDraft(
  draft: FieldDraft,
  existingKeysInSection: readonly string[],
): string | null {
  const label = draft.label.trim();
  if (!label) return "Informe o rótulo do campo.";

  const key = draft.key.trim();
  if (!key) return "Informe a chave técnica do campo.";
  if (!isValidKey(key)) {
    return "A chave deve começar com letra e conter apenas letras minúsculas, números e underscore.";
  }
  if (existingKeysInSection.includes(key)) {
    return `Já existe um campo com a chave "${key}" nesta seção.`;
  }

  if (requiresOptions(draft.field_type)) {
    const opts = draft.options.map((o) => o.trim()).filter(Boolean);
    if (opts.length === 0) {
      return "Campos de escolha única ou lista precisam de pelo menos uma opção.";
    }
    if (new Set(opts).size !== opts.length) {
      return "Há opções repetidas.";
    }
  }

  if (draft.field_type === "computed_avg") {
    return "Campos de média calculada ainda não podem ser criados por esta tela.";
  }

  if (draft.visible_if) {
    if (!draft.visible_if.field) return "Escolha o campo que controla a visibilidade.";
    if (!draft.visible_if.equals) return "Escolha o valor que torna o campo visível.";
    if (draft.visible_if.field === key) {
      return "Um campo não pode depender de si mesmo.";
    }
  }

  if (!Number.isFinite(draft.sort_order)) return "Ordem inválida.";

  return null;
}

/** Sugere a proxima ordem deixando espaco para insercao no meio sem
 * renumerar a secao inteira. */
export function nextSortOrder(existing: readonly number[]): number {
  if (existing.length === 0) return 10;
  return Math.max(...existing) + 10;
}
