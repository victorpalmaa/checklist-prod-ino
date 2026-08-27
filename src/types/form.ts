import { z } from "zod";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ProductType = Database["public"]["Enums"]["product_type"];
export type RunStatus = Database["public"]["Enums"]["run_status"];
export type FieldType = Database["public"]["Enums"]["field_type"];

const snapshotFieldSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    field_type: z.custom<FieldType>(() => true, {
      message: "field_type inválido",
    }),
    unit: z.string().nullish(),
    required: z.boolean(),
    options: z.array(z.string()).nullish(),
    validation: z.record(z.unknown()).nullish(),
    computed_from: z.array(z.string()).nullish(),
    help_text: z.string().nullish(),
    sort_order: z.number(),
    visible_if: z
      .object({
        field: z.string(),
        equals: z.union([z.string(), z.boolean()]),
      })
      .nullish(),
  })
  .passthrough();

const snapshotSectionSchema = z
  .object({
    key: z.string(),
    title: z.string(),
    sort_order: z.number(),
    fields: z.array(snapshotFieldSchema),
  })
  .passthrough();

const snapshotSchema = z
  .object({
    template_id: z.string().uuid(),
    document_code: z.string(),
    revision: z.string(),
    product_type: z.custom<ProductType>(() => true, {
      message: "product_type inválido",
    }),
    title: z.string(),
    captured_at: z.string(),
    sections: z.array(snapshotSectionSchema),
  })
  .passthrough();

export type SnapshotField = z.infer<typeof snapshotFieldSchema>;
export type SnapshotSection = z.infer<typeof snapshotSectionSchema>;
export type TemplateSnapshot = z.infer<typeof snapshotSchema>;

export function parseSnapshot(raw: unknown): TemplateSnapshot {
  const result = snapshotSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(
      `template_snapshot inválido — dados corrompidos. ${issues}`,
    );
  }
  return result.data;
}

export type FieldValueByKey = Record<string, string | number | boolean | null | undefined>;

export function extractFieldsByKey(snapshot: TemplateSnapshot): {
  fieldsByKey: Map<string, SnapshotField>;
  sectionByFieldKey: Map<string, string>;
} {
  const fieldsByKey = new Map<string, SnapshotField>();
  const sectionByFieldKey = new Map<string, string>();
  for (const sec of snapshot.sections) {
    for (const field of sec.fields) {
      fieldsByKey.set(field.key, field);
      sectionByFieldKey.set(field.key, sec.key);
    }
  }
  return { fieldsByKey, sectionByFieldKey };
}
