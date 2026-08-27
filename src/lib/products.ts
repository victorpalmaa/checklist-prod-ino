import type { Database } from "@/types/database";

export type ProductType = Database["public"]["Enums"]["product_type"];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  po: "Pó",
  capsula: "Cápsula",
  gel: "Gel",
};

export const PRODUCT_TYPE_ORDER: readonly ProductType[] = [
  "po",
  "gel",
  "capsula",
] as const;

export type TemplateStatus = Database["public"]["Enums"]["template_status"];

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};
