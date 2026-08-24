import { supabase } from "@/lib/supabase/client";
import type {
  Database,
  Tables,
  Enums,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";

export async function smoke() {
  // ============================================================
  // TABELAS: selects + atribuições tipadas que quebram se o
  // tipo estiver errado
  // ============================================================
  const { data: runs, error: err1 } = await supabase
    .from("checklist_runs")
    .select("*");
  if (err1) throw err1;
  if (runs && runs[0]) {
    const run: Tables<"checklist_runs"> = runs[0];
    const s: Enums<"run_status"> = run.status;
    const snap = run.template_snapshot;
    const createdAt: string = run.created_at;
    const vn: number | null = run.legacy_id;
    const by: string = run.created_by;
    const voided: string | null = run.voided_reason;
    const supe: string | null = run.supersedes_run_id;
    console.log(s, snap, createdAt, vn, by, voided, supe);
  }

  const { data: vals, error: err2 } = await supabase
    .from("run_values")
    .select("*");
  if (err2) throw err2;
  if (vals && vals[0]) {
    const v: Tables<"run_values"> = vals[0];
    const n: number | null = v.value_num;
    const tb: boolean | null = v.value_bool;
    const td: string | null = v.value_date;
    const tt: string | null = v.value_text;
    const up: string | null = v.updated_by;
    console.log(n, tb, td, tt, up);
  }

  // Tabelas de perfil
  const { data: profs } = await supabase.from("profiles").select("*");
  if (profs && profs[0]) {
    const p: Tables<"profiles"> = profs[0];
    const ar: Enums<"app_role"> = p.role;
    const rc: string | null = p.registration_code;
    const act: boolean = p.active;
    console.log(ar, rc, act);
  }

  // Campos de template
  const { data: fields } = await supabase.from("form_fields").select("*");
  if (fields && fields[0]) {
    const f: Tables<"form_fields"> = fields[0];
    const ft: Enums<"field_type"> = f.field_type;
    const unit: string | null = f.unit;
    const opts = f.options; // Json | null
    const cf = f.computed_from; // Json | null
    console.log(ft, unit, opts, cf);
  }

  // Assinaturas e anexos
  const { data: sigs } = await supabase.from("run_signatures").select("*");
  if (sigs && sigs[0]) {
    const sg: Tables<"run_signatures"> = sigs[0];
    const sr: Enums<"signature_role"> = sg.role;
    const name: string = sg.signed_name;
    console.log(sr, name);
  }
  const { data: atts } = await supabase.from("run_attachments").select("*");
  if (atts && atts[0]) {
    const a: Tables<"run_attachments"> = atts[0];
    const sz: number = a.size_bytes;
    const sk: string | null = a.section_key;
    const fk: string | null = a.field_key;
    console.log(sz, sk, fk);
  }

  // Templates
  const { data: tpls } = await supabase.from("form_templates").select("*");
  if (tpls && tpls[0]) {
    const t: Tables<"form_templates"> = tpls[0];
    const pt: Enums<"product_type"> = t.product_type;
    const ts: Enums<"template_status"> = t.status;
    const pubAt: string | null = t.published_at;
    console.log(pt, ts, pubAt);
  }
  const { data: secs } = await supabase.from("form_sections").select("*");
  if (secs && secs[0]) {
    const s2: Tables<"form_sections"> = secs[0];
    const so: number = s2.sort_order;
    console.log(so);
  }

  // Audit log
  const { data: logs } = await supabase.from("audit_log").select("*");
  if (logs && logs[0]) {
    const lg: Tables<"audit_log"> = logs[0];
    const id: number = lg.id;
    const act: string = lg.action;
    const bef = lg.before;
    const actor: string | null = lg.actor_id;
    console.log(id, act, bef, actor);
  }

  // Insert / Update typecheck (não executa, só valida)
  const runIns: TablesInsert<"checklist_runs"> = {
    template_id: "x",
    template_snapshot: { sections: [] },
    product_name: "P",
    client: "C",
    formulation_code: "FC",
    production_date: "2026-08-24",
    created_by: "u",
  };
  const runUp: TablesUpdate<"checklist_runs"> = { status: "signed" };
  const runValIns: TablesInsert<"run_values"> = {
    run_id: "r",
    section_key: "sk",
    field_key: "fk",
  };
  console.log(runIns, runUp, runValIns);

  // ============================================================
  // RPCs
  // ============================================================
  await supabase.rpc("create_run", {
    p_product_type: "po",
    p_product_name: "Whey 1kg",
    p_client: "Rede A",
    p_formulation_code: "W-001",
    p_production_date: "2026-08-24",
    p_accompaniment_reason: "Lote piloto",
  });
  await supabase.rpc("submit_run", { p_run_id: "r-uuid" });
  await supabase.rpc("sign_run", {
    p_run_id: "r-uuid",
    p_role: "inovacao",
    p_statement: "Declaro ter verificado o checklist.",
  });
  const voided: string = await supabase
    .rpc("void_and_supersede_run", {
      p_run_id: "r-uuid",
      p_reason: "Corrigida a densidade do terceiro ponto de medição.",
    })
    .then((r) => r.data as string);
  console.log(voided);

  // ============================================================
  // VALIDAÇÃO FROXA. Para cada cenário abaixo, @ts-expect-error
  // é aplicado na LINHA QUE SERÁ O ERRO. Se o tipo estiver
  // frouxo e a linha não for erro, a diretiva fica “unused” e o
  // tsc reprova com TS2578 — é exatamente esse o comportamento
  // que queremos confirmar.
  // ============================================================

  // Coluna inexistente em checklist_runs (via tipo explícito, não any)
  if (runs && runs[0]) {
    const row: Tables<"checklist_runs"> = runs[0];
    const _bad: unknown =
      // @ts-expect-error coluna_nao_existe não pertence a checklist_runs Row
      row.coluna_nao_existe;
    void _bad;
  }

  // Enum run_status com valor errado
  // @ts-expect-error valor “cancelado” não pertence a run_status
  const _badStatus: Enums<"run_status"> = "cancelado";

  // RPC sign_run com nome de argumento errado: usar Args tipado diretamente
  {
    type SignArgs = Database["public"]["Functions"]["sign_run"]["Args"];
    const _badSign: SignArgs = {
      // @ts-expect-error propriedade p_run_nao_existe não existe em Args
      p_run_nao_existe: "x",
      p_run_id: "x",
      p_role: "producao",
      p_statement: "abc",
    };
    void _badSign;
  }

  // RPC create_run com enum errado: usar Args tipado diretamente
  {
    type CreateArgs = Database["public"]["Functions"]["create_run"]["Args"];
    const _badCreate: CreateArgs = {
      // @ts-expect-error “tablete” não pertence a product_type
      p_product_type: "tablete",
      p_product_name: "X",
      p_client: "Y",
      p_formulation_code: "Z",
      p_production_date: "2026-08-24",
    };
    void _badCreate;
  }

  // size_bytes de attachment como string
  const attGood: TablesInsert<"run_attachments"> = {
    run_id: "x",
    storage_path: "a/b",
    file_name: "a.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    uploaded_by: "u",
  };
  const attBad: TablesInsert<"run_attachments"> = {
    ...attGood,
    // @ts-expect-error size_bytes é number
    size_bytes: "1k",
  };
  console.log(_badStatus, attBad);
}

void smoke;
