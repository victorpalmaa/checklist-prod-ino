-- 0009_fix_submit_run_special_fields.sql
-- Corrige a validacao de obrigatoriedade em submit_run.
--
-- PROBLEMA: batch_number e production_date existem no template como
-- form_fields required, mas sao persistidos nas COLUNAS de
-- checklist_runs (fonte de verdade unica, decisao do bloco E1), nunca
-- em run_values. A validacao original consultava apenas run_values e
-- por isso reportava esses dois campos como sempre faltando,
-- bloqueando qualquer submissao.
--
-- SOLUCAO: para as keys especiais, validar a coluna correspondente em
-- checklist_runs. Demais campos seguem validando run_values.
--
-- Idempotente: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.submit_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid       uuid;
    v_run            public.checklist_runs%ROWTYPE;
    v_missing_labels text[] := ARRAY[]::text[];
    v_field          jsonb;
    v_sec            jsonb;
    v_section_key    text;
    v_field_key      text;
    v_field_label    text;
    v_value_exists   boolean;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    SELECT * INTO v_run
    FROM public.checklist_runs r
    WHERE r.id = p_run_id;

    IF v_run.id IS NULL THEN
        RAISE EXCEPTION 'Registro não encontrado.';
    END IF;

    IF v_run.created_by <> v_auth_uid AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas o autor pode enviar este registro.';
    END IF;

    IF v_run.status <> 'draft'::public.run_status THEN
        RAISE EXCEPTION 'Somente rascunhos podem ser enviados. Status atual: %.', v_run.status;
    END IF;

    FOR v_sec IN SELECT * FROM jsonb_array_elements(v_run.template_snapshot->'sections')
    LOOP
        v_section_key := v_sec->>'key';

        FOR v_field IN SELECT * FROM jsonb_array_elements(v_sec->'fields')
        LOOP
            IF (v_field->>'required')::boolean THEN
                v_field_key   := v_field->>'key';
                v_field_label := v_field->>'label';

                -- Campos especiais: a fonte de verdade e a coluna de
                -- checklist_runs, nao run_values.
                IF v_field_key = 'batch_number' THEN
                    v_value_exists :=
                        v_run.batch_number IS NOT NULL
                        AND btrim(v_run.batch_number) <> '';

                ELSIF v_field_key = 'production_date' THEN
                    v_value_exists := v_run.production_date IS NOT NULL;

                ELSE
                    SELECT EXISTS (
                        SELECT 1
                        FROM public.run_values rv
                        WHERE rv.run_id      = v_run.id
                          AND rv.section_key = v_section_key
                          AND rv.field_key   = v_field_key
                          AND (
                              rv.value_num  IS NOT NULL
                              OR rv.value_bool IS NOT NULL
                              OR rv.value_date IS NOT NULL
                              OR (rv.value_text IS NOT NULL AND btrim(rv.value_text) <> '')
                          )
                    ) INTO v_value_exists;
                END IF;

                IF NOT v_value_exists THEN
                    v_missing_labels := array_append(v_missing_labels, v_field_label);
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    IF cardinality(v_missing_labels) > 0 THEN
        RAISE EXCEPTION 'Campos obrigatórios não preenchidos: %.',
            array_to_string(v_missing_labels, ', ');
    END IF;

    UPDATE public.checklist_runs
    SET status       = 'submitted'::public.run_status,
        submitted_at = now()
    WHERE id = v_run.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_run(uuid) TO authenticated;