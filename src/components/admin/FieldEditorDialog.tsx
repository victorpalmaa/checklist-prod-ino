import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_TYPE_LABEL,
  FIELD_TYPE_ORDER,
  requiresOptions,
  slugifyKey,
  validateFieldDraft,
} from "./template-editor-meta";
import type { FieldDraft, FieldType } from "./template-editor-meta";

export type VisibleIfCandidate = {
  key: string;
  label: string;
  options: string[];
};

export type ComputedCandidate = {
  key: string;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = criando campo novo */
  initial: FieldDraft;
  isNew: boolean;
  /** chaves ja usadas na secao, EXCLUINDO a do campo em edicao */
  existingKeys: readonly string[];
  /** campos radio/select da mesma secao, candidatos a controlar visibilidade */
  visibleIfCandidates: readonly VisibleIfCandidate[];
  /** campos numericos da mesma secao, candidatos a origem de media */
  computedCandidates: readonly ComputedCandidate[];
  saving: boolean;
  onSave: (draft: FieldDraft) => void;
};

export function FieldEditorDialog({
  open,
  onOpenChange,
  initial,
  isNew,
  existingKeys,
  visibleIfCandidates,
  computedCandidates,
  saving,
  onSave,
}: Props) {
  // Sem useEffect de sincronizacao: o componente pai passa uma key
  // distinta por campo/abertura, entao o estado nasce de `initial` a
  // cada montagem. Effect que chama setState sincronamente e o
  // antipadrao que a regra react-hooks/set-state-in-effect barra.
  const [draft, setDraft] = useState<FieldDraft>(initial);
  const [keyTouched, setKeyTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<FieldDraft>) =>
    setDraft((d) => ({ ...d, ...p }));

  const onLabelChange = (label: string) => {
    // Ao criar, a chave acompanha o rotulo ate o usuario editar a chave
    // manualmente. Ao editar campo existente, a chave nunca muda sozinha.
    if (!keyTouched && isNew) {
      patch({ label, key: slugifyKey(label) });
    } else {
      patch({ label });
    }
  };

  const onTypeChange = (t: FieldType) => {
    // Trocar para um tipo que nao usa options descarta as options; o
    // inverso comeca com uma opcao vazia para o usuario preencher.
    if (requiresOptions(t)) {
      patch({
        field_type: t,
        options: draft.options.length > 0 ? draft.options : [""],
      });
    } else {
      patch({ field_type: t, options: [] });
    }
  };

  const setOption = (i: number, v: string) => {
    const next = [...draft.options];
    next[i] = v;
    patch({ options: next });
  };

  const addOption = () => patch({ options: [...draft.options, ""] });

  const removeOption = (i: number) =>
    patch({ options: draft.options.filter((_, idx) => idx !== i) });

  const selectedSource = visibleIfCandidates.find(
    (c) => c.key === draft.visible_if?.field,
  );

  const handleSave = () => {
    const cleaned: FieldDraft = {
      ...draft,
      label: draft.label.trim(),
      key: draft.key.trim(),
      unit: draft.unit.trim(),
      help_text: draft.help_text.trim(),
      options: draft.options.map((o) => o.trim()).filter(Boolean),
      computed_from:
        draft.field_type === "computed_avg" ? draft.computed_from : [],
    };
    const err = validateFieldDraft(cleaned, existingKeys);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSave(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo campo" : "Editar campo"}</DialogTitle>
          <DialogDescription>
            Alterações são gravadas apenas neste rascunho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="fe-label">Rótulo</Label>
            <Input
              id="fe-label"
              value={draft.label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Cápsula vazia conforme?"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fe-key">Chave técnica</Label>
            <Input
              id="fe-key"
              value={draft.key}
              onChange={(e) => {
                setKeyTouched(true);
                patch({ key: e.target.value });
              }}
              placeholder="capsula_vazia_conforme"
              disabled={!isNew}
            />
            <p className="text-caption text-[var(--color-fg-muted)]">
              {isNew
                ? "Gerada a partir do rótulo. Use letras minúsculas, números e underscore."
                : "A chave não pode ser alterada: valores já preenchidos dependem dela."}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fe-type">Tipo</Label>
            <Select
              value={draft.field_type}
              onValueChange={(v) => onTypeChange(v as FieldType)}
            >
              <SelectTrigger id="fe-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresOptions(draft.field_type) && (
            <div className="space-y-2 rounded-[10px] border border-[var(--color-border)] p-3">
              <Label>Opções</Label>
              {draft.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={i === 0 ? "Sim" : "Não"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeOption(i)}
                    aria-label={`Remover opção ${i + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addOption}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Adicionar opção
              </Button>
              <p className="text-caption text-[var(--color-fg-muted)]">
                Obrigatório para escolha única e lista suspensa.
              </p>
            </div>
          )}

          {draft.field_type === "computed_avg" && (
            <div className="space-y-2 rounded-[10px] border border-[var(--color-border)] p-3">
              <Label>Campos de origem da média</Label>
              {computedCandidates.length === 0 ? (
                <p className="text-caption text-[var(--color-fg-muted)]">
                  Nenhum campo numérico nesta seção para calcular a média.
                </p>
              ) : (
                computedCandidates.map((c) => {
                  const checked = draft.computed_from.includes(c.key);
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`fe-cf-${c.key}`}
                        checked={checked}
                        onCheckedChange={(v) =>
                          patch({
                            computed_from:
                              v === true
                                ? [...draft.computed_from, c.key]
                                : draft.computed_from.filter(
                                    (k) => k !== c.key,
                                  ),
                          })
                        }
                      />
                      <Label htmlFor={`fe-cf-${c.key}`}>{c.label}</Label>
                    </div>
                  );
                })
              )}
              <p className="text-caption text-[var(--color-fg-muted)]">
                Selecione ao menos dois. O valor é calculado
                automaticamente e não pode ser preenchido à mão.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="fe-unit">Unidade</Label>
              <Input
                id="fe-unit"
                value={draft.unit}
                onChange={(e) => patch({ unit: e.target.value })}
                placeholder="g/cm³, °C, %"
              />
            </div>
            <div className="w-[120px] space-y-1">
              <Label htmlFor="fe-order">Ordem</Label>
              <Input
                id="fe-order"
                type="number"
                value={draft.sort_order}
                onChange={(e) =>
                  patch({ sort_order: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fe-help">Texto de ajuda</Label>
            <Textarea
              id="fe-help"
              value={draft.help_text}
              onChange={(e) => patch({ help_text: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="fe-required"
              checked={draft.required}
              onCheckedChange={(c) => patch({ required: c === true })}
              disabled={draft.field_type === "computed_avg"}
            />
            <Label htmlFor="fe-required">Campo obrigatório</Label>
          </div>

          <div className="space-y-2 rounded-[10px] border border-[var(--color-border)] p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="fe-cond"
                checked={draft.visible_if !== null}
                onCheckedChange={(c) =>
                  patch({
                    visible_if:
                      c === true ? { field: "", equals: "" } : null,
                  })
                }
                disabled={visibleIfCandidates.length === 0}
              />
              <Label htmlFor="fe-cond">Mostrar apenas em certa condição</Label>
            </div>

            {visibleIfCandidates.length === 0 && (
              <p className="text-caption text-[var(--color-fg-muted)]">
                Nenhum campo de escolha única ou lista nesta seção para servir
                de condição.
              </p>
            )}

            {draft.visible_if && (
              <div className="space-y-2">
                <Select
                  value={draft.visible_if.field}
                  onValueChange={(v) =>
                    patch({ visible_if: { field: v, equals: "" } })
                  }
                >
                  <SelectTrigger aria-label="Campo que controla a visibilidade">
                    <SelectValue placeholder="Quando o campo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleIfCandidates.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={draft.visible_if.equals}
                  onValueChange={(v) =>
                    patch({
                      visible_if: {
                        field: draft.visible_if?.field ?? "",
                        equals: v,
                      },
                    })
                  }
                  disabled={!selectedSource}
                >
                  <SelectTrigger aria-label="Valor que torna o campo visível">
                    <SelectValue placeholder="…for igual a" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedSource?.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-[10px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-3">
              <p className="text-body text-[var(--color-danger-text)]">
                {error}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar campo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
