-- 0016_seed_template_capsula.sql
-- Seed do template de Cápsula, RED-029 REV. 06, mapeado a partir do
-- checklist real (documento de 13/08/2026, produto "Cápsula NAC").
-- 5 seções, 36 campos (incluindo 1 computed_avg). status = 'draft' de
-- propósito — revisão humana antes de publicar.
--
-- Corrige tentativa anterior: form_fields_options_required_for_enum_types
-- exige que campos radio/select já nasçam com options preenchido no
-- INSERT — não é permitido INSERT sem options seguido de UPDATE.
--
-- Não seedados como form_fields (capturados na criação, colunas de
-- checklist_runs, mesmo padrão de Pó/Gel):
--   product_name, client, formulation_code, accompaniment_reason
-- Seedados como campos especiais (SPECIAL_FIELD_KEYS no DynamicForm,
-- gravam em coluna, não em run_values):
--   batch_number, production_date (seção processo_envase_po_capsula)
--
-- Condicionais (visible_if, requer 0014+0015 aplicadas):
--   observacoes_mistura       visível se ocorrencia_mistura = "Sim"
--   observacoes_envase        visível se ocorrencia_envase = "Sim"
--   observacoes_envase_pote   visível se ocorrencia_envase_pote = "Sim"

DO $$
DECLARE
    v_template_id uuid;
    v_sec_pre uuid;
    v_sec_mistura uuid;
    v_sec_envase_po uuid;
    v_sec_envase_pote uuid;
    v_sec_pos uuid;
BEGIN
    SELECT id INTO v_template_id
    FROM public.form_templates
    WHERE product_type = 'capsula'::public.product_type
      AND document_code = 'RED-029'
      AND revision = 'REV. 06'
      AND status = 'draft'::public.template_status
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        RAISE NOTICE 'Template de Cápsula draft já existe (id=%), pulando seed.', v_template_id;
        RETURN;
    END IF;

    INSERT INTO public.form_templates (document_code, revision, product_type, title, status)
    VALUES ('RED-029', 'REV. 06', 'capsula'::public.product_type, 'Checklist - Produto em Cápsula', 'draft'::public.template_status)
    RETURNING id INTO v_template_id;

    -- Seção 1: Pré Produção
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'pre_producao', 'Pré Produção', 1)
    RETURNING id INTO v_sec_pre;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_pre, 'conferencia_ordem_producao', 'Conferência ordem de produção (antes da pesagem)', 'radio', true, '["Conforme", "Não conforme"]'::jsonb, 1),
    (v_sec_pre, 'capsula_vazia_conforme', 'Cápsula vazia conforme?', 'radio', true, '["Sim", "Não"]'::jsonb, 4),
    (v_sec_pre, 'pote_conforme', 'Pote conforme?', 'radio', true, '["Sim", "Não"]'::jsonb, 6),
    (v_sec_pre, 'tampa_conforme', 'Tampa conforme?', 'radio', true, '["Sim", "Não"]'::jsonb, 8),
    (v_sec_pre, 'caixa_embarque_conforme', 'Caixa de embarque conforme?', 'radio', true, '["Sim", "Não"]'::jsonb, 10),
    (v_sec_pre, 'rotulo_conforme', 'Rótulo conforme?', 'radio', true, '["Sim", "Não"]'::jsonb, 11);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_pre, 'data_conferencia', 'Data da Conferência', 'date', true, 2),
    (v_sec_pre, 'codigo_datasul_estrutura', 'Código DATASUL da estrutura (item)', 'text', true, 3),
    (v_sec_pre, 'capsula_vazia_codigo', 'Cápsula vazia — código', 'text', false, 5),
    (v_sec_pre, 'pote_codigo', 'Pote — código', 'text', false, 7),
    (v_sec_pre, 'tampa_codigo', 'Tampa — código', 'text', false, 9),
    (v_sec_pre, 'observacoes_pre_producao', 'Observações pré-produção', 'textarea', false, 12);

    -- Seção 2: Processo Mistura (pó na cápsula)
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_mistura', 'Processo Mistura (Pó na Cápsula)', 2)
    RETURNING id INTO v_sec_mistura;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_mistura, 'ocorrencia_mistura', 'Ocorrência durante a mistura?', 'radio', true, '["Sim", "Não"]'::jsonb, 8);

    INSERT INTO public.form_fields (section_id, key, label, field_type, unit, required, sort_order) VALUES
    (v_sec_mistura, 'misturador_utilizado', 'Misturador Utilizado', 'text', NULL, true, 1),
    (v_sec_mistura, 'ordem_mistura', 'Ordem de Adição das Matérias Primas', 'textarea', NULL, true, 2),
    (v_sec_mistura, 'tempo_mistura', 'Tempo de Mistura', 'number', 'min', true, 3),
    (v_sec_mistura, 'densidade_aparente_1', 'Densidade Aparente 1', 'number', NULL, true, 4),
    (v_sec_mistura, 'densidade_aparente_2', 'Densidade Aparente 2', 'number', NULL, true, 5),
    (v_sec_mistura, 'densidade_aparente_3', 'Densidade Aparente 3', 'number', NULL, true, 6),
    (v_sec_mistura, 'observacoes_mistura', 'Observações mistura', 'textarea', NULL, false, 9);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, computed_from, sort_order) VALUES
    (v_sec_mistura, 'densidade_aparente_media', 'Densidade Aparente Média', 'computed_avg', false,
     '["densidade_aparente_1", "densidade_aparente_2", "densidade_aparente_3"]'::jsonb, 7);

    UPDATE public.form_fields SET visible_if = '{"field": "ocorrencia_mistura", "equals": "Sim"}'::jsonb
    WHERE section_id = v_sec_mistura AND key = 'observacoes_mistura';

    -- Seção 3: Processo Envase (pó na cápsula)
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_envase_po_capsula', 'Processo Envase (Pó na Cápsula)', 3)
    RETURNING id INTO v_sec_envase_po;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_envase_po, 'ocorrencia_envase', 'Ocorrência durante o envase?', 'radio', true, '["Sim", "Não"]'::jsonb, 4);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_envase_po, 'batch_number', 'Número do Lote', 'text', true, 1),
    (v_sec_envase_po, 'production_date', 'Data de Produção', 'date', true, 2),
    (v_sec_envase_po, 'responsavel_envase', 'Envasadora Utilizada', 'text', true, 3),
    (v_sec_envase_po, 'observacoes_envase', 'Observações envase', 'textarea', false, 5);

    UPDATE public.form_fields SET visible_if = '{"field": "ocorrencia_envase", "equals": "Sim"}'::jsonb
    WHERE section_id = v_sec_envase_po AND key = 'observacoes_envase';

    -- Seção 4: Processo Envase (cápsula no pote)
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'processo_envase_capsula_pote', 'Processo Envase (Cápsula no Pote)', 4)
    RETURNING id INTO v_sec_envase_pote;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_envase_pote, 'ocorrencia_envase_pote', 'Ocorrência durante o envase?', 'radio', true, '["Sim", "Não"]'::jsonb, 2);

    INSERT INTO public.form_fields (section_id, key, label, field_type, unit, required, sort_order) VALUES
    (v_sec_envase_pote, 'quantidade_capsulas_pote', 'Quantidade de Cápsulas por Pote', 'number', 'un', true, 1),
    (v_sec_envase_pote, 'observacoes_envase_pote', 'Observações envase (pote)', 'textarea', NULL, false, 3);

    UPDATE public.form_fields SET visible_if = '{"field": "ocorrencia_envase_pote", "equals": "Sim"}'::jsonb
    WHERE section_id = v_sec_envase_pote AND key = 'observacoes_envase_pote';

    -- Seção 5: Pós Produção
    INSERT INTO public.form_sections (template_id, key, title, sort_order)
    VALUES (v_template_id, 'pos_producao', 'Pós Produção', 5)
    RETURNING id INTO v_sec_pos;

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, options, sort_order) VALUES
    (v_sec_pos, 'ajuste_especificacao_tecnica', 'Precisamos ajustar a especificação técnica para a próxima produção?', 'radio', true, '["Sim", "Não"]'::jsonb, 1),
    (v_sec_pos, 'ajuste_carta_processo', 'Precisamos ajustar a carta de processo para a próxima produção?', 'radio', true, '["Sim", "Não"]'::jsonb, 2),
    (v_sec_pos, 'ajuste_estrutura_formulacao', 'Precisamos ajustar a estrutura de formulação para a próxima produção?', 'radio', true, '["Sim", "Não"]'::jsonb, 3),
    (v_sec_pos, 'verificacao_inovacao_capsula', 'Verificação Inovação', 'radio', false, '["Sim", "Não"]'::jsonb, 7);

    INSERT INTO public.form_fields (section_id, key, label, field_type, required, sort_order) VALUES
    (v_sec_pos, 'responsavel_producao', 'Responsável Produção', 'text', false, 4),
    (v_sec_pos, 'responsavel_qualidade_capsula', 'Responsável Qualidade', 'text', false, 5),
    (v_sec_pos, 'responsavel_inovacao_capsula', 'Responsável Inovação', 'text', false, 6);

    RAISE NOTICE 'Template de Cápsula criado com sucesso: id=%', v_template_id;
END $$;
