import type { Database } from "@/types/database";

export type RunStatusValue =
  Database["public"]["Enums"]["run_status"];

export const RUN_STATUS_LABEL: Record<RunStatusValue, string> = {
  draft: "Rascunho",
  submitted: "Aguardando assinaturas",
  signed: "Assinado",
  voided: "Cancelado",
};
