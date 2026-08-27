-- 0018_seed_template_gel_rev07.sql (v2 — corrige constraint de options)
-- Nova revisão do template de Gel (RED-029 REV. 07), status='draft'.
-- REV. 06 permanece published e intocada.

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
    WHERE product_type = 'gel'::public.product_type
      AND document_code = 'RED-029' AND revision = 'REV. 07'
      AND status = 'draft'::public.template_status
    LIMIT 1;
    IF v_template_id IS NOT NULL THEN
        RAISE NOTICE 'Template Gel REV.07 draft já existe (id=%), pulando.', v_template_id;
        RETURN;
    END IF;

    INSERT INTO public.form_templates (document_code, revision, product_type, title, status)
    VALUES ('RED-029', 'REV. 07', 'gel'::public.product_type, 'Checklist - Produto em Gel', 'draft'::public.template_status)
    RETURNING id INTO v_template_id;

    -- Seção 1: Pré Produção (sem Rótulo, sem Scoop)
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'pre_producao', 'Pré Produção', 1) RETURNING id INTO v_sec_pre;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, visible_if, sort_order) VALUES
    (v_sec_pre, 'development_needed', 'Há necessidade de desenvolver o padrão?', 'radio', true, '["Sim","Não"]'::jsonb, NULL, 1),
    (v_sec_pre, 'houve_alteracao_padrao', 'Houve alteração?', 'radio', false, '["Sim","Não"]'::jsonb, '{"field":"development_needed","equals":"Sim"}'::jsonb, 4),
    (v_sec_pre, 'alterou_datasul', 'Alterou no Datasul?', 'radio', false, '["Sim","Não"]'::jsonb, '{"field":"houve_alteracao_padrao","equals":"Sim"}'::jsonb, 5),
    (v_sec_pre, 'order_conference', 'Conferência ordem de produção (antes da pesagem)', 'radio', true, '["Conforme","Não conforme"]'::jsonb, NULL, 7),
    (v_sec_pre, 'packaging_1', 'Embalagem 1 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 10),
    (v_sec_pre, 'packaging_2', 'Embalagem 2 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 11),
    (v_sec_pre, 'packaging_3', 'Embalagem 3 conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 12),
    (v_sec_pre, 'shipping_box', 'Caixa de embarque conforme teste de bancada?', 'radio', true, '["Sim","Não","N/A"]'::jsonb, NULL, 13);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_pre, 'data_recebimento_padrao', 'Data de recebimento do padrão', 'date', false, '{"field":"development_needed","equals":"Sim"}'::jsonb, 2),
    (v_sec_pre, 'data_desenvolvimento_padrao', 'Data de desenvolvimento do padrão', 'date', false, '{"field":"development_needed","equals":"Sim"}'::jsonb, 3),
    (v_sec_pre, 'motivo_nao_alterou_datasul', 'Por que não alterou no Datasul?', 'textarea', false, '{"field":"alterou_datasul","equals":"Não"}'::jsonb, 6);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_pre, 'conference_date', 'Data da Conferência', 'date', true, 8),
    (v_sec_pre, 'datasul_code', 'Código DATASUL da estrutura (item)', 'text', true, 9),
    (v_sec_pre, 'pre_production_observations', 'Observações Pré Produção', 'textarea', false, 14);

    -- Seção 2: Processo Mistura
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_mistura', 'Processo Mistura', 2) RETURNING id INTO v_sec_mistura;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_mistura, 'heated_pulmonary_tank', 'Tanque de espera aquecido?', 'radio', true, '["Sim","Não"]'::jsonb, 19),
    (v_sec_mistura, 'mixing_occurrence', 'Ocorrência durante a mistura?', 'radio', true, '["Sim","Não"]'::jsonb, 21),
    (v_sec_mistura, 'sensorial_released', 'Sensorial liberado para produção?', 'radio', true, '["Sim","Não"]'::jsonb, 23);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, visible_if, sort_order) VALUES
    (v_sec_mistura, 'heated_tank_descricao', 'Descrição — Tanque de espera aquecido', 'textarea', false, '{"field":"heated_pulmonary_tank","equals":"Sim"}'::jsonb, 20),
    (v_sec_mistura, 'mixing_occurrence_descricao', 'Descrição da ocorrência na mistura', 'textarea', false, '{"field":"mixing_occurrence","equals":"Sim"}'::jsonb, 22),
    (v_sec_mistura, 'sensorial_nao_liberado_motivo', 'Motivo — Sensorial não liberado', 'textarea', false, '{"field":"sensorial_released","equals":"Não"}'::jsonb, 24);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_mistura, 'mixer_used', 'Misturador Utilizado', 'text', true, 1),
    (v_sec_mistura, 'mixing_order', 'Ordem de Adição das Matérias Primas', 'textarea', true, 2),
    (v_sec_mistura, 'initial_tank_temperature', 'Temperatura Inicial do Tanque', 'number', true, 3),
    (v_sec_mistura, 'visc_tank_viscosity', 'Viscosidade Tanque', 'number', true, 4),
    (v_sec_mistura, 'visc_tank_temperature', 'Temperatura Tanque', 'number', true, 5),
    (v_sec_mistura, 'visc_tank_rpm', 'RPM Tanque', 'number', true, 6),
    (v_sec_mistura, 'visc_tank_torque', 'Torque Tanque', 'number', true, 7),
    (v_sec_mistura, 'visc_tank_spindle', 'Spindle Tanque', 'text', true, 8),
    (v_sec_mistura, 'visc1_viscosity', 'Viscosidade 1', 'number', true, 9),
    (v_sec_mistura, 'visc1_temperature', 'Temperatura 1', 'number', true, 10),
    (v_sec_mistura, 'visc1_rpm', 'RPM 1', 'number', true, 11),
    (v_sec_mistura, 'visc1_torque', 'Torque 1', 'number', true, 12),
    (v_sec_mistura, 'visc1_spindle', 'Spindle 1', 'text', true, 13),
    (v_sec_mistura, 'visc2_viscosity', 'Viscosidade 2', 'number', true, 14),
    (v_sec_mistura, 'visc2_temperature', 'Temperatura 2', 'number', true, 15),
    (v_sec_mistura, 'visc2_rpm', 'RPM 2', 'number', true, 16),
    (v_sec_mistura, 'visc2_torque', 'Torque 2', 'number', true, 17),
    (v_sec_mistura, 'visc2_spindle', 'Spindle 2', 'text', true, 18),
    (v_sec_mistura, 'mixing_observations', 'Observações', 'textarea', false, 25);

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

    RAISE NOTICE 'Template Gel REV.07 criado: id=%', v_template_id;
END $$;
