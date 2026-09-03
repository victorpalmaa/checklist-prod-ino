-- =====================================================================
-- 0024_po_rev08_ajustes_ata.sql
--
-- Ajustes do template de Po decididos na reuniao de 31/08/2026
-- (ATA Checkpoint Portal INO), acoes 1, 2 e 3 dos Proximos Passos.
--
-- Alvo: rascunho ja existente de Po.
--   template_id = 44bdbc61-eb00-493e-afc8-9f0df4b2d109  (revision 'rev 08')
--
-- NAO clona. O rascunho ja existe e o indice unico parcial da 0020
-- (um draft por product_type) impede criar outro.
--
-- NAO publica. Publicacao e passo separado, apos validacao visual.
-- 'archived' e terminal: publicar errado custa um novo ciclo.
--
-- Idempotente: pode rodar duas vezes.
-- Guarda: aborta se o template alvo nao estiver em 'draft'.
-- =====================================================================

DO $$
DECLARE
    v_tpl uuid := '44bdbc61-eb00-493e-afc8-9f0df4b2d109';
    v_pre uuid;
    v_mix uuid;
    v_env uuid;
BEGIN
    -- ---------- Guarda de estado ----------
    IF NOT EXISTS (
        SELECT 1 FROM public.form_templates
        WHERE id = v_tpl
          AND status = 'draft'::public.template_status
          AND product_type = 'po'::public.product_type
    ) THEN
        RAISE EXCEPTION
            'Template % nao esta em draft de Po. Abortado sem alteracao.', v_tpl;
    END IF;

    -- ---------- Resolucao de secoes por key ----------
    -- O clone gera ids novos para as secoes; resolver por key e a unica
    -- forma estavel.
    SELECT id INTO v_pre FROM public.form_sections
        WHERE template_id = v_tpl AND key = 'pre_producao';
    SELECT id INTO v_mix FROM public.form_sections
        WHERE template_id = v_tpl AND key = 'processo_mistura';
    SELECT id INTO v_env FROM public.form_sections
        WHERE template_id = v_tpl AND key = 'processo_envase';

    IF v_pre IS NULL OR v_mix IS NULL OR v_env IS NULL THEN
        RAISE EXCEPTION
            'Secao nao encontrada. pre=%, mix=%, env=%', v_pre, v_mix, v_env;
    END IF;

    -- =================================================================
    -- 0. Normalizacao da grafia da revisao
    -- =================================================================
    -- O banco ja tem tres grafias ('06', 'REV. 07', 'REV.07'). O
    -- rascunho nasceu como 'rev 08', uma quarta. Enquanto e draft da
    -- para corrigir; depois de publicado o trigger veta para sempre.
    UPDATE public.form_templates
    SET revision = 'REV. 08'
    WHERE id = v_tpl
      AND revision <> 'REV. 08';

    -- =================================================================
    -- 1. PRE PRODUCAO
    -- =================================================================
    -- ATA: "Campo scoop conforme teste de bancada segue mesma logica do
    -- teste de rotulo/embalagem — abre codigo do Datasul."
    INSERT INTO public.form_fields (
        section_id, key, label, field_type, unit, required,
        options, validation, computed_from, help_text, sort_order, visible_if
    )
    SELECT
        v_pre,
        'scoop_datasul_descricao',
        'Código Datasul e descrição — Scoop',
        'text'::public.field_type,
        NULL, false, NULL, NULL, NULL, NULL,
        26,
        '{"field": "scoop", "equals": "Sim"}'::jsonb
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields
        WHERE section_id = v_pre AND key = 'scoop_datasul_descricao'
    );

    INSERT INTO public.form_fields (
        section_id, key, label, field_type, unit, required,
        options, validation, computed_from, help_text, sort_order, visible_if
    )
    SELECT
        v_pre,
        'scoop_motivo',
        'Motivo da não conformidade — Scoop',
        'textarea'::public.field_type,
        NULL, false, NULL, NULL, NULL, NULL,
        27,
        '{"field": "scoop", "equals": "Não"}'::jsonb
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields
        WHERE section_id = v_pre AND key = 'scoop_motivo'
    );

    -- Abre espaco para os dois campos novos logo abaixo do 'scoop'
    -- (sort 25). Campos 1-25 nao mudam.
    UPDATE public.form_fields
    SET sort_order = CASE key
        WHEN 'scoop_datasul_descricao'     THEN 26
        WHEN 'scoop_motivo'                THEN 27
        WHEN 'density_test_1'              THEN 28
        WHEN 'density_test_2'              THEN 29
        WHEN 'density_test_3'              THEN 30
        WHEN 'density_average'             THEN 31
        WHEN 'pre_production_observations' THEN 32
        ELSE sort_order
    END
    WHERE section_id = v_pre
      AND key IN (
        'scoop_datasul_descricao', 'scoop_motivo',
        'density_test_1', 'density_test_2', 'density_test_3',
        'density_average', 'pre_production_observations'
      );

    -- =================================================================
    -- 2. PROCESSO MISTURA
    -- =================================================================

    -- ---- 2.1 Remocao do codigo Datasul do 'scoop conforme teste' ----
    -- ATA: "Removidos o codigo Datasul e a descricao da pergunta quando
    -- resposta e sim."
    --
    -- Nao confundir com o item 1: sao campos distintos. O de Pre
    -- Producao ('scoop', teste de bancada) GANHA o codigo Datasul; o
    -- desta secao ('scoop_conforme_teste') PERDE.
    DELETE FROM public.form_fields
    WHERE section_id = v_mix
      AND key = 'scoop_codigo_datasul_descricao';

    -- ---- 2.2 Unidades de medida ----
    -- A coluna form_fields.unit ja existe e estava 100% nula nos 69
    -- campos. Popular aqui e o que permite a acao 4 (PDF) renderizar a
    -- medida junto do campo sem hardcodar mapeamento no frontend.
    UPDATE public.form_fields SET unit = '°C'
        WHERE section_id = v_mix AND key = 'room_temperature';
    UPDATE public.form_fields SET unit = 'min'
        WHERE section_id = v_mix AND key = 'mixing_time';
    UPDATE public.form_fields SET unit = '%'
        WHERE section_id = v_mix AND key = 'relative_humidity';

    -- ---- 2.3 Nomenclatura dos tres trios ----
    -- Os tres trios JA EXISTEM no banco. A acao 1 da ATA nao e criar
    -- computed_avg — e renomear e reposicionar. As chaves permanecem
    -- intocadas: chave de campo e imutavel entre revisoes.
    UPDATE public.form_fields SET label = '1º teste de densidade'
        WHERE section_id = v_mix AND key = 'density_mixing_1';
    UPDATE public.form_fields SET label = '2º teste de densidade'
        WHERE section_id = v_mix AND key = 'density_mixing_2';
    UPDATE public.form_fields SET label = '3º teste de densidade'
        WHERE section_id = v_mix AND key = 'density_mixing_3';
    UPDATE public.form_fields SET label = 'Média de densidade'
        WHERE section_id = v_mix AND key = 'density_mixing_average';

    UPDATE public.form_fields SET label = '1º teste de scoop padrão'
        WHERE section_id = v_mix AND key = 'teste_scoop_1';
    UPDATE public.form_fields SET label = '2º teste de scoop padrão'
        WHERE section_id = v_mix AND key = 'teste_scoop_2';
    UPDATE public.form_fields SET label = '3º teste de scoop padrão'
        WHERE section_id = v_mix AND key = 'teste_scoop_3';
    UPDATE public.form_fields SET label = 'Média de scoop padrão'
        WHERE section_id = v_mix AND key = 'teste_scoop_media';

    UPDATE public.form_fields SET label = '1º teste de simulação consumidor'
        WHERE section_id = v_mix AND key = 'teste_scoop_consumidor_1';
    UPDATE public.form_fields SET label = '2º teste de simulação consumidor'
        WHERE section_id = v_mix AND key = 'teste_scoop_consumidor_2';
    UPDATE public.form_fields SET label = '3º teste de simulação consumidor'
        WHERE section_id = v_mix AND key = 'teste_scoop_consumidor_3';
    UPDATE public.form_fields SET label = 'Média de simulação consumidor'
        WHERE section_id = v_mix AND key = 'teste_scoop_consumidor_media';

    -- ---- 2.4 Reordenacao ----
    -- ATA: "Trio de testes 1, 2 e 3 posicionado antes da secao de scoop,
    -- abaixo da pergunta foi detectada alguma ocorrencia durante a
    -- mistura."
    --
    -- Leitura adotada: o trio e density_mixing_*, hoje solto no fim da
    -- secao (sort 20-23). As duas referencias da ATA caem dentro de
    -- Processo Mistura. Ver PENDENCIA 1 no rodape.
    UPDATE public.form_fields
    SET sort_order = CASE key
        WHEN 'mixer_used'                    THEN 1
        WHEN 'mixing_order'                  THEN 2
        WHEN 'room_temperature'              THEN 3
        WHEN 'relative_humidity'             THEN 4
        WHEN 'mixing_time'                   THEN 5
        WHEN 'mixing_occurrence'             THEN 6
        WHEN 'density_mixing_1'              THEN 7
        WHEN 'density_mixing_2'              THEN 8
        WHEN 'density_mixing_3'              THEN 9
        WHEN 'density_mixing_average'        THEN 10
        WHEN 'teste_scoop_1'                 THEN 11
        WHEN 'teste_scoop_2'                 THEN 12
        WHEN 'teste_scoop_3'                 THEN 13
        WHEN 'teste_scoop_media'             THEN 14
        WHEN 'teste_scoop_consumidor_1'      THEN 15
        WHEN 'teste_scoop_consumidor_2'      THEN 16
        WHEN 'teste_scoop_consumidor_3'      THEN 17
        WHEN 'teste_scoop_consumidor_media'  THEN 18
        WHEN 'scoop_conforme_teste'          THEN 19
        WHEN 'scoop_motivo_nao_conformidade' THEN 20
        WHEN 'sensorial_released'            THEN 21
        WHEN 'mixing_observations'           THEN 22
        ELSE sort_order
    END
    WHERE section_id = v_mix;

    -- =================================================================
    -- 3. PROCESSO ENVASE
    -- =================================================================

    -- ---- 3.1 Remocao do campo "Informacoes da Embalagem" ----
    DELETE FROM public.form_fields
    WHERE section_id = v_env
      AND key = 'packaging_info';

    -- ---- 3.2 Motivo da divergencia de validade ----
    -- ATA: "Se nao, abre campo motivo da divergencia."
    -- Campo AUSENTE na REV. 07: 'validity_correct' nao tinha nenhum
    -- filho condicional. E criacao, nao reordenacao.
    INSERT INTO public.form_fields (
        section_id, key, label, field_type, unit, required,
        options, validation, computed_from, help_text, sort_order, visible_if
    )
    SELECT
        v_env,
        'validity_divergence_reason',
        'Motivo da divergência',
        'textarea'::public.field_type,
        NULL, false, NULL, NULL, NULL, NULL,
        5,
        '{"field": "validity_correct", "equals": "Não"}'::jsonb
    WHERE NOT EXISTS (
        SELECT 1 FROM public.form_fields
        WHERE section_id = v_env AND key = 'validity_divergence_reason'
    );

    -- ---- 3.3 Peso da embalagem em grama ----
    UPDATE public.form_fields SET unit = 'g'
        WHERE section_id = v_env AND key = 'package_weight';

    -- ---- 3.4 Observacoes do envase obrigatorias e sempre visiveis ----
    -- ATA: "Passa a ser campo obrigatorio, independente da resposta
    -- sobre ocorrencia."
    --
    -- Duas mudancas: required vira true E o visible_if some. Manter o
    -- visible_if com required=true tornaria o campo obrigatorio e
    -- invisivel quando a resposta fosse "Nao" — mesma familia de defeito
    -- que a 0023 corrigiu na submit_run.
    UPDATE public.form_fields
    SET required   = true,
        visible_if = NULL
    WHERE section_id = v_env
      AND key = 'bagging_observations';

    -- ---- 3.5 Reordenacao ----
    UPDATE public.form_fields
    SET sort_order = CASE key
        WHEN 'batch_number'               THEN 1
        WHEN 'production_date'            THEN 2
        WHEN 'bagging_machine'            THEN 3
        WHEN 'validity_correct'           THEN 4
        WHEN 'validity_divergence_reason' THEN 5
        WHEN 'package_weight'             THEN 6
        WHEN 'coding_location'            THEN 7
        WHEN 'bagging_occurrence'         THEN 8
        WHEN 'bagging_observations'       THEN 9
        ELSE sort_order
    END
    WHERE section_id = v_env;

    -- =================================================================
    -- 4. POS PRODUCAO
    -- =================================================================
    -- ATA: "Mantido como esta, sem alteracoes." Nenhuma acao.

    RAISE NOTICE 'Ajustes da ATA aplicados no rascunho % (REV. 08).', v_tpl;
END;
$$;


-- =====================================================================
-- VERIFICACAO — rodar em execucao SEPARADA, apos rodar o bloco acima
-- duas vezes (idempotencia).
-- =====================================================================
--
-- SELECT s.key AS secao, f.sort_order, f.key, f.label, f.field_type,
--        f.unit, f.required, f.visible_if
-- FROM form_fields f
-- JOIN form_sections s ON s.id = f.section_id
-- WHERE s.template_id = '44bdbc61-eb00-493e-afc8-9f0df4b2d109'
-- ORDER BY s.sort_order, f.sort_order;
--
-- Esperado:
--   - 70 campos no total (69 - 2 removidos + 3 criados)
--   - revision = 'REV. 08'
--   - Pre Producao: 32 campos, scoop_datasul_descricao em 26,
--     scoop_motivo em 27
--   - Processo Mistura: 22 campos, density_mixing_* em 7-10,
--     scoop_codigo_datasul_descricao ausente
--   - Processo Envase: 9 campos, validity_divergence_reason em 5,
--     bagging_observations required=true e visible_if NULL
--   - Pos Producao: 7 campos, intocada


-- =====================================================================
-- PUBLICACAO — NAO faz parte desta migration.
-- =====================================================================
-- Apos validar visualmente em /admin/templates/:id:
--
-- SELECT public.publish_template_revision('44bdbc61-eb00-493e-afc8-9f0df4b2d109');
--
-- Arquiva a REV. 07 e publica a REV. 08 na mesma transacao. Runs
-- existentes nao sao afetados: template_snapshot congela a versao.


-- =====================================================================
-- PENDENCIAS QUE ESTA MIGRATION NAO RESOLVE
-- =====================================================================
--
-- 1. VALIDAR COM A CAMILA: existem DOIS trios de densidade no template,
--    com labels originalmente identicos ("1o Teste", "2o Teste",
--    "3o Teste", "Media"):
--      - density_test_*   em Pre Producao      (sort 28-31 apos esta migration)
--      - density_mixing_* em Processo Mistura  (sort 7-10 apos esta migration)
--    Esta migration renomeou apenas o de Processo Mistura, assumindo que
--    e o citado na ATA. Se for duplicacao acidental da REV. 07, o de Pre
--    Producao deve ser removido — decisao de Qualidade, nao tecnica.
--
-- 2. ATA: "Ocorrencia durante a mistura — Se sim, abre campo de
--    observacao." O campo 'mixing_observations' ja existe, sem
--    visible_if, no fim da secao. Nao esta claro se a ATA pede
--    condicionar esse campo ou criar um novo. Nao implementado por
--    ambiguidade.
--
-- 3. ATA acao 10: motivo de ocorrencia como lista suspensa ou campo
--    livre — pendente de decisao com o Claudio.
