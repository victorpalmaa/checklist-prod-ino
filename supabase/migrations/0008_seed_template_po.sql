-- 0008_seed_template_po.sql
-- Seed do template RED-029 REV. 06 — product_type 'po'
-- Idempotente: reexecutar não duplica nem altera template published.
--
-- NOTA: os 4 campos de dados_entrada (product_name, client,
-- formulation_code, accompaniment_reason) NAO sao seedados como
-- form_fields. Sao colunas de checklist_runs, capturadas na criacao
-- do run via create_run(). Seedar como field criaria duas fontes de
-- verdade para o mesmo dado.
--
-- batch_number e production_date SAO seedados em processo_envase
-- porque sao preenchidos durante o envase, mas o DynamicForm deve
-- escreve-los na COLUNA de checklist_runs, nao em run_values.

DO $$
DECLARE
  v_template_id uuid;
  v_section_id  uuid;
BEGIN
  -- Template ------------------------------------------------------
  SELECT id INTO v_template_id
  FROM public.form_templates
  WHERE document_code = 'RED-029'
    AND revision      = '06'
    AND product_type  = 'po';

  IF v_template_id IS NULL THEN
    INSERT INTO public.form_templates
      (document_code, revision, product_type, title, status)
    VALUES
      ('RED-029', '06', 'po',
       'Checklist de primeira produção — Pó', 'draft')
    RETURNING id INTO v_template_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.form_templates
    WHERE id = v_template_id AND status = 'published'
  ) THEN
    RAISE NOTICE 'Template % ja publicado. Seed ignorado.', v_template_id;
    RETURN;
  END IF;

  DELETE FROM public.form_sections WHERE template_id = v_template_id;

  -- pre_producao --------------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'pre_producao', 'Pré produção', 1)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, computed_from, sort_order)
  VALUES
    (v_section_id, 'development_needed', 'Há necessidade de desenvolver o padrão?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 1),
    (v_section_id, 'order_conference', 'Conferência ordem de produção (antes da pesagem)', 'radio', NULL, true, '["Conforme","Não conforme"]'::jsonb, NULL, 2),
    (v_section_id, 'conference_date', 'Data da Conferência', 'date', NULL, true, NULL, NULL, 3),
    (v_section_id, 'datasul_code', 'Código DATASUL da estrutura (item)', 'text', NULL, true, NULL, NULL, 4),
    (v_section_id, 'packaging_1', 'Embalagem 1 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 5),
    (v_section_id, 'packaging_2', 'Embalagem 2 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 6),
    (v_section_id, 'packaging_3', 'Embalagem 3 conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 7),
    (v_section_id, 'shipping_box', 'Caixa de embarque conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 8),
    (v_section_id, 'label', 'Rótulo conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 9),
    (v_section_id, 'scoop', 'Scoop conforme teste de bancada?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 10),
    (v_section_id, 'density_test_1', '1º Teste', 'number', 'g/cm³', false, NULL, NULL, 11),
    (v_section_id, 'density_test_2', '2º Teste', 'number', 'g/cm³', false, NULL, NULL, 12),
    (v_section_id, 'density_test_3', '3º Teste', 'number', 'g/cm³', false, NULL, NULL, 13),
    (v_section_id, 'density_average', 'Média', 'computed_avg', 'g/cm³', false, NULL, '["density_test_1","density_test_2","density_test_3"]'::jsonb, 14),
    (v_section_id, 'pre_production_observations', 'Observações Pré Produção', 'textarea', NULL, false, NULL, NULL, 15);

  -- processo_mistura ----------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'processo_mistura', 'Processo de mistura', 2)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, computed_from, sort_order)
  VALUES
    (v_section_id, 'mixer_used', 'Misturador Utilizado', 'text', NULL, true, NULL, NULL, 1),
    (v_section_id, 'mixing_order', 'Ordem de Mistura (detalhar)', 'textarea', NULL, true, NULL, NULL, 2),
    (v_section_id, 'room_temperature', 'Temperatura Sala de Mistura', 'number', '°C', true, NULL, NULL, 3),
    (v_section_id, 'relative_humidity', 'Umidade Relativa da Sala', 'number', '%', true, NULL, NULL, 4),
    (v_section_id, 'mixing_time', 'Tempo de Mistura', 'number', 'min', true, NULL, NULL, 5),
    (v_section_id, 'mixing_occurrence', 'Foi detectada alguma ocorrência durante a mistura?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 6),
    (v_section_id, 'scoop_conform', 'Scoop conforme teste?', 'radio', NULL, true, '["Sim","Não","N/A"]'::jsonb, NULL, 7),
    (v_section_id, 'sensorial_released', 'Sensorial liberado para produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 8),
    (v_section_id, 'mixing_observations', 'Observações Mistura', 'textarea', NULL, false, NULL, NULL, 9),
    (v_section_id, 'density_mixing_1', '1º Teste', 'number', 'g/cm³', false, NULL, NULL, 10),
    (v_section_id, 'density_mixing_2', '2º Teste', 'number', 'g/cm³', false, NULL, NULL, 11),
    (v_section_id, 'density_mixing_3', '3º Teste', 'number', 'g/cm³', false, NULL, NULL, 12),
    (v_section_id, 'density_mixing_average', 'Média', 'computed_avg', 'g/cm³', false, NULL, '["density_mixing_1","density_mixing_2","density_mixing_3"]'::jsonb, 13);

  -- processo_envase -----------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'processo_envase', 'Processo de envase', 3)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, computed_from, sort_order)
  VALUES
    (v_section_id, 'batch_number', 'Número do Lote', 'text', NULL, true, NULL, NULL, 1),
    (v_section_id, 'production_date', 'Data de Produção', 'date', NULL, true, NULL, NULL, 2),
    (v_section_id, 'bagging_machine', 'Envasadora Utilizada', 'text', NULL, true, NULL, NULL, 3),
    (v_section_id, 'validity_correct', 'Validade correta?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 4),
    (v_section_id, 'packaging_info', 'Informações da Embalagem', 'text', NULL, true, NULL, NULL, 5),
    (v_section_id, 'package_weight', 'Peso da Embalagem', 'number', 'g', true, NULL, NULL, 6),
    (v_section_id, 'coding_location', 'Local da Codificação', 'text', NULL, true, NULL, NULL, 7),
    (v_section_id, 'bagging_occurrence', 'Ocorrência durante o envase?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 8),
    (v_section_id, 'bagging_observations', 'Observações Envase', 'textarea', NULL, false, NULL, NULL, 9);

  -- pos_producao --------------------------------------------------
  INSERT INTO public.form_sections (template_id, key, title, sort_order)
  VALUES (v_template_id, 'pos_producao', 'Pós produção', 4)
  RETURNING id INTO v_section_id;

  INSERT INTO public.form_fields
    (section_id, key, label, field_type, unit, required, options, computed_from, sort_order)
  VALUES
    (v_section_id, 'specification_adjustment', 'Precisamos ajustar a especificação técnica para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 1),
    (v_section_id, 'process_adjustment', 'Precisamos ajustar a carta de processo para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 2),
    (v_section_id, 'formulation_adjustment', 'Precisamos ajustar a estrutura de formulação para a próxima produção?', 'radio', NULL, true, '["Sim","Não"]'::jsonb, NULL, 3),
    (v_section_id, 'general_observations', 'Observações Gerais', 'textarea', NULL, false, NULL, NULL, 4);

  RAISE NOTICE 'Seed do template po concluido: %', v_template_id;
END $$;