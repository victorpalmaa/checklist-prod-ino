-- 0023_submit_run_respects_visible_if.sql
--
-- PROBLEMA: submit_run exige preenchimento de TODO campo com
-- required = true, sem consultar visible_if. Um campo condicional
-- marcado como obrigatorio e cobrado mesmo quando esta oculto, e o
-- operador nao tem como preencher algo que nao aparece na tela: o
-- rascunho fica permanentemente impossivel de enviar.
--
-- A validacao (0009) e anterior ao motor de campo condicional (0014),
-- por isso a lacuna. Hoje nao ha campo condicional obrigatorio em
-- template publicado, entao o defeito esta latente — mas o editor de
-- campos do bloco J2 permite criar essa combinacao com dois cliques.
--
-- SOLUCAO: antes de cobrar um campo obrigatorio, avaliar visible_if
-- contra o valor gravado do campo controlador NA MESMA SECAO. A
-- comparacao normaliza os dois lados (trim + minusculas) para espelhar
-- normalizeForComparison em src/lib/form/visibility.ts: se banco e
-- client divergirem sobre o que esta visivel, o operador recebe erro
-- de um campo que nao existe na tela.
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
    v_visible_if     jsonb;
    v_ctrl_key       text;
    v_ctrl_expected  text;
    v_ctrl_actual    text;
    v_is_visible     boolean;
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

                -- ---------- visibilidade condicional ----------
                v_is_visible := true;
                v_visible_if := v_field->'visible_if';

                IF v_visible_if IS NOT NULL
                   AND jsonb_typeof(v_visible_if) = 'object'
                THEN
                    v_ctrl_key      := v_visible_if->>'field';
                    v_ctrl_expected := lower(btrim(coalesce(v_visible_if->>'equals', '')));

                    -- Valor atual do campo controlador. Qualquer coluna
                    -- de valor serve: o campo pode ser texto, numero ou
                    -- booleano, e a comparacao e sempre textual.
                    SELECT lower(btrim(coalesce(
                               rv.value_text,
                               rv.value_num::text,
                               CASE WHEN rv.value_bool THEN 'true' ELSE 'false' END,
                               rv.value_date::text,
                               ''
                           )))
                      INTO v_ctrl_actual
                      FROM public.run_values rv
                     WHERE rv.run_id      = v_run.id
                       AND rv.section_key = v_section_key
                       AND rv.field_key   = v_ctrl_key;

                    v_is_visible :=
                        coalesce(v_ctrl_actual, '') = v_ctrl_expected;
                END IF;

                IF NOT v_is_visible THEN
                    CONTINUE;
                END IF;

                -- ---------- obrigatoriedade ----------
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
