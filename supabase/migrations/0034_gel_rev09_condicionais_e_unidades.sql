-- 0034_gel_rev09_condicionais_e_unidades.sql
--
-- Ajustes da REV. 09 de Gel, definidos na reuniao de piloto com a Camila.
-- Aplica APENAS no draft d189ecef-2942-4212-964a-b259e8c7fcc8 (REV. 09).
-- Todo comando e restrito por template_id: nunca toca template publicado.
--
-- IDEMPOTENCIA: form_fields nao tem unique visivel em (section_id, key).
-- Cada INSERT usa WHERE NOT EXISTS; cada shift de sort_order so roda
-- enquanto o campo novo ainda nao existe. Rodar duas vezes e seguro.
--
-- DUAS CHAVES SAO SUBSTITUIDAS, nao editadas:
--   heated_tank_descricao       -> heated_tank_temperature
--   sensorial_nao_liberado_motivo -> sensorial_plano_acao
-- Motivo: a primeira muda de textarea para number; a segunda inverte a
-- condicao de visibilidade e o significado. Chave que passa a descrever
-- outra coisa quebra a rastreabilidade do dado entre revisoes.

BEGIN;

-- ============ PRE-PRODUCAO ============

-- ---------- 1. OBS quando NAO ha necessidade de padrao ----------
-- development_needed e sort_order 1; o novo campo entra em 2.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND f.sort_order >= 2
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id AND x.key = 'motivo_nao_necessidade_padrao'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'motivo_nao_necessidade_padrao', 'Motivo da não necessidade',
       'textarea'::field_type, false,
       '{"field":"development_needed","equals":"Não"}'::jsonb, 2
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'motivo_nao_necessidade_padrao'
  );

-- ---------- 2. Motivo quando conferencia da OP e NAO CONFORME ----------
-- Apos o shift acima, order_conference esta em 8. O novo campo entra em 9.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND f.sort_order >= 9
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id AND x.key = 'order_conference_motivo'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'order_conference_motivo', 'Motivo da não conformidade — Conferência da OP',
       'textarea'::field_type, false,
       '{"field":"order_conference","equals":"Não conforme"}'::jsonb, 9
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'order_conference_motivo'
  );

-- ---------- 3. Tres vias em embalagens e caixa de embarque ----------
-- Apos os dois shifts: packaging_1=12, packaging_2=13, packaging_3=14,
-- shipping_box=15, pre_production_observations=16.
-- Cada radio ganha um par (Datasul quando Sim, motivo quando Nao).
-- Reordenacao completa da faixa para intercalar os pares.

UPDATE form_fields f
SET sort_order = 100 + f.sort_order
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND f.key IN ('packaging_1','packaging_2','packaging_3','shipping_box','pre_production_observations')
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id AND x.key = 'packaging_1_datasul_descricao'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, v.key, v.label, 'textarea'::field_type, false, v.vis, v.ord
FROM form_sections s
CROSS JOIN (VALUES
  ('packaging_1_datasul_descricao', 'Código Datasul e descrição — Embalagem 1',      '{"field":"packaging_1","equals":"Sim"}'::jsonb, 13),
  ('packaging_1_motivo',            'Motivo da não conformidade — Embalagem 1',      '{"field":"packaging_1","equals":"Não"}'::jsonb, 14),
  ('packaging_2_datasul_descricao', 'Código Datasul e descrição — Embalagem 2',      '{"field":"packaging_2","equals":"Sim"}'::jsonb, 16),
  ('packaging_2_motivo',            'Motivo da não conformidade — Embalagem 2',      '{"field":"packaging_2","equals":"Não"}'::jsonb, 17),
  ('packaging_3_datasul_descricao', 'Código Datasul e descrição — Embalagem 3',      '{"field":"packaging_3","equals":"Sim"}'::jsonb, 19),
  ('packaging_3_motivo',            'Motivo da não conformidade — Embalagem 3',      '{"field":"packaging_3","equals":"Não"}'::jsonb, 20),
  ('shipping_box_datasul_descricao','Código Datasul e descrição — Caixa de embarque','{"field":"shipping_box","equals":"Sim"}'::jsonb, 22),
  ('shipping_box_motivo',           'Motivo da não conformidade — Caixa de embarque','{"field":"shipping_box","equals":"Não"}'::jsonb, 23)
) AS v(key, label, vis, ord)
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = v.key
  );

-- Os campos parqueados em 100+ voltam nas posicoes definitivas.
UPDATE form_fields f SET sort_order = 12 FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao' AND f.key = 'packaging_1' AND f.sort_order > 100;

UPDATE form_fields f SET sort_order = 15 FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao' AND f.key = 'packaging_2' AND f.sort_order > 100;

UPDATE form_fields f SET sort_order = 18 FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao' AND f.key = 'packaging_3' AND f.sort_order > 100;

UPDATE form_fields f SET sort_order = 21 FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao' AND f.key = 'shipping_box' AND f.sort_order > 100;

UPDATE form_fields f SET sort_order = 24 FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'pre_producao' AND f.key = 'pre_production_observations' AND f.sort_order > 100;

-- ============ PROCESSO MISTURA ============

-- ---------- 4. Unidades ----------

UPDATE form_fields f SET unit = '°C'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key IN ('initial_tank_temperature','visc_tank_temperature','visc1_temperature','visc2_temperature');

UPDATE form_fields f SET unit = 'cP'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key IN ('visc_tank_viscosity','visc1_viscosity','visc2_viscosity');

UPDATE form_fields f SET unit = '%'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key IN ('visc_tank_torque','visc1_torque','visc2_torque');

UPDATE form_fields f SET unit = 'rpm'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key IN ('visc_tank_rpm','visc1_rpm','visc2_rpm');

-- ---------- 5. Tanque aquecido: textarea vira medida ----------

INSERT INTO form_fields (section_id, key, label, field_type, unit, required, visible_if, sort_order)
SELECT s.id, 'heated_tank_temperature', 'Temperatura do tanque',
       'number'::field_type, '°C', false,
       '{"field":"heated_pulmonary_tank","equals":"Sim"}'::jsonb, 20
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'heated_tank_temperature'
  );

DELETE FROM form_fields f
USING form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key = 'heated_tank_descricao';

-- ---------- 6. Sensorial: campo passa a abrir no SIM ----------

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'sensorial_plano_acao', 'Descrever plano de ação',
       'textarea'::field_type, false,
       '{"field":"sensorial_released","equals":"Sim"}'::jsonb, 24
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'sensorial_plano_acao'
  );

DELETE FROM form_fields f
USING form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_mistura'
  AND f.key = 'sensorial_nao_liberado_motivo';

-- ============ PROCESSO ENVASE ============

-- ---------- 7. Motivo quando validade divergente ----------
-- validity_correct e 4; o novo campo entra em 5.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_envase'
  AND f.sort_order >= 5
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id AND x.key = 'validity_divergence_reason'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'validity_divergence_reason', 'Motivo da divergência',
       'textarea'::field_type, false,
       '{"field":"validity_correct","equals":"Não"}'::jsonb, 5
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_envase'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'validity_divergence_reason'
  );

-- ---------- 8. Unidade do peso da embalagem ----------

UPDATE form_fields f SET unit = 'g'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_envase' AND f.key = 'package_weight';

-- ---------- 9. Relabel da observacao condicional ----------

UPDATE form_fields f SET label = 'Descrição da ocorrência'
FROM form_sections s
WHERE f.section_id = s.id AND s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_envase' AND f.key = 'bagging_observations';

-- ---------- 10. Campo livre de observacoes no fim ----------

INSERT INTO form_fields (section_id, key, label, field_type, required, sort_order)
SELECT s.id, 'bagging_free_observations', 'Observações envase',
       'textarea'::field_type, false, 11
FROM form_sections s
WHERE s.template_id = 'd189ecef-2942-4212-964a-b259e8c7fcc8'
  AND s.key = 'processo_envase'
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = s.id AND x.key = 'bagging_free_observations'
  );

COMMIT;
