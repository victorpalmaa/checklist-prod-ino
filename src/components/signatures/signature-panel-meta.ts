import type { Database } from "@/types/database";

export type SignatureRow =
  Database["public"]["Tables"]["run_signatures"]["Row"];

export const CHECKLIST_SIGNATURES_QUERY_KEY = [
  "checklist-run-signatures",
] as const;
