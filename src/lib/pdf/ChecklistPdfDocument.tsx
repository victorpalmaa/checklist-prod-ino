import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  TemplateSnapshot,
  SnapshotField,
  SnapshotSection,
} from "@/types/form";
import type { Tables } from "@/types/database";
import { SIGNATURE_ROLE_LABEL } from "@/components/signatures/signatureMeta";
import type { SignatureRole } from "@/components/signatures/signatureMeta";
import { isFieldVisible } from "@/lib/form/visibility";

const BRAND = {
  primary: "#6A4DBE",
  identity: "#845AFA",
  white: "#FFFFFF",
  pageBg: "#F7F6FA",
  cardBg: "#FFFFFF",
  border: "#E7E4EF",
  textPrimary: "#1C1826",
  textSecondary: "#55506A",
  textMuted: "#6F6A85",
  red: "#C0392B",
};

type RunData = Pick<
  Tables<"checklist_runs">,
  | "id"
  | "product_name"
  | "client"
  | "formulation_code"
  | "batch_number"
  | "production_date"
  | "status"
  | "created_at"
  | "submitted_at"
  | "completed_at"
  | "accompaniment_reason"
>;

type SignatureData = {
  role: string;
  signed_name: string | null;
  statement: string | null;
  signed_at: string | null;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.pageBg,
    paddingHorizontal: 32,
    paddingVertical: 28,
    fontSize: 11,
    color: BRAND.textPrimary,
    fontFamily: "Helvetica",
  },
  topBar: {
    backgroundColor: BRAND.primary,
    color: BRAND.white,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 18,
  },
  topBarText: {
    color: BRAND.white,
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  logoRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 14,
  },
  logo: {
    width: 64,
    height: 32.6,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: BRAND.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: BRAND.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: BRAND.cardBg,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: BRAND.primary,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    width: 110,
    fontSize: 10,
    color: BRAND.textSecondary,
    fontWeight: "bold",
  },
  infoValue: {
    flex: 1,
    fontSize: 11,
    color: BRAND.textPrimary,
  },
  batchBar: {
    backgroundColor: BRAND.primary,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  batchBarItem: {
    flexDirection: "column",
  },
  batchBarLabel: {
    color: BRAND.white,
    fontSize: 9,
    opacity: 0.85,
    marginBottom: 2,
  },
  batchBarValue: {
    color: BRAND.white,
    fontSize: 13,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: BRAND.primary,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.identity,
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  fieldLabel: {
    width: 180,
    fontSize: 10,
    color: BRAND.textSecondary,
    fontWeight: "bold",
    paddingRight: 10,
  },
  fieldValue: {
    flex: 1,
    fontSize: 11,
    color: BRAND.textPrimary,
  },
  signaturesBlock: {
    marginTop: 18,
  },
  signaturesTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: BRAND.primary,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.identity,
    marginBottom: 12,
  },
  signatureCard: {
    backgroundColor: BRAND.cardBg,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  signatureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  signatureRole: {
    fontSize: 11,
    fontWeight: "bold",
    color: BRAND.identity,
  },
  signatureDate: {
    fontSize: 9,
    color: BRAND.textMuted,
  },
  signatureName: {
    fontSize: 12,
    fontWeight: "bold",
    color: BRAND.textPrimary,
    marginBottom: 4,
  },
  signatureStatement: {
    fontSize: 10,
    color: BRAND.textSecondary,
    fontStyle: "italic",
  },
  signaturePending: {
    fontSize: 10,
    color: BRAND.textMuted,
    fontStyle: "italic",
  },
  watermark: {
    position: "absolute",
    top: "40%",
    left: "-10%",
    width: "120%",
    textAlign: "center",
    fontSize: 80,
    fontWeight: "bold",
    color: BRAND.red,
    opacity: 0.12,
    transform: "rotate(-35deg)",
    letterSpacing: 8,
  },
});

function formatDatePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTimePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} ${d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "—";
  }
}

function formatCurrentDateTime(): string {
  return formatDateTimePtBr(new Date().toISOString());
}

function buildSectionsData(
  snapshot: TemplateSnapshot,
  valuesByKey: Map<string, Tables<"run_values">>,
  run: RunData,
): Record<string, Record<string, string | number | boolean | null | undefined>> {
  const sectionsData: Record<
    string,
    Record<string, string | number | boolean | null | undefined>
  > = {};
  for (const sec of snapshot.sections) {
    const bucket: Record<string, string | number | boolean | null | undefined> =
      {};
    for (const field of sec.fields) {
      if (field.key === "batch_number") {
        bucket[field.key] = run.batch_number ?? null;
        continue;
      }
      if (field.key === "production_date") {
        bucket[field.key] = run.production_date ?? null;
        continue;
      }
      const rv = valuesByKey.get(`${sec.key}.${field.key}`);
      if (!rv) {
        bucket[field.key] = null;
        continue;
      }
      if (field.field_type === "number" || field.field_type === "computed_avg") {
        bucket[field.key] = rv.value_num ?? null;
      } else if (field.field_type === "checkbox") {
        bucket[field.key] = rv.value_bool ?? null;
      } else if (field.field_type === "date") {
        bucket[field.key] = rv.value_date ?? null;
      } else {
        bucket[field.key] = rv.value_text ?? null;
      }
    }
    sectionsData[sec.key] = bucket;
  }
  return sectionsData;
}

function formatFieldValue(
  field: SnapshotField,
  sectionKey: string,
  sectionsData: Record<
    string,
    Record<string, string | number | boolean | null | undefined>
  >,
  fieldsByKey: Map<string, SnapshotField>,
): string {
  const bucket = sectionsData[sectionKey] ?? {};

  if (field.field_type === "computed_avg") {
    const srcKeys = field.computed_from ?? [];
    if (srcKeys.length === 0) return "—";
    const nums: number[] = [];
    for (const k of srcKeys) {
      const srcField = fieldsByKey.get(k);
      if (srcField && !isFieldVisible(srcField, sectionKey, sectionsData)) continue;
      const raw = bucket[k];
      if (typeof raw === "number" && !Number.isNaN(raw)) {
        nums.push(raw);
      } else if (
        typeof raw === "string" &&
        raw.length > 0 &&
        !Number.isNaN(Number(raw))
      ) {
        nums.push(Number(raw));
      }
    }
    if (nums.length === 0) return "—";
    const sum = nums.reduce((acc, n) => acc + n, 0);
    const avg = sum / nums.length;
    const rounded = Math.round(avg * 10000) / 10000;
    return field.unit ? `${rounded} ${field.unit}` : String(rounded);
  }

  const raw = bucket[field.key];
  if (raw === null || raw === undefined) return "—";
  if (typeof raw === "boolean") return raw ? "Sim" : "Não";
  if (field.field_type === "date") {
    return formatDatePtBr(typeof raw === "string" ? raw : String(raw));
  }
  if (typeof raw === "number") {
    return field.unit ? `${raw} ${field.unit}` : String(raw);
  }
  const s = String(raw);
  if (s.length === 0) return "—";
  return field.unit ? `${s} ${field.unit}` : s;
}

export interface ChecklistPdfDocumentProps {
  run: RunData;
  snapshot: TemplateSnapshot;
  values: Tables<"run_values">[];
  signatures: SignatureData[];
}

export function ChecklistPdfDocument({
  run,
  snapshot,
  values,
  signatures,
}: ChecklistPdfDocumentProps) {
  const valuesByKey = new Map<string, Tables<"run_values">>();
  for (const rv of values) {
    valuesByKey.set(`${rv.section_key}.${rv.field_key}`, rv);
  }

  const sectionsData = buildSectionsData(snapshot, valuesByKey, run);

  const fieldsByKey = new Map<string, SnapshotField>();
  for (const sec of snapshot.sections) {
    for (const field of sec.fields) {
      fieldsByKey.set(field.key, field);
    }
  }

  const sortedSections: SnapshotSection[] = [...snapshot.sections].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const showBatchBar =
    (run.batch_number && run.batch_number.length > 0) ||
    run.production_date;

  return (
    <Document
      author="Pronutrition"
      subject={`${snapshot.document_code} ${snapshot.revision}`}
      title={`${snapshot.title} - ${run.product_name}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {run.status !== "signed" ? (
          <View style={styles.watermark} fixed>
            <Text>RASCUNHO</Text>
          </View>
        ) : null}

        <View style={styles.topBar}>
          <Text style={styles.topBarText}>
            {snapshot.document_code} {snapshot.revision}
          </Text>
        </View>

        <View style={styles.logoRow}>
          <Image
            style={styles.logo}
            src="/brand/logo-pronutrition-symbol.png"
          />
        </View>

        <Text style={styles.title}>{snapshot.title}</Text>
        <Text style={styles.subtitle}>Gerado em: {formatCurrentDateTime()}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informações do Produto</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Produto</Text>
            <Text style={styles.infoValue}>{run.product_name ?? "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{run.client ?? "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Formulação</Text>
            <Text style={styles.infoValue}>{run.formulation_code ?? "—"}</Text>
          </View>
          {run.accompaniment_reason ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Motivo</Text>
              <Text style={styles.infoValue}>{run.accompaniment_reason}</Text>
            </View>
          ) : null}
        </View>

        {showBatchBar ? (
          <View style={styles.batchBar}>
            <View style={styles.batchBarItem}>
              <Text style={styles.batchBarLabel}>Lote</Text>
              <Text style={styles.batchBarValue}>
                {run.batch_number && run.batch_number.length > 0
                  ? run.batch_number
                  : "—"}
              </Text>
            </View>
            <View style={styles.batchBarItem}>
              <Text style={styles.batchBarLabel}>Data de Produção</Text>
              <Text style={styles.batchBarValue}>
                {formatDatePtBr(run.production_date)}
              </Text>
            </View>
          </View>
        ) : null}

        {sortedSections.map((sec) => {
          const sortedFields: SnapshotField[] = [...sec.fields].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          const visibleFields = sortedFields.filter((f) =>
            isFieldVisible(f, sec.key, sectionsData),
          );
          if (visibleFields.length === 0) return null;
          return (
            <View key={sec.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              {visibleFields.map((field) => (
                <View key={field.key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue}>
                    {formatFieldValue(
                      field,
                      sec.key,
                      sectionsData,
                      fieldsByKey,
                    )}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.signaturesBlock}>
          <Text style={styles.signaturesTitle}>Assinaturas</Text>
          {signatures.map((sig) => {
            const roleLabel =
              SIGNATURE_ROLE_LABEL[sig.role as SignatureRole] ?? sig.role;
            return (
              <View key={sig.role} style={styles.signatureCard}>
                <View style={styles.signatureHeader}>
                  <Text style={styles.signatureRole}>{roleLabel}</Text>
                  <Text style={styles.signatureDate}>
                    {sig.signed_at ? formatDateTimePtBr(sig.signed_at) : "Pendente"}
                  </Text>
                </View>
                {sig.signed_name ? (
                  <>
                    <Text style={styles.signatureName}>{sig.signed_name}</Text>
                    {sig.statement ? (
                      <Text style={styles.signatureStatement}>
                        “{sig.statement}”
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.signaturePending}>
                    Aguardando assinatura.
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
