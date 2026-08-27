-- 0017_seed_template_po_rev07.sql
-- Nova revisão do template de Pó (RED-029 REV. 07), status='draft'.
-- REV. 06 permanece published e intocada — runs existentes mantêm seu
-- template_snapshot congelado. Publicação é etapa manual separada,
-- após revisão humana.
--
-- Mudanças vs REV. 06 (41 -> 69 campos):
-- - Cascata "Padrão" (5 campos condicionais após development_needed)
-- - 5 campos de embalagem/rótulo/caixa recebem par condicional
--   (código Datasul+descrição se Sim / motivo se Não)
-- - scoop_conform substituído por fluxo completo (teste + teste
--   consumidor + conforme, 11 campos)
-- - bagging_observations vira condicional (visível se ocorrência=Sim)
-- - 3 campos de "ajuste" em pós-produção ganham descrição condicional

DO $$
DECLARE
    v_template_id uuid;
    v_sec_pre uuid;
    v_sec_mistura uuid;
    v_sec_envase uuid;
    v_sec_pos uuid;
BEGIN
    SELECT id INTO v_template_id
    FROM public.form_templates
    WHERE product_type = 'po'::public.product_type
      AND document_code = 'RED-029' AND revision = 'REV. 07'
      AND status = 'draft'::public.template_status
    LIMIT 1;
    IF v_template_id IS NOT NULL THEN
        RAISE NOTICE 'Template Pó REV.07 draft já existe (id=%), pulando.', v_template_id;
        RETURN;
    END IF;

    INSERT INTO public.form_templates (document_code, revision, product_type, title, status)
    VALUES ('RED-029', 'REV. 07', 'po'::public.product_type, 'Checklist - Produto em Pó', 'draft'::public.template_status)
    RETURNING id INTO v_template_id;

    -- Seção 1: Pré Produção
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'pre_producao', 'Pré Produção', 1) RETURNING id INTO v_sec_pre;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, visible_if, sort_order) VALUES
    (v_sec_pre, 'development_needed', 'Há necessidade de desenvolver o padrão?', 'radio', true, '["Sim","Não"]'::jsonb, NULL, 1),
    (v_sec_pre, 'houve_alteracao_padrao', 'Houve alteração?', 'radio', false, '["Sim","Não"]'::jsonb, '{"field":"development_needed","equals":"Sim"}'::jsonb, 4),
    (v_sec_pre, 'alterou_datasul', 'Alterou no Datasul?', 'radio', false, '["Sim","Não"]'::jsonb, '{"field":"houve_alteracao_padrao","equals":"Sim"}'::jsonb, 5),
    (v_sec_pre, 'order_conference', 'Conferência ordem de produção (antes da pesagem)', 'radio', true, '["Conforme","Não conforme"]'::jsonb, NULL, 7),
    (v_sec_pre, 'packaging_1', 'Embalagem 1 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 10),
    (v_sec_pre, 'packaging_2', 'Embalagem 2 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 13),
    (v_sec_pre, 'packaging_3', 'Embalagem 3 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 16),
    (v_sec_pre, 'shipping_box', 'Caixa de embarque conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 19),
    (v_sec_pre, 'label', 'Rótulo conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 22),
    (v_sec_pre, 'scoop', 'Scoop conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 25);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_pre, 'data_recebimento_padrao', 'Data de recebimento do padrão', 'date', false, '{"field":"development_needed","equals":"Sim"}'::jsonb, 2),
    (v_sec_pre, 'data_desenvolvimento_padrao', 'Data de desenvolvimento do padrão', 'date', false, '{"field":"development_needed","equals":"Sim"}'::jsonb, 3),
    (v_sec_pre, 'motivo_nao_alterou_datasul', 'Por que não alterou no Datasul?', 'textarea', false, '{"field":"alterou_datasul","equals":"Não"}'::jsonb, 6),
    (v_sec_pre, 'packaging_1_datasul_descricao', 'Código Datasul e descrição — Embalagem 1', 'text', false, '{"field":"packaging_1","equals":"Sim"}'::jsonb, 11),
    (v_sec_pre, 'packaging_1_motivo', 'Motivo da não conformidade — Embalagem 1', 'textarea', false, '{"field":"packaging_1","equals":"Não"}'::jsonb, 12),
    (v_sec_pre, 'packaging_2_datasul_descricao', 'Código Datasul e descrição — Embalagem 2', 'text', false, '{"field":"packaging_2","equals":"Sim"}'::jsonb, 14),
    (v_sec_pre, 'packaging_2_motivo', 'Motivo da não conformidade — Embalagem 2', 'textarea', false, '{"field":"packaging_2","equals":"Não"}'::jsonb, 15),
    (v_sec_pre, 'packaging_3_datasul_descricao', 'Código Datasul e descrição — Embalagem 3', 'text', false, '{"field":"packaging_3","equals":"Sim"}'::jsonb, 17),
    (v_sec_pre, 'packaging_3_motivo', 'Motivo da não conformidade — Embalagem 3', 'textarea', false, '{"field":"packaging_3","equals":"Não"}'::jsonb, 18),
    (v_sec_pre, 'shipping_box_datasul_descricao', 'Código Datasul e descrição — Caixa de embarque', 'text', false, '{"field":"shipping_box","equals":"Sim"}'::jsonb, 20),
    (v_sec_pre, 'shipping_box_motivo', 'Motivo da não conformidade — Caixa de embarque', 'textarea', false, '{"field":"shipping_box","equals":"Não"}'::jsonb, 21),
    (v_sec_pre, 'label_datasul_descricao', 'Código Datasul e descrição — Rótulo', 'text', false, '{"field":"label","equals":"Sim"}'::jsonb, 23),
    (v_sec_pre, 'label_motivo', 'Motivo da não conformidade — Rótulo', 'textarea', false, '{"field":"label","equals":"Não"}'::jsonb, 24);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_pre, 'conference_date', 'Data da Conferência', 'date', true, 8),
    (v_sec_pre, 'datasul_code', 'Código DATASUL da estrutura (item)', 'text', true, 9),
    (v_sec_pre, 'density_test_1', '1º Teste', 'number', false, 26),
    (v_sec_pre, 'density_test_2', '2º Teste', 'number', false, 27),
    (v_sec_pre, 'density_test_3', '3º Teste', 'number', false, 28),
    (v_sec_pre, 'pre_production_observations', 'Observações Pré Produção', 'textarea', false, 30);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, computed_from, sort_order) VALUES
    (v_sec_pre, 'density_average', 'Média', 'computed_avg', false, '["density_test_1","density_test_2","density_test_3"]'::jsonb, 29);

    -- Seção 2: Processo Mistura
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_mistura', 'Processo Mistura', 2) RETURNING id INTO v_sec_mistura;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_mistura, 'mixing_occurrence', 'Foi detectada alguma ocorrência durante a mistura?', 'radio', true, '["Sim","Não"]'::jsonb, 6),
    (v_sec_mistura, 'scoop_conforme_teste', 'Scoop conforme teste?', 'radio', true, '["Sim","Não"]'::jsonb, 15),
    (v_sec_mistura, 'sensorial_released', 'Sensorial liberado para produção?', 'radio', true, '["Sim","Não"]'::jsonb, 18);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_mistura, 'scoop_codigo_datasul_descricao', 'Código Datasul e descrição', 'text', false, '{"field":"scoop_conforme_teste","equals":"Sim"}'::jsonb, 16),
    (v_sec_mistura, 'scoop_motivo_nao_conformidade', 'Motivo da não conformidade', 'textarea', false, '{"field":"scoop_conforme_teste","equals":"Não"}'::jsonb, 17);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_mistura, 'mixer_used', 'Misturador Utilizado', 'text', true, 1),
    (v_sec_mistura, 'mixing_order', 'Ordem de Mistura (detalhar)', 'textarea', true, 2),
    (v_sec_mistura, 'room_temperature', 'Temperatura Sala de Mistura', 'number', true, 3),
    (v_sec_mistura, 'relative_humidity', 'Umidade Relativa da Sala', 'number', true, 4),
    (v_sec_mistura, 'mixing_time', 'Tempo de Mistura', 'number', true, 5),
    (v_sec_mistura, 'teste_scoop_1', 'Teste Scoop 1', 'number', false, 7),
    (v_sec_mistura, 'teste_scoop_2', 'Teste Scoop 2', 'number', false, 8),
    (v_sec_mistura, 'teste_scoop_3', 'Teste Scoop 3', 'number', false, 9),
    (v_sec_mistura, 'teste_scoop_consumidor_1', 'Teste Scoop Consumidor 1', 'number', false, 11),
    (v_sec_mistura, 'teste_scoop_consumidor_2', 'Teste Scoop Consumidor 2', 'number', false, 12),
    (v_sec_mistura, 'teste_scoop_consumidor_3', 'Teste Scoop Consumidor 3', 'number', false, 13),
    (v_sec_mistura, 'mixing_observations', 'Observações Mistura', 'textarea', false, 19),
    (v_sec_mistura, 'density_mixing_1', '1º Teste', 'number', false, 20),
    (v_sec_mistura, 'density_mixing_2', '2º Teste', 'number', false, 21),
    (v_sec_mistura, 'density_mixing_3', '3º Teste', 'number', false, 22);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, computed_from, sort_order) VALUES
    (v_sec_mistura, 'teste_scoop_media', 'Média Teste Scoop', 'computed_avg', false, '["teste_scoop_1","teste_scoop_2","teste_scoop_3"]'::jsonb, 10),
    (v_sec_mistura, 'teste_scoop_consumidor_media', 'Média Teste Scoop Consumidor', 'computed_avg', false, '["teste_scoop_consumidor_1","teste_scoop_consumidor_2","teste_scoop_consumidor_3"]'::jsonb, 14),
    (v_sec_mistura, 'density_mixing_average', 'Média', 'computed_avg', false, '["density_mixing_1","density_mixing_2","density_mixing_3"]'::jsonb, 23);

    -- Seção 3: Processo Envase
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_envase', 'Processo Envase', 3) RETURNING id INTO v_sec_envase;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_envase, 'validity_correct', 'Validade correta?', 'radio', true, '["Sim","Não"]'::jsonb, 4),
    (v_sec_envase, 'bagging_occurrence', 'Ocorrência durante o envase?', 'radio', true, '["Sim","Não"]'::jsonb, 8);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_envase, 'bagging_observations', 'Observações Envase', 'textarea', false, '{"field":"bagging_occurrence","equals":"Sim"}'::jsonb, 9);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_envase, 'batch_number', 'Número do Lote', 'text', true, 1),
    (v_sec_envase, 'production_date', 'Data de Produção', 'date', true, 2),
    (v_sec_envase, 'bagging_machine', 'Envasadora Utilizada', 'text', true, 3),
    (v_sec_envase, 'packaging_info', 'Informações da Embalagem', 'text', true, 5),
    (v_sec_envase, 'package_weight', 'Peso da Embalagem', 'number', true, 6),
    (v_sec_envase, 'coding_location', 'Local da Codificação', 'text', true, 7);

    -- Seção 4: Pós Produção
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'pos_producao', 'Pós Produção', 4) RETURNING id INTO v_sec_pos;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_pos, 'specification_adjustment', 'Precisamos ajustar a especificação técnica para a próxima produção?', 'radio', true, '["Sim","Não"]'::jsonb, 1),
    (v_sec_pos, 'process_adjustment', 'Precisamos ajustar a carta de processo para a próxima produção?', 'radio', true, '["Sim","Não"]'::jsonb, 3),
    (v_sec_pos, 'formulation_adjustment', 'Precisamos ajustar a estrutura de formulação para a próxima produção?', 'radio', true, '["Sim","Não"]'::jsonb, 5);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_pos, 'specification_adjustment_descricao', 'Descrição do ajuste — Especificação técnica', 'textarea', false, '{"field":"specification_adjustment","equals":"Sim"}'::jsonb, 2),
    (v_sec_pos, 'process_adjustment_descricao', 'Descrição do ajuste — Carta de processo', 'textarea', false, '{"field":"process_adjustment","equals":"Sim"}'::jsonb, 4),
    (v_sec_pos, 'formulation_adjustment_descricao', 'Descrição do ajuste — Estrutura de formulação', 'textarea', false, '{"field":"formulation_adjustment","equals":"Sim"}'::jsonb, 6);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_pos, 'general_observations', 'Observações Gerais', 'textarea', false, 7);

    RAISE NOTICE 'Template Pó REV.07 criado: id=%', v_template_id;
END $$;
