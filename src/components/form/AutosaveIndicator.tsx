import { useAutosave } from "@/lib/form/useAutosave";
import type { RunFormValues } from "@/components/form/dynamic-form-meta";

type Props = {
  initial: RunFormValues;
  getValues: () => RunFormValues | null;
  save: (
    values: RunFormValues,
    opts: { skipSpecial: boolean },
  ) => Promise<boolean>;
};

/**
 * Encapsula o autosave num componente proprio.
 *
 * ChecklistEdit tem varios early returns (loading, erro, snapshot
 * corrompido) antes de `initial` existir, entao chamar useAutosave la
 * violaria as Rules of Hooks. Aqui o componente so monta quando os
 * dados ja existem, e o hook e chamado incondicionalmente.
 */
export function AutosaveIndicator({ initial, getValues, save }: Props) {
  const { status } = useAutosave({
    enabled: true,
    initial,
    getValues,
    save,
  });

  const text =
    status.kind === "saving"
      ? "Salvando automaticamente…"
      : status.kind === "saved"
        ? `Salvo automaticamente às ${status.at.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : status.kind === "error"
          ? "Não foi possível salvar automaticamente. Use Salvar e sair."
          : "As alterações são salvas automaticamente a cada 30 segundos.";

  return (
    <p
      className="text-caption"
      style={{
        color:
          status.kind === "error"
            ? "var(--color-danger-text)"
            : "var(--color-fg-muted)",
      }}
      aria-live="polite"
    >
      {text}
    </p>
  );
}
