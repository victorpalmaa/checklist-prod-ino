-- BLOCO B8 — Trilha de auditoria imutável
-- RED-029 REV. 06 — Documento controlado: toda alteração nos registros
-- de produção deixa rastro sequencial e imutável.
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.
--
-- [AVALIAR RETENÇÃO] run_values recebe upsert a cada ~1,5 s de autosave e,
-- por ter trigger de updated_at (a2_touch_updated_at_trg), sempre difere o
-- jsonb OLD vs NEW — uma linha de auditoria por autosave, sem filtro. É o
-- principal candidato a retenção futura (particionamento por mês ou purge
-- direcionado) quando houver volume real. Sem alterar a auditoria de
-- cabeçalhos, assinaturas e templates, que devem ser permanentes.

-- ============================================================
-- TABELA public.audit_log
-- Trilha sequencial e imutável de eventos de escrita.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
    id bigserial PRIMARY KEY,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    actor_id uuid,
    before jsonb,
    after jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'audit_log_action_allowed'
          AND conrelid = 'public.audit_log'::regclass
    ) THEN
        ALTER TABLE public.audit_log
            ADD CONSTRAINT audit_log_action_allowed
            CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'));
    END IF;
END $$;

COMMENT ON TABLE public.audit_log IS
    'Trilha de auditoria imutável. AFTER INSERT/UPDATE/DELETE nas 8 tabelas do domínio. Gravada por audit_trigger().';

COMMENT ON COLUMN public.audit_log.id IS
    'bigserial sequencial. Ordem cronológica de evento é a ordem do id.';

COMMENT ON COLUMN public.audit_log.table_name IS
    'Nome da tabela do domínio onde o evento ocorreu (TG_TABLE_NAME).';

COMMENT ON COLUMN public.audit_log.record_id IS
    'uuid da linha alterada. NEW.id em INSERT/UPDATE, OLD.id em DELETE.';

COMMENT ON COLUMN public.audit_log.action IS
    'INSERT | UPDATE | DELETE. Restrito por CHECK.';

COMMENT ON COLUMN public.audit_log.actor_id IS
    'auth.uid() do autor. NULL em carga administrativa/migração. Sem FK para sobreviver a exclusão de usuário.';

COMMENT ON COLUMN public.audit_log.before IS
    'to_jsonb(OLD) em UPDATE e DELETE. NULL em INSERT.';

COMMENT ON COLUMN public.audit_log.after IS
    'to_jsonb(NEW) em INSERT e UPDATE. NULL em DELETE.';

COMMENT ON COLUMN public.audit_log.occurred_at IS
    'Data/hora do evento. Default now(). AFTER trigger garante que é após commit lógico.';

-- ============================================================
-- ÍNDICES DE CONSULTA
-- ============================================================

CREATE INDEX IF NOT EXISTS audit_log_table_record_idx
    ON public.audit_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS audit_log_occurred_at_desc_idx
    ON public.audit_log (occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx
    ON public.audit_log (actor_id);

-- ============================================================
-- FUNÇÃO GENÉRICA DE AUDITORIA
-- AFTER trigger. Roda por último em todos os writes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record_id uuid;
    v_before jsonb;
    v_after jsonb;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id;
        v_before    := to_jsonb(OLD);
        v_after     := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id;
        v_before    := NULL;
        v_after     := to_jsonb(NEW);
    ELSE
        v_record_id := NEW.id;
        v_before    := to_jsonb(OLD);
        v_after     := to_jsonb(NEW);

        -- UPDATE que não altera nada não gera evento. Vale para as
        -- tabelas sem trigger de updated_at; em checklist_runs e
        -- run_values o carimbo de tempo sempre muda, então todo UPDATE
        -- é registrado.
        IF v_before = v_after THEN
            RETURN NULL;
        END IF;
    END IF;

    INSERT INTO public.audit_log (
        table_name,
        record_id,
        action,
        actor_id,
        before,
        after
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        auth.uid(),
        v_before,
        v_after
    );

    RETURN NULL;
END;
$$;

-- 8 tabelas do domínio com z_ prefixo (roda por último entre AFTER triggers).

DROP TRIGGER IF EXISTS z_audit_trg ON public.profiles;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.form_templates;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.form_templates
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.form_sections;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.form_sections
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.form_fields;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.form_fields
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.checklist_runs;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.checklist_runs
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.run_values;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.run_values
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.run_signatures;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.run_signatures
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS z_audit_trg ON public.run_attachments;
CREATE TRIGGER z_audit_trg
    AFTER INSERT OR UPDATE OR DELETE ON public.run_attachments
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- IMUTABILIDADE DO PRÓPRIO LOG
-- BEFORE UPDATE/DELETE. Prefixo a1_ para rodar primeiro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_audit_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'O log de auditoria é imutável.';
END;
$$;

DROP TRIGGER IF EXISTS a1_prevent_audit_log_change_trg
    ON public.audit_log;
CREATE TRIGGER a1_prevent_audit_log_change_trg
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_change();

-- ============================================================
-- RLS
-- Leitura só admin. Escrita só via SECURITY DEFINER audit_trigger().
-- ============================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_admin
    ON public.audit_log;
CREATE POLICY audit_log_select_admin
    ON public.audit_log
    FOR SELECT
    TO authenticated
    USING (public.is_admin());
