-- BLOCO B7 — Funções RPC compostas
-- RED-029 REV. 06 — Operações que tocam mais de uma tabela, executadas
-- atomicamente em SECURITY DEFINER. O client NUNCA encadeia inserts.
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- 1. create_run
-- Cria um novo registro em rascunho, vinculado ao template publicado
-- mais recente do tipo de produto indicado. Snapshot do layout no
-- momento da criação, para edições futuras do template não alterarem
-- um registro já iniciado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_run(
    p_product_type public.product_type,
    p_product_name text,
    p_client text,
    p_formulation_code text,
    p_production_date date,
    p_accompaniment_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid uuid;
    v_user_active boolean;
    v_template_id uuid;
    v_template_doc text;
    v_template_rev text;
    v_template_title text;
    v_template_snapshot jsonb;
    v_sections_json jsonb;
    v_new_run_id uuid;
    v_trimmed_name text;
    v_trimmed_client text;
    v_trimmed_formulation text;
    v_trimmed_reason text;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    SELECT active INTO v_user_active
    FROM public.profiles p
    WHERE p.id = v_auth_uid;
    IF v_user_active IS NULL THEN
        RAISE EXCEPTION 'Perfil de usuário não encontrado.';
    END IF;
    IF NOT v_user_active THEN
        RAISE EXCEPTION 'Usuário inativo não pode criar registros.';
    END IF;

    v_trimmed_name := btrim(coalesce(p_product_name, ''));
    v_trimmed_client := btrim(coalesce(p_client, ''));
    v_trimmed_formulation := btrim(coalesce(p_formulation_code, ''));
    v_trimmed_reason := nullif(btrim(coalesce(p_accompaniment_reason, '')), '');

    IF length(v_trimmed_name) = 0 THEN
        RAISE EXCEPTION 'O nome do produto é obrigatório.';
    END IF;
    IF length(v_trimmed_client) = 0 THEN
        RAISE EXCEPTION 'O cliente é obrigatório.';
    END IF;
    IF length(v_trimmed_formulation) = 0 THEN
        RAISE EXCEPTION 'O código de formulação é obrigatório.';
    END IF;
    IF p_production_date IS NULL THEN
        RAISE EXCEPTION 'A data de produção é obrigatória.';
    END IF;

    -- Busca o template publicado mais recente para este tipo.
    SELECT t.id, t.document_code, t.revision, t.title
    INTO v_template_id, v_template_doc, v_template_rev, v_template_title
    FROM public.form_templates t
    WHERE t.product_type = p_product_type
      AND t.status = 'published'::public.template_status
    ORDER BY t.published_at DESC
    LIMIT 1;

    IF v_template_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum template publicado para o tipo de produto %.', p_product_type;
    END IF;

    -- Monta sections com fields agregados por section. Seções sem campos
    -- ficam com fields = [] via coalesce.
    SELECT coalesce(jsonb_agg(s ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_sections_json
    FROM (
        SELECT
            sec.key,
            sec.title,
            sec.sort_order,
            (
                SELECT coalesce(jsonb_agg(f ORDER BY f.sort_order), '[]'::jsonb)
                FROM (
                    SELECT
                        ff.key,
                        ff.label,
                        ff.field_type,
                        ff.unit,
                        ff.required,
                        ff.options,
                        ff.validation,
                        ff.computed_from,
                        ff.help_text,
                        ff.sort_order
                    FROM public.form_fields ff
                    WHERE ff.section_id = sec.id
                ) f
            ) AS fields
        FROM public.form_sections sec
        WHERE sec.template_id = v_template_id
    ) s;

    v_template_snapshot := jsonb_build_object(
        'template_id', v_template_id,
        'document_code', v_template_doc,
        'revision', v_template_rev,
        'product_type', p_product_type,
        'title', v_template_title,
        'captured_at', now(),
        'sections', v_sections_json
    );

    INSERT INTO public.checklist_runs (
        template_id,
        template_snapshot,
        product_name,
        client,
        formulation_code,
        production_date,
        accompaniment_reason,
        status,
        created_by
    ) VALUES (
        v_template_id,
        v_template_snapshot,
        v_trimmed_name,
        v_trimmed_client,
        v_trimmed_formulation,
        p_production_date,
        v_trimmed_reason,
        'draft'::public.run_status,
        v_auth_uid
    )
    RETURNING id INTO v_new_run_id;

    RETURN v_new_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_run(
    public.product_type, text, text, text, date, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_run(
    public.product_type, text, text, text, date, text
) TO authenticated;

-- ============================================================
-- 2. submit_run
-- Envia um rascunho para o fluxo de assinaturas. Valida que todos os
-- campos marcados como required no template_snapshot estão preenchidos
-- em run_values com valor não nulo (texto vazio/whitespace conta como
-- não preenchido).
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid uuid;
    v_run public.checklist_runs%ROWTYPE;
    v_required_fields jsonb;
    v_missing_labels text[] := ARRAY[]::text[];
    v_field jsonb;
    v_sec jsonb;
    v_section_key text;
    v_field_key text;
    v_field_label text;
    v_value_exists boolean;
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

    -- Varre sections → fields dentro do template_snapshot.
    FOR v_sec IN SELECT * FROM jsonb_array_elements(v_run.template_snapshot->'sections')
    LOOP
        v_section_key := v_sec->>'key';
        FOR v_field IN SELECT * FROM jsonb_array_elements(v_sec->'fields')
        LOOP
            IF (v_field->>'required')::boolean THEN
                v_field_key := v_field->>'key';
                v_field_label := v_field->>'label';

                SELECT EXISTS (
                    SELECT 1
                    FROM public.run_values rv
                    WHERE rv.run_id = v_run.id
                      AND rv.section_key = v_section_key
                      AND rv.field_key = v_field_key
                      AND (
                          rv.value_num IS NOT NULL
                          OR rv.value_bool IS NOT NULL
                          OR rv.value_date IS NOT NULL
                          OR (rv.value_text IS NOT NULL AND btrim(rv.value_text) <> '')
                      )
                ) INTO v_value_exists;

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
    SET status = 'submitted'::public.run_status,
        submitted_at = now()
    WHERE id = v_run.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_run(uuid) TO authenticated;

-- ============================================================
-- 3. sign_run
-- Registra uma assinatura no papel indicado, após validar permissão
-- via can_sign_role, estado do run e unicidade do papel. Se todas as
-- assinaturas do RED-029 foram coletadas, fecha o run como signed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sign_run(
    p_run_id uuid,
    p_role public.signature_role,
    p_statement text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Quatro papéis de assinatura do formulário RED-029 (B2). A contagem
    -- é usada para decidir quando o run fecha como "signed".
    c_total_signatures constant int := 4;
    v_auth_uid uuid;
    v_run public.checklist_runs%ROWTYPE;
    v_existing boolean;
    v_signed_name text;
    v_signature_count int;
    v_trimmed_statement text;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    IF NOT public.can_sign_role(p_role) THEN
        RAISE EXCEPTION 'Seu perfil não pode assinar como %.', p_role;
    END IF;

    SELECT * INTO v_run
    FROM public.checklist_runs r
    WHERE r.id = p_run_id;
    IF v_run.id IS NULL OR v_run.status <> 'submitted'::public.run_status THEN
        RAISE EXCEPTION 'Só é possível assinar um registro enviado para assinatura. Status atual: %.',
            coalesce(v_run.status::text, 'inexistente');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.run_signatures rs
        WHERE rs.run_id = p_run_id
          AND rs.role = p_role
    ) INTO v_existing;
    IF v_existing THEN
        RAISE EXCEPTION 'Este papel já foi assinado neste registro.';
    END IF;

    v_trimmed_statement := btrim(coalesce(p_statement, ''));
    IF length(v_trimmed_statement) < 10 THEN
        RAISE EXCEPTION 'A declaração do assinante deve ter pelo menos 10 caracteres.';
    END IF;

    SELECT p.full_name INTO v_signed_name
    FROM public.profiles p
    WHERE p.id = v_auth_uid;

    IF v_signed_name IS NULL OR btrim(v_signed_name) = '' THEN
        RAISE EXCEPTION 'Perfil de usuário não encontrado ou sem nome cadastrado.';
    END IF;

    INSERT INTO public.run_signatures (
        run_id,
        role,
        signed_by,
        signed_name,
        statement
    ) VALUES (
        p_run_id,
        p_role,
        v_auth_uid,
        v_signed_name,
        v_trimmed_statement
    );

    SELECT count(*) INTO v_signature_count
    FROM public.run_signatures rs
    WHERE rs.run_id = p_run_id;

    IF v_signature_count >= c_total_signatures THEN
        UPDATE public.checklist_runs
        SET status = 'signed'::public.run_status,
            completed_at = now()
        WHERE id = p_run_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_run(uuid, public.signature_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_run(uuid, public.signature_role, text) TO authenticated;

-- ============================================================
-- 4. void_and_supersede_run
-- Emite correção de um registro assinado. Cria um novo run em draft
-- com cópia fiel de cabeçalho e valores, marca o original como voided
-- com a justificativa. Tudo numa mesma transação.
-- ============================================================

CREATE OR REPLACE FUNCTION public.void_and_supersede_run(
    p_run_id uuid,
    p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_uid uuid;
    v_original public.checklist_runs%ROWTYPE;
    v_has_superseder boolean;
    v_trimmed_reason text;
    v_new_run_id uuid;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    SELECT * INTO v_original
    FROM public.checklist_runs r
    WHERE r.id = p_run_id;
    IF v_original.id IS NULL OR v_original.status <> 'signed'::public.run_status THEN
        RAISE EXCEPTION 'Apenas registros assinados podem ser corrigidos. Status atual: %.',
            coalesce(v_original.status::text, 'inexistente');
    END IF;

    IF v_original.created_by <> v_auth_uid AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas o autor ou um administrador pode corrigir este registro.';
    END IF;

    v_trimmed_reason := btrim(coalesce(p_reason, ''));
    IF length(v_trimmed_reason) < 20 THEN
        RAISE EXCEPTION 'A justificativa da correção deve ter ao menos 20 caracteres.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.checklist_runs r
        WHERE r.supersedes_run_id = p_run_id
    ) INTO v_has_superseder;
    IF v_has_superseder THEN
        RAISE EXCEPTION 'Este registro já possui uma correção emitida.';
    END IF;

    -- Ordem: primeiro cria o novo run (cabeçalho), depois copia valores,
    -- por último marca o original como voided.
    INSERT INTO public.checklist_runs (
        template_id,
        template_snapshot,
        product_name,
        client,
        formulation_code,
        batch_number,
        accompaniment_reason,
        production_date,
        status,
        created_by,
        supersedes_run_id
    ) VALUES (
        v_original.template_id,
        v_original.template_snapshot,
        v_original.product_name,
        v_original.client,
        v_original.formulation_code,
        v_original.batch_number,
        v_original.accompaniment_reason,
        v_original.production_date,
        'draft'::public.run_status,
        v_auth_uid,
        p_run_id
    )
    RETURNING id INTO v_new_run_id;

    INSERT INTO public.run_values (
        run_id,
        section_key,
        field_key,
        value_text,
        value_num,
        value_bool,
        value_date,
        updated_by,
        updated_at
    )
    SELECT
        v_new_run_id,
        rv.section_key,
        rv.field_key,
        rv.value_text,
        rv.value_num,
        rv.value_bool,
        rv.value_date,
        v_auth_uid,
        now()
    FROM public.run_values rv
    WHERE rv.run_id = p_run_id;

    UPDATE public.checklist_runs
    SET status = 'voided'::public.run_status,
        voided_reason = v_trimmed_reason
    WHERE id = p_run_id;

    RETURN v_new_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_and_supersede_run(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_and_supersede_run(uuid, text) TO authenticated;
