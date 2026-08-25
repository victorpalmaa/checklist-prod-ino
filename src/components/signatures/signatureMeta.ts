import type { Database } from "@/types/database";

export type SignatureRole = Database["public"]["Enums"]["signature_role"];

export const SIGNATURE_ROLES_ORDER: readonly SignatureRole[] = [
  "producao",
  "qualidade",
  "inovacao",
  "verificacao_inovacao",
] as const;

export const SIGNATURE_ROLE_LABEL: Record<SignatureRole, string> = {
  producao: "Produção",
  qualidade: "Qualidade",
  inovacao: "Inovação",
  verificacao_inovacao: "Verificação Inovação",
};

// TODO: validar redação da declaração com a área de Qualidade
export const DEFAULT_SIGNATURE_STATEMENT =
  "Declaro conformidade com o RED-029 REV. 06 no âmbito da minha responsabilidade.";

export const STATEMENT_BY_ROLE: Record<SignatureRole, string> = {
  producao: DEFAULT_SIGNATURE_STATEMENT,
  qualidade: DEFAULT_SIGNATURE_STATEMENT,
  inovacao: DEFAULT_SIGNATURE_STATEMENT,
  verificacao_inovacao: DEFAULT_SIGNATURE_STATEMENT,
};
