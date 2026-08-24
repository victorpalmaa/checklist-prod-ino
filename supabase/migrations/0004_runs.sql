-- BLOCO B5 — checklist_runs e run_values
-- RED-029 REV. 06 — Registro preenchido de checklist de produção
-- Task mais crítica do bloco B: imutabilidade de run assinado.
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- TABELA public.checklist_runs
-- Registro preenchido de uma produção. Imutável a partir de 'signed'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checklist_runs (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.form_templates(id),
    template_snapshot jsonb NOT NULL,
    product_name text NOT NULL,
    client text NOT NULL,
    formulation_code text NOT NULL,
    batch_number text,
    accompaniment_reason text,
    production_date date NOT NULL,
    status public.run_status NOT NULL DEFAULT 'draft'::public.run_status,
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    submitted_at timestamptz,
    completed_at timestamptz,
    voided_reason text,
    supersedes_run_id uuid REFERENCES public.checklist_runs(id),
    legacy_id int UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checklist_runs IS
    'Registro de checklist preenchido. Imutável após signed; correção gera nova versão com supersedes_run_id.';

COMMENT ON COLUMN public.checklist_runs.id IS
    'PK UUID do registro de produção.';

COMMENT ON COLUMN public.checklist_runs.template_id IS
    'FK para form_templates. Sem CASCADE: run persiste mesmo se template for apagado.';

COMMENT ON COLUMN public.checklist_runs.template_snapshot IS
    'Cópia integral do template no momento da criação. Garante imutabilidade do layout preenchido.';

COMMENT ON COLUMN public.checklist_runs.product_name IS
    'Nome do produto fabricado. Alvo de busca trigram.';

COMMENT ON COLUMN public.checklist_runs.client IS
    'Cliente / marca da produção. Alvo de busca trigram.';

COMMENT ON COLUMN public.checklist_runs.formulation_code IS
    'Código da formulação. Alvo de busca trigram.';

COMMENT ON COLUMN public.checklist_runs.batch_number IS
    'Número de lote de produção.';

COMMENT ON COLUMN public.checklist_runs.accompaniment_reason IS
    'Motivo do acompanhamento, caso não seja rotina.';

COMMENT ON COLUMN public.checklist_runs.production_date IS
    'Data da produção. Índice DESC para listagem.';

COMMENT ON COLUMN public.checklist_runs.status IS
    'Ciclo de vida: draft / submitted / signed / voided.';

COMMENT ON COLUMN public.checklist_runs.created_by IS
    'Perfil (operador) que preencheu o registro.';

COMMENT ON COLUMN public.checklist_runs.submitted_at IS
    'Data de envio para assinaturas. Não NULL quando status = submitted.';

COMMENT ON COLUMN public.checklist_runs.completed_at IS
    'Data em que a última assinatura foi coletada. Não NULL quando status = signed.';

COMMENT ON COLUMN public.checklist_runs.voided_reason IS
    'Justificativa de cancelamento. Obrigatória (>= 20 chars) quando status = voided.';

COMMENT ON COLUMN public.checklist_runs.supersedes_run_id IS
    'Auto-FK para o run anterior que esta correção substitui.';

COMMENT ON COLUMN public.checklist_runs.legacy_id IS
    'ID de importação do sistema legado. Único.';

COMMENT ON COLUMN public.checklist_runs.created_at IS
    'Data de criação do registro.';

COMMENT ON COLUMN public.checklist_runs.updated_at IS
    'Data da última atualização (trigger touch_updated_at).';

-- ============================================================
-- TABELA public.run_values
-- Valores dos campos preenchidos. Colunas tipadas separadas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.run_values (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.checklist_runs(id) ON DELETE CASCADE,
    section_key text NOT NULL,
    field_key text NOT NULL,
    value_text text,
    value_num numeric(14,4),
    value_bool boolean,
    value_date date,
    updated_by uuid REFERENCES public.profiles(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS run_values_run_section_field_uq
    ON public.run_values (run_id, section_key, field_key);

COMMENT ON TABLE public.run_values IS
    'Valores preenchidos dos campos do checklist. Colunas tipadas separadas em vez de jsonb único.';

COMMENT ON COLUMN public.run_values.id IS
    'PK UUID do valor de campo.';

COMMENT ON COLUMN public.run_values.run_id IS
    'FK para checklist_runs. ON DELETE CASCADE.';

COMMENT ON COLUMN public.run_values.section_key IS
    'Chave estável da seção, espelho de form_sections.key.';

COMMENT ON COLUMN public.run_values.field_key IS
    'Chave estável do campo, espelho de form_fields.key.';

COMMENT ON COLUMN public.run_values.value_text IS
    'Valor para campos text, textarea, radio, select.';

COMMENT ON COLUMN public.run_values.value_num IS
    'Valor numeric(14,4) para number e computed_avg. Permite agregação sem CAST.';

COMMENT ON COLUMN public.run_values.value_bool IS
    'Valor booleano para checkbox.';

COMMENT ON COLUMN public.run_values.value_date IS
    'Valor de data para campos date.';

COMMENT ON COLUMN public.run_values.updated_by IS
    'Perfil que salvou este valor por último.';

COMMENT ON COLUMN public.run_values.updated_at IS
    'Data da última atualização do valor (trigger touch_updated_at).';

-- ============================================================
-- CONSTRAINTS DE INTEGRIDADE
-- ============================================================

-- run_values: no máximo 1 das 4 colunas de valor preenchida (ou todas nulas).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'run_values_single_value_column'
          AND conrelid = 'public.run_values'::regclass
    ) THEN
        ALTER TABLE public.run_values
            ADD CONSTRAINT run_values_single_value_column
            CHECK (
                num_nonnulls(value_text, value_num, value_bool, value_date) <= 1
            );
    END IF;
END $$;

-- checklist_runs: submitted exige submitted_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'checklist_runs_submitted_at_required'
          AND conrelid = 'public.checklist_runs'::regclass
    ) THEN
        ALTER TABLE public.checklist_runs
            ADD CONSTRAINT checklist_runs_submitted_at_required
            CHECK (
                status <> 'submitted'::public.run_status
                OR submitted_at IS NOT NULL
            );
    END IF;
END $$;

-- checklist_runs: signed exige completed_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'checklist_runs_completed_at_required'
          AND conrelid = 'public.checklist_runs'::regclass
    ) THEN
        ALTER TABLE public.checklist_runs
            ADD CONSTRAINT checklist_runs_completed_at_required
            CHECK (
                status <> 'signed'::public.run_status
                OR completed_at IS NOT NULL
            );
    END IF;
END $$;

-- checklist_runs: voided exige voided_reason com pelo menos 20 caracteres
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'checklist_runs_voided_reason_required'
          AND conrelid = 'public.checklist_runs'::regclass
    ) THEN
        ALTER TABLE public.checklist_runs
            ADD CONSTRAINT checklist_runs_voided_reason_required
            CHECK (
                status <> 'voided'::public.run_status
                OR (voided_reason IS NOT NULL AND length(voided_reason) >= 20)
            );
    END IF;
END $$;

-- checklist_runs: run não substitui a si mesmo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'checklist_runs_supersedes_not_self'
          AND conrelid = 'public.checklist_runs'::regclass
    ) THEN
        ALTER TABLE public.checklist_runs
            ADD CONSTRAINT checklist_runs_supersedes_not_self
            CHECK (supersedes_run_id IS NULL OR supersedes_run_id <> id);
    END IF;
END $$;

-- ============================================================
-- ÍNDICES DE CONSULTA
-- ============================================================

CREATE INDEX IF NOT EXISTS checklist_runs_status_idx
    ON public.checklist_runs (status);

CREATE INDEX IF NOT EXISTS checklist_runs_production_date_desc_idx
    ON public.checklist_runs (production_date DESC);

CREATE INDEX IF NOT EXISTS checklist_runs_created_by_idx
    ON public.checklist_runs (created_by);

CREATE INDEX IF NOT EXISTS checklist_runs_template_id_idx
    ON public.checklist_runs (template_id);

CREATE INDEX IF NOT EXISTS checklist_runs_supersedes_run_id_idx
    ON public.checklist_runs (supersedes_run_id);

CREATE INDEX IF NOT EXISTS checklist_runs_product_name_trgm_idx
    ON public.checklist_runs USING gin (product_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS checklist_runs_client_trgm_idx
    ON public.checklist_runs USING gin (client extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS checklist_runs_formulation_code_trgm_idx
    ON public.checklist_runs USING gin (formulation_code extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS run_values_run_id_idx
    ON public.run_values (run_id);

CREATE INDEX IF NOT EXISTS run_values_field_key_idx
    ON public.run_values (field_key);

-- ============================================================
-- TRIGGER: atualização de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checklist_runs_touch_updated_at_trg
    ON public.checklist_runs;
DROP TRIGGER IF EXISTS a2_touch_updated_at_trg
    ON public.checklist_runs;
CREATE TRIGGER a2_touch_updated_at_trg
    BEFORE UPDATE ON public.checklist_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS run_values_touch_updated_at_trg
    ON public.run_values;
DROP TRIGGER IF EXISTS a2_touch_updated_at_trg
    ON public.run_values;
CREATE TRIGGER a2_touch_updated_at_trg
    BEFORE UPDATE ON public.run_values
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- TRIGGER: imutabilidade de run_values (run não-draft)
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_run_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run_status public.run_status;
    target_run_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_run_id := OLD.run_id;
    ELSE
        target_run_id := NEW.run_id;
    END IF;

    SELECT status INTO run_status
    FROM public.checklist_runs
    WHERE id = target_run_id;

    -- Se o run pai não existe mais (NULL), CASCADE de checklist_runs
    -- está em andamento: deixa seguir.
    IF run_status IS NOT NULL AND run_status <> 'draft'::public.run_status THEN
        RAISE EXCEPTION 'Registro não editável: status %.', run_status;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS run_values_enforce_run_draft_trg
    ON public.run_values;
DROP TRIGGER IF EXISTS a1_enforce_run_draft_trg
    ON public.run_values;
CREATE TRIGGER a1_enforce_run_draft_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.run_values
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_run_draft();

-- ============================================================
-- TRIGGER: transição de status de run + imutabilidade de signed/voided
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_run_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Transições de status permitidas
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'draft'::public.run_status     AND NEW.status = 'submitted'::public.run_status)
         OR (OLD.status = 'submitted'::public.run_status AND NEW.status = 'draft'::public.run_status)
         OR (OLD.status = 'submitted'::public.run_status AND NEW.status = 'signed'::public.run_status)
         OR (OLD.status = 'signed'::public.run_status    AND NEW.status = 'voided'::public.run_status)
         OR (OLD.status = 'draft'::public.run_status     AND NEW.status = 'voided'::public.run_status)
         OR (OLD.status = 'submitted'::public.run_status AND NEW.status = 'voided'::public.run_status)
        ) THEN
            RAISE EXCEPTION 'Transição de status inválida: % para %.', OLD.status, NEW.status;
        END IF;
    END IF;

    -- BLOCO A — Registro assinado (OLD.status = 'signed').
    -- A única alteração permitida é a transição para voided com voided_reason.
    IF OLD.status = 'signed'::public.run_status THEN
        IF
            NEW.template_id IS DISTINCT FROM OLD.template_id
            OR NEW.template_snapshot IS DISTINCT FROM OLD.template_snapshot
            OR NEW.product_name IS DISTINCT FROM OLD.product_name
            OR NEW.client IS DISTINCT FROM OLD.client
            OR NEW.formulation_code IS DISTINCT FROM OLD.formulation_code
            OR NEW.batch_number IS DISTINCT FROM OLD.batch_number
            OR NEW.accompaniment_reason IS DISTINCT FROM OLD.accompaniment_reason
            OR NEW.production_date IS DISTINCT FROM OLD.production_date
            OR NEW.created_by IS DISTINCT FROM OLD.created_by
            OR NEW.created_at IS DISTINCT FROM OLD.created_at
            OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
            OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
            OR NEW.supersedes_run_id IS DISTINCT FROM OLD.supersedes_run_id
            OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
        THEN
            RAISE EXCEPTION 'Registro assinado é imutável. Emita uma correção.';
        END IF;
    END IF;

    -- BLOCO B — Registro cancelado (OLD.status = 'voided').
    -- Congelado por completo. Nenhum UPDATE muda nada.
    IF OLD.status = 'voided'::public.run_status THEN
        IF
            NEW.template_id IS DISTINCT FROM OLD.template_id
            OR NEW.template_snapshot IS DISTINCT FROM OLD.template_snapshot
            OR NEW.product_name IS DISTINCT FROM OLD.product_name
            OR NEW.client IS DISTINCT FROM OLD.client
            OR NEW.formulation_code IS DISTINCT FROM OLD.formulation_code
            OR NEW.batch_number IS DISTINCT FROM OLD.batch_number
            OR NEW.accompaniment_reason IS DISTINCT FROM OLD.accompaniment_reason
            OR NEW.production_date IS DISTINCT FROM OLD.production_date
            OR NEW.created_by IS DISTINCT FROM OLD.created_by
            OR NEW.created_at IS DISTINCT FROM OLD.created_at
            OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
            OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
            OR NEW.supersedes_run_id IS DISTINCT FROM OLD.supersedes_run_id
            OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
            OR NEW.status IS DISTINCT FROM OLD.status
            OR NEW.voided_reason IS DISTINCT FROM OLD.voided_reason
        THEN
            RAISE EXCEPTION 'Registro cancelado é imutável.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checklist_runs_enforce_run_transition_trg
    ON public.checklist_runs;
DROP TRIGGER IF EXISTS a1_enforce_run_transition_trg
    ON public.checklist_runs;
CREATE TRIGGER a1_enforce_run_transition_trg
    BEFORE UPDATE ON public.checklist_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_run_transition();

-- DELETE em checklist_runs é proibido para qualquer status.
CREATE OR REPLACE FUNCTION public.prevent_checklist_run_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Registros de checklist não podem ser excluídos.';
END;
$$;

DROP TRIGGER IF EXISTS checklist_runs_prevent_delete_trg
    ON public.checklist_runs;
CREATE TRIGGER checklist_runs_prevent_delete_trg
    BEFORE DELETE ON public.checklist_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_checklist_run_delete();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.checklist_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_values ENABLE ROW LEVEL SECURITY;

-- ---------- checklist_runs ----------

DROP POLICY IF EXISTS checklist_runs_select_authenticated
    ON public.checklist_runs;
CREATE POLICY checklist_runs_select_authenticated
    ON public.checklist_runs
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS checklist_runs_insert_own
    ON public.checklist_runs;
CREATE POLICY checklist_runs_insert_own
    ON public.checklist_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS checklist_runs_update_own_draft_or_admin
    ON public.checklist_runs;
CREATE POLICY checklist_runs_update_own_draft_or_admin
    ON public.checklist_runs
    FOR UPDATE
    TO authenticated
    USING (
        (created_by = auth.uid() AND status = 'draft'::public.run_status)
        OR public.is_admin()
    )
    WITH CHECK (
        (created_by = auth.uid() AND status = 'draft'::public.run_status)
        OR public.is_admin()
    );

-- ---------- run_values ----------

DROP POLICY IF EXISTS run_values_select_authenticated
    ON public.run_values;
CREATE POLICY run_values_select_authenticated
    ON public.run_values
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS run_values_insert_own_draft
    ON public.run_values;
CREATE POLICY run_values_insert_own_draft
    ON public.run_values
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_values.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS run_values_update_own_draft
    ON public.run_values;
CREATE POLICY run_values_update_own_draft
    ON public.run_values
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_values.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_values.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS run_values_delete_own_draft
    ON public.run_values;
CREATE POLICY run_values_delete_own_draft
    ON public.run_values
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_values.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );
