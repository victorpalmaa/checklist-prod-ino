import { useCallback, useEffect, useRef, useState } from "react";
import type { RunFormValues } from "@/components/form/dynamic-form-meta";
import {
  changedKeys,
  flattenFormValues,
  pickChangedValues,
} from "./autosave";

export type AutosaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error" };

type Options = {
  enabled: boolean;
  /** Snapshot inicial do formulario, para o primeiro diff. */
  initial: RunFormValues;
  /** Le os valores atuais do formulario (ref do DynamicForm). */
  getValues: () => RunFormValues | null;
  /** Grava. skipSpecial e true quando nada em `special` mudou. */
  save: (
    values: RunFormValues,
    opts: { skipSpecial: boolean },
  ) => Promise<boolean>;
  /** Intervalo entre verificacoes, em ms. */
  intervalMs?: number;
};

/**
 * Autosave por diff.
 *
 * A cada intervalo, compara o estado achatado do formulario com o
 * ultimo salvo e grava APENAS o que mudou. performSave envia todos os
 * campos recebidos, e cada linha de run_values dispara o trigger de
 * auditoria: num template de 69 campos, salvar tudo a cada ciclo geraria
 * dezenas de milhares de linhas em audit_log por checklist.
 *
 * O intervalo e propositalmente longo. Autosave aqui e rede de
 * seguranca contra perda de trabalho, nao sincronizacao em tempo real.
 */
export function useAutosave({
  enabled,
  initial,
  getValues,
  save,
  intervalMs = 30_000,
}: Options) {
  // Baseline do diff, montado uma vez na montagem. Sem ele, o primeiro
  // ciclo trataria todo campo ja preenchido como alterado e reenviaria
  // o formulario inteiro.
  const lastSavedRef = useRef<Record<string, string>>(
    flattenFormValues(initial),
  );
  const inFlightRef = useRef(false);
  const [status, setStatus] = useState<AutosaveStatus>({ kind: "idle" });

  const runSave = useCallback(async (): Promise<void> => {
    if (!enabled || inFlightRef.current) return;

    const values = getValues();
    if (!values) return;

    const current = flattenFormValues(values);
    const changed = changedKeys(lastSavedRef.current, current);
    if (changed.length === 0) return;

    const skipSpecial = !changed.some((k) => k.startsWith("special."));
    const payload = pickChangedValues(values, changed);

    inFlightRef.current = true;
    setStatus({ kind: "saving" });
    try {
      const ok = await save(payload, { skipSpecial });
      if (ok) {
        lastSavedRef.current = current;
        setStatus({ kind: "saved", at: new Date() });
      } else {
        setStatus({ kind: "error" });
      }
    } catch {
      setStatus({ kind: "error" });
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, getValues, save]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      void runSave();
    }, intervalMs);
    return () => clearInterval(t);
  }, [enabled, intervalMs, runSave]);

  /** Marca o estado atual como salvo, sem gravar. Usado apos um save
   * manual, para o proximo diff nao reenviar o que ja foi. */
  const markSaved = useCallback(() => {
    const values = getValues();
    if (!values) return;
    lastSavedRef.current = flattenFormValues(values);
    setStatus({ kind: "saved", at: new Date() });
  }, [getValues]);

  return { status, saveNow: runSave, markSaved };
}
