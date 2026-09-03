-- =====================================================================
-- 0025_po_rev09_unidades_testes.sql
--
-- Popula a coluna 'unit' dos tres trios de teste da secao Processo
-- Mistura do template de Po. A 0024 definiu unidade apenas nos quatro
-- campos citados na ATA de 31/08 (temperatura, umidade, tempo, peso);
-- os trios ficaram sem unidade porque a ATA nao especificou.
--
-- Unidades confirmadas pelo Victor em 03/09:
--   densidade                       -> g/cm3
--   scoop padrao                    -> g
--   simulacao consumidor            -> g
--
-- Fluxo: clona a REV. 08 publicada para um rascunho REV. 09, popula as
-- unidades no rascunho e PARA. A publicacao e passo manual separado,
-- pela UI (publish_template_revision exige auth.uid(), que e NULL no
-- SQL Editor).
--
-- Idempotente: se o rascunho REV. 09 ja existir, reaproveita em vez de
-- tentar clonar de novo.
--
-- ATENCAO: o clone e feito via SQL direto, NAO pela RPC
-- clone_template_revision — a RPC valida auth.uid() e is_admin(), que
-- nao existem no contexto do SQL Editor.
-- =====================================================================

DO $$
DECLARE
    v_src_id     uuid;
    v_new_id     uuid;
    v_mix        uuid;
    v_sec        record;
    v_new_sec_id uuid;
BEGIN
    -- ---------- Origem: a REV. 08 publicada ----------
    SELECT id INTO v_src_id
    FROM public.form_templates
    WHERE product_type = 'po'::public.product_type
      AND status = 'published'::public.template_status;

    IF v_src_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum template de Po publicado. Abortado.';
    END IF;

    -- ---------- Rascunho REV. 09: reaproveita ou cria ----------
    SELECT id INTO v_new_id
    FROM public.form_templates
    WHERE product_type = 'po'::public.product_type
      AND status = 'draft'::public.template_status;

    IF v_new_id IS NULL THEN
        -- Cabecalho
        INSERT INTO public.form_templates (
            document_code, revision, product_type, title,
            status, published_at, created_by
        )
        SELECT
            t.document_code, 'REV. 09', t.product_type, t.title,
            'draft'::public.template_status, NULL, NULL
        FROM public.form_templates t
        WHERE t.id = v_src_id
        RETURNING id INTO v_new_id;

        -- Secoes e campos. Lista de colunas EXPLICITA e COMPLETA:
        -- coluna nova em form_fields que nao entre aqui e perdida em
        -- silencio no clone (foi o que aconteceu com visible_if na
        -- create_run, corrigido so pela 0015).
        FOR v_sec IN
            SELECT id, key, title, sort_order
            FROM public.form_sections
            WHERE template_id = v_src_id
            ORDER BY sort_order
        LOOP
            INSERT INTO public.form_sections (template_id, key, title, sort_order)
            VALUES (v_new_id, v_sec.key, v_sec.title, v_sec.sort_order)
            RETURNING id INTO v_new_sec_id;

            INSERT INTO public.form_fields (
                section_id, key, label, field_type, unit, required,
                options, validation, computed_from, help_text,
                sort_order, visible_if
            )
            SELECT
                v_new_sec_id, f.key, f.label, f.field_type, f.unit, f.required,
                f.options, f.validation, f.computed_from, f.help_text,
                f.sort_order, f.visible_if
            FROM public.form_fields f
            WHERE f.section_id = v_sec.id;
        END LOOP;

        RAISE NOTICE 'Rascunho REV. 09 criado: %', v_new_id;
    ELSE
        RAISE NOTICE 'Rascunho ja existente reaproveitado: %', v_new_id;
    END IF;

    -- ---------- Guarda ----------
    IF NOT EXISTS (
        SELECT 1 FROM public.form_templates
        WHERE id = v_new_id
          AND status = 'draft'::public.template_status
    ) THEN
        RAISE EXCEPTION 'Template % nao esta em draft. Abortado.', v_new_id;
    END IF;

    SELECT id INTO v_mix
    FROM public.form_sections
    WHERE template_id = v_new_id AND key = 'processo_mistura';

    IF v_mix IS NULL THEN
        RAISE EXCEPTION 'Secao processo_mistura nao encontrada no rascunho %.', v_new_id;
    END IF;

    -- ---------- Unidades ----------
    -- Densidade aparente de po: massa por volume.
    UPDATE public.form_fields SET unit = 'g/cm³'
    WHERE section_id = v_mix
      AND key IN ('density_mixing_1', 'density_mixing_2', 'density_mixing_3');

    -- Os dois trios de scoop medem massa do po na dosadora.
    UPDATE public.form_fields SET unit = 'g'
    WHERE section_id = v_mix
      AND key IN (
        'teste_scoop_1', 'teste_scoop_2', 'teste_scoop_3',
        'teste_scoop_consumidor_1', 'teste_scoop_consumidor_2',
        'teste_scoop_consumidor_3'
      );

    -- As medias herdam a unidade do proprio trio: um computed_avg de
    -- g/cm3 continua em g/cm3.
    UPDATE public.form_fields SET unit = 'g/cm³'
    WHERE section_id = v_mix AND key = 'density_mixing_average';

    UPDATE public.form_fields SET unit = 'g'
    WHERE section_id = v_mix
      AND key IN ('teste_scoop_media', 'teste_scoop_consumidor_media');

    RAISE NOTICE 'Unidades aplicadas no rascunho % (REV. 09).', v_new_id;
END;
$$;


-- =====================================================================
-- VERIFICACAO — execucao SEPARADA, apos rodar o bloco acima duas vezes.
-- =====================================================================
--
-- SELECT t.revision, t.status, s.key AS secao, f.sort_order, f.key,
--        f.label, f.unit
-- FROM form_fields f
-- JOIN form_sections s   ON s.id = f.section_id
-- JOIN form_templates t  ON t.id = s.template_id
-- WHERE t.product_type = 'po' AND t.status = 'draft'
--   AND f.unit IS NOT NULL
-- ORDER BY s.sort_order, f.sort_order;
--
-- Esperado: 13 campos com unidade no rascunho REV. 09
--   Mistura: room_temperature °C, relative_humidity %, mixing_time min,
--            density_mixing_1/2/3 + average g/cm³,
--            teste_scoop_1/2/3 + media g,
--            teste_scoop_consumidor_1/2/3 + media g
--   Envase:  package_weight g


-- =====================================================================
-- PUBLICACAO — pela UI, NAO pelo SQL Editor.
-- =====================================================================
-- /admin/templates/<id do rascunho REV. 09>, botao de publicar, logado
-- como admin. A RPC publish_template_revision valida auth.uid(), que e
-- NULL no painel do Supabase.
--
-- Arquiva a REV. 08 e publica a REV. 09 na mesma transacao. Runs
-- existentes nao sao afetados: template_snapshot congela a versao.


-- =====================================================================
-- PENDENCIAS
-- =====================================================================
--
-- 1. Os DOIS trios de densidade continuam existindo:
--      - density_test_*   em Pre Producao     (labels genericos "1o Teste")
--      - density_mixing_* em Processo Mistura (agora com g/cm³)
--    Esta migration NAO tocou no de Pre Producao. Se for duplicacao
--    acidental da REV. 07, remover exige uma REV. 10. Decisao pendente
--    com a Camila.
--
-- 2. computed_avg com denominador parcial: preencher 2 de 3 testes gera
--    media dos 2 sem qualquer indicacao de que faltou um valor. Em
--    documento controlado o operador assina achando que a media e dos
--    tres. Correcao de codigo, pendente de decisao sobre o
--    comportamento correto.
