-- 0020_clone_template_revision.sql
-- Bloco J2 — administração de templates.
--
-- 1) Índice único parcial: no máximo UM rascunho por tipo de produto.
--    Irmão do form_templates_one_published_per_product (0011), que
--    garante no máximo um published por tipo. Evita ambiguidade de
--    "qual rascunho eu publico" em documento controlado.
--
-- 2) RPC clone_template_revision: copia template + seções + campos de
--    uma revisão existente para uma nova revisão em status draft.
--    Operação multi-tabela => precisa ser transacional => RPC.
--    Sem isso, uma falha no meio deixaria template órfão sem campos
--    (defeito nº 4 do sistema legado).
--
-- Idempotente: pode ser reexecutada no SQL Editor sem erro.

-- ============================================================
-- 1) ÍNDICE: no máximo um draft por product_type
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS form_templates_one_draft_per_product_uq
    ON public.form_templates (product_type)
    WHERE status = 'draft'::public.template_status;

COMMENT ON INDEX public.form_templates_one_draft_per_product_uq IS
    'Garante no máximo um template em rascunho por tipo de produto.';

-- ============================================================
-- 2) RPC clone_template_revision
-- ============================================================

DROP FUNCTION IF EXISTS public.clone_template_revision(uuid, text);

CREATE OR REPLACE FUNCTION public.clone_template_revision(
    p_source_template_id uuid,
    p_new_revision text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid              uuid;
    v_src              public.form_templates%ROWTYPE;
    v_new_revision     text;
    v_new_template_id  uuid;
    v_new_section_id   uuid;
    v_sec              record;
BEGIN
    -- ---------- Autorização ----------
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem criar revisões de template.';
    END IF;

    -- ---------- Validação de entrada ----------
    v_new_revision := btrim(COALESCE(p_new_revision, ''));
    IF v_new_revision = '' THEN
        RAISE EXCEPTION 'A revisão não pode ser vazia.';
    END IF;

    SELECT * INTO v_src
    FROM public.form_templates
    WHERE id = p_source_template_id;

    -- Checagem explícita de existência. FOUND / v_src.id IS NULL após
    -- SELECT INTO já se provaram frágeis neste projeto; conferir uma
    -- coluna NOT NULL da origem é o teste confiável.
    IF v_src.product_type IS NULL THEN
        RAISE EXCEPTION 'Template de origem não encontrado.';
    END IF;

    IF v_src.status = 'draft'::public.template_status THEN
        RAISE EXCEPTION 'Não é possível clonar um rascunho. Edite o rascunho existente.';
    END IF;

    -- ---------- Pré-checagens com mensagem legível ----------
    -- O índice único é a garantia real; isto só melhora a mensagem.
    IF EXISTS (
        SELECT 1 FROM public.form_templates
        WHERE product_type = v_src.product_type
          AND status = 'draft'::public.template_status
    ) THEN
        RAISE EXCEPTION 'Já existe um rascunho em andamento para este tipo de produto. Publique ou descarte antes de criar outro.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.form_templates
        WHERE document_code = v_src.document_code
          AND revision      = v_new_revision
          AND product_type  = v_src.product_type
    ) THEN
        RAISE EXCEPTION 'Já existe a revisão % para este tipo de produto.', v_new_revision;
    END IF;

    -- ---------- Cabeçalho ----------
    INSERT INTO public.form_templates (
        document_code, revision, product_type, title, status, published_at, created_by
    )
    VALUES (
        v_src.document_code,
        v_new_revision,
        v_src.product_type,
        v_src.title,
        'draft'::public.template_status,
        NULL,
        v_uid
    )
    RETURNING id INTO v_new_template_id;

    -- ---------- Seções e campos ----------
    FOR v_sec IN
        SELECT id, key, title, sort_order
        FROM public.form_sections
        WHERE template_id = v_src.id
        ORDER BY sort_order
    LOOP
        INSERT INTO public.form_sections (template_id, key, title, sort_order)
        VALUES (v_new_template_id, v_sec.key, v_sec.title, v_sec.sort_order)
        RETURNING id INTO v_new_section_id;

        -- Lista de colunas EXPLÍCITA e COMPLETA. Toda coluna nova em
        -- form_fields precisa ser adicionada aqui, senão o clone perde
        -- o dado em silêncio (foi o que aconteceu com visible_if na
        -- create_run, corrigido pela 0015).
        INSERT INTO public.form_fields (
            section_id, key, label, field_type, unit, required,
            options, validation, computed_from, help_text, sort_order, visible_if
        )
        SELECT
            v_new_section_id, f.key, f.label, f.field_type, f.unit, f.required,
            f.options, f.validation, f.computed_from, f.help_text, f.sort_order, f.visible_if
        FROM public.form_fields f
        WHERE f.section_id = v_sec.id;
    END LOOP;

    RETURN v_new_template_id;

EXCEPTION
    WHEN unique_violation THEN
        -- Rede de proteção para corrida entre duas chamadas simultâneas
        -- que passem juntas pelas pré-checagens acima. O índice único
        -- é quem realmente garante a regra; aqui só traduzimos o erro.
        RAISE EXCEPTION 'Conflito ao criar a revisão: já existe rascunho ou revisão com este número para este tipo de produto.';
END;
$$;

COMMENT ON FUNCTION public.clone_template_revision(uuid, text) IS
    'Clona template publicado/arquivado para nova revisão em draft. Admin-only, transacional.';

REVOKE EXECUTE ON FUNCTION public.clone_template_revision(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_template_revision(uuid, text) TO authenticated;
