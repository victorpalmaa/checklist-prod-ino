-- 0015_create_run_include_visible_if.sql
-- Atualiza create_run para incluir form_fields.visible_if (0014) na
-- montagem do template_snapshot. Sem esta mudança, a coluna existe no
-- banco mas nunca chega ao front-end — o subselect de campos usa lista
-- explícita de colunas, não SELECT *.
--
-- Corpo idêntico ao de 0006_rpc.sql, exceto pela linha
-- "ff.visible_if," adicionada ao subselect de campos. Nenhuma outra
-- regra de negócio foi alterada.

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
                        ff.sort_order,
                        ff.visible_if
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
