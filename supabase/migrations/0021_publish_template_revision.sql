-- 0021_publish_template_revision.sql
-- Bloco J2 — publicação de revisão de template.
--
-- Publica um draft e arquiva a revisão publicada anterior do mesmo
-- product_type, NA MESMA TRANSAÇÃO.
--
-- ORDEM OBRIGATÓRIA: arquivar a antiga ANTES de publicar a nova. O
-- índice único parcial de 0011 (um published por product_type) é
-- verificado a cada UPDATE, não no fim da transação. Publicar primeiro
-- geraria violação imediata.
--
-- Idempotente: pode ser reexecutada no SQL Editor sem erro.

DROP FUNCTION IF EXISTS public.publish_template_revision(uuid);

CREATE OR REPLACE FUNCTION public.publish_template_revision(
    p_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid           uuid;
    v_tpl           public.form_templates%ROWTYPE;
    v_sections      int;
    v_fields        int;
    v_archived_id   uuid;
BEGIN
    -- ---------- Autorização ----------
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem publicar revisões de template.';
    END IF;

    -- ---------- Origem ----------
    SELECT * INTO v_tpl
    FROM public.form_templates
    WHERE id = p_template_id;

    IF v_tpl.product_type IS NULL THEN
        RAISE EXCEPTION 'Template não encontrado.';
    END IF;

    IF v_tpl.status <> 'draft'::public.template_status THEN
        RAISE EXCEPTION 'Apenas rascunhos podem ser publicados. Status atual: %.', v_tpl.status;
    END IF;

    -- ---------- Template vazio não vai para produção ----------
    SELECT count(*) INTO v_sections
    FROM public.form_sections
    WHERE template_id = v_tpl.id;

    IF v_sections = 0 THEN
        RAISE EXCEPTION 'Não é possível publicar um template sem seções.';
    END IF;

    SELECT count(*) INTO v_fields
    FROM public.form_fields f
    JOIN public.form_sections s ON s.id = f.section_id
    WHERE s.template_id = v_tpl.id;

    IF v_fields = 0 THEN
        RAISE EXCEPTION 'Não é possível publicar um template sem campos.';
    END IF;

    -- ---------- PASSO 1: arquivar a publicada atual ----------
    -- Precede a publicação. Ver nota de ordem no cabeçalho.
    -- Resolve o id ANTES do UPDATE: RETURNING ... INTO em UPDATE que
    -- não afeta linha nenhuma deixa a variável com o valor anterior em
    -- vez de NULL. Mesma família de armadilha do FOUND / SELECT INTO.
    SELECT id INTO v_archived_id
    FROM public.form_templates
    WHERE product_type = v_tpl.product_type
      AND status = 'published'::public.template_status;

    IF v_archived_id IS NOT NULL THEN
        UPDATE public.form_templates
        SET status = 'archived'::public.template_status
        WHERE id = v_archived_id;
    END IF;

    -- ---------- PASSO 2: publicar o rascunho ----------
    UPDATE public.form_templates
    SET status       = 'published'::public.template_status,
        published_at = now()
    WHERE id = v_tpl.id;

    RETURN v_archived_id;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Conflito ao publicar: já existe outra revisão publicada para este tipo de produto.';
END;
$$;

COMMENT ON FUNCTION public.publish_template_revision(uuid) IS
    'Publica um draft e arquiva a revisão publicada anterior do mesmo product_type, na mesma transação. Admin-only. Retorna o id da revisão arquivada, ou NULL se não havia nenhuma.';

REVOKE EXECUTE ON FUNCTION public.publish_template_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_template_revision(uuid) TO authenticated;
