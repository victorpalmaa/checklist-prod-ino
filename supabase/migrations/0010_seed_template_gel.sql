-- 0010_seed_template_gel.sql
-- Seed do template RED-029 REV. 06 — product_type 'gel'
-- Idempotente: reexecutar nao duplica nem altera template published.
--
-- PENDENTE DE VALIDACAO: os campos de gel foram extraidos do sistema
-- legado e NAO foram conferidos contra o RED-029 fisico. O template e
-- criado em 'draft' de proposito. Publicar apenas apos conferencia
-- com a area de Producao.
--
-- NOTA: heated_pulmonary_tank e traducao errada de "tanque pulmao"
-- (tanque de espera), herdada do legado. Key mantida para nao quebrar
-- eventual migracao; label em pt-BR a revisar com a Producao.
--
-- NAO existe Viscosidade 3 na REV. 06.
--
-- Os 4 campos de dados_entrada nao sao seedados: sao colunas de
-- checklist_runs, capturadas em create_run.

DO $$
DECLARE
  v_template_id uuid;
  v_section_id  uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM public.form_templates
  WHERE document_code = 'RED-029' AND revision = '06' AND product_type = 'gel';

  IF v_template_id IS NULL THEN
    INSERT INTO public.form_templates
      (document_code, revision, product_type, title, status)
    VALUES
      ('RED-029', '06', 'gel', 'Checklist de primeira produção — Gel', 'draft')
    RETURNING id INTO v_template_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.form_templates
             WHERE id = v_template_id AND status = 'published') THEN
    RAISE NOTICE 'Template % ja publicado. Seed ignorado.', v_template_id;
    RETURN;
  END IF;

  DELETE FROM public.form_sections WHERE template_id = v_template_id;

  -- pre_producao (10 + 1) ------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'pre_producao', 'Pré produção', 1)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, sort_order)
  VALUES
    (v_section_id, 'development_needed', 'Há necessidade de desenvolver o padrão?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 1),
    (v_section_id, 'order_conference', 'Conferência ordem de produção (antes da pesagem)', 'radio', NULL, true, '["Conforme","Não conforme"]'::jsonb, 2),
    (v_section_id, 'conference_date', 'Data da Conferência', 'date', NULL, true, NULL, 3),
    (v_section_id, 'datasul_code', 'Código DATASUL da estrutura (item)', 'text', NULL, true, NULL, 4),
    (v_section_id, 'packaging_1', 'Embalagem 1 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 5),
    (v_section_id, 'packaging_2', 'Embalagem 2 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 6),
    (v_section_id, 'packaging_3', 'Embalagem 3 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 7),
    (v_section_id, 'shipping_box', 'Caixa de embarque conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 8),
    (v_section_id, 'label', 'Rótulo conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 9),
    (v_section_id, 'scoop', 'Scoop conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, 10),
    (v_section_id, 'pre_production_observations', 'Observações Pré Produção', 'textarea', NULL, false, NULL, 11);

  -- processo_mistura (22) ------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'processo_mistura', 'Processo de mistura', 2)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, sort_order)
  VALUES
    (v_section_id, 'mixer_used', 'Misturador Utilizado', 'text', NULL, true, NULL, 1),
    (v_section_id, 'mixing_order', 'Ordem de Adição das Matérias Primas', 'textarea', NULL, true, NULL, 2),
    (v_section_id, 'initial_tank_temperature', 'Temperatura Inicial do Tanque', 'number', '°C', true, NULL, 3),
    (v_section_id, 'visc_tank_viscosity', 'Viscosidade Tanque', 'number', 'cP', true, NULL, 4),
    (v_section_id, 'visc_tank_temperature', 'Temperatura Tanque', 'number', '°C', true, NULL, 5),
    (v_section_id, 'visc_tank_rpm', 'RPM Tanque', 'number', NULL, true, NULL, 6),
    (v_section_id, 'visc_tank_torque', 'Torque Tanque', 'number', NULL, true, NULL, 7),
    (v_section_id, 'visc_tank_spindle', 'Spindle Tanque', 'text', NULL, true, NULL, 8),
    (v_section_id, 'visc1_viscosity', 'Viscosidade 1', 'number', 'cP', true, NULL, 9),
    (v_section_id, 'visc1_temperature', 'Temperatura 1', 'number', '°C', true, NULL, 10),
    (v_section_id, 'visc1_rpm', 'RPM 1', 'number', NULL, true, NULL, 11),
    (v_section_id, 'visc1_torque', 'Torque 1', 'number', NULL, true, NULL, 12),
    (v_section_id, 'visc1_spindle', 'Spindle 1', 'text', NULL, true, NULL, 13),
    (v_section_id, 'visc2_viscosity', 'Viscosidade 2', 'number', 'cP', true, NULL, 14),
    (v_section_id, 'visc2_temperature', 'Temperatura 2', 'number', '°C', true, NULL, 15),
    (v_section_id, 'visc2_rpm', 'RPM 2', 'number', NULL, true, NULL, 16),
    (v_section_id, 'visc2_torque', 'Torque 2', 'number', NULL, true, NULL, 17),
    (v_section_id, 'visc2_spindle', 'Spindle 2', 'text', NULL, true, NULL, 18),
    (v_section_id, 'heated_pulmonary_tank', 'Tanque de espera aquecido?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 19),
    (v_section_id, 'mixing_occurrence', 'Ocorrência durante a mistura?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 20),
    (v_section_id, 'sensorial_released', 'Sensorial liberado para produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 21),
    (v_section_id, 'mixing_observations', 'Observações', 'textarea', NULL, false, NULL, 22);

  -- processo_envase (9) --------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'processo_envase', 'Processo de envase', 3)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, sort_order)
  VALUES
    (v_section_id, 'batch_number', 'Número do Lote', 'text', NULL, true, NULL, 1),
    (v_section_id, 'production_date', 'Data de Produção', 'date', NULL, true, NULL, 2),
    (v_section_id, 'bagging_machine', 'Envasadora Utilizada', 'text', NULL, true, NULL, 3),
    (v_section_id, 'validity_correct', 'Validade correta?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 4),
    (v_section_id, 'packaging_info', 'Informações da Embalagem', 'text', NULL, true, NULL, 5),
    (v_section_id, 'package_weight', 'Peso da Embalagem', 'number', 'g', true, NULL, 6),
    (v_section_id, 'coding_location', 'Local da Codificação', 'text', NULL, true, NULL, 7),
    (v_section_id, 'bagging_occurrence', 'Ocorrência durante o envase?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 8),
    (v_section_id, 'bagging_observations', 'Observações Envase', 'textarea', NULL, false, NULL, 9);

  -- pos_producao (4) -----------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'pos_producao', 'Pós produção', 4)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, sort_order)
  VALUES
    (v_section_id, 'specification_adjustment', 'Precisamos ajustar a especificação técnica para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 1),
    (v_section_id, 'process_adjustment', 'Precisamos ajustar a carta de processo para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 2),
    (v_section_id, 'formulation_adjustment', 'Precisamos ajustar a estrutura de formulação para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, 3),
    (v_section_id, 'general_observations', 'Observações Gerais', 'textarea', NULL, false, NULL, 4);

  RAISE NOTICE 'Seed do template gel concluido: %', v_template_id;
END $$;