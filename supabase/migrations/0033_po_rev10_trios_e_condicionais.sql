-- 0033_po_rev10_trios_e_condicionais.sql
--
-- Ajustes da REV. 10 de Po, definidos na reuniao de piloto com a Camila.
-- Aplica APENAS no draft 5641e4d5-6ea5-4381-92c3-bc31620dfa58 (REV. 10).
-- Todo comando e restrito por template_id: nunca toca template publicado.
--
-- 1. Pre-producao ganha os tres blocos de teste no padrao da secao de
--    Mistura: densidade (g/cm3), scoop padrao (g), simulacao consumidor (g).
--    O trio existente (density_test_*) JA e densidade — as chaves dizem
--    isso. So faltavam label e unidade. Reaproveitar em vez de recriar
--    preserva a rastreabilidade do dado entre revisoes.
-- 2. Campo de OBS quando nao ha necessidade de desenvolver padrao.
-- 3. Campo de OBS quando ha ocorrencia na mistura.
-- 4. Campo de motivo quando ha ocorrencia no envase.
-- 5. "Motivo da nao conformidade" do scoop vira "Descrever plano de acao".
--
-- Idempotente: UPDATEs sao naturalmente idempotentes; INSERTs usam
-- ON CONFLICT DO NOTHING sobre (section_id, key).

BEGIN;

-- ---------- 1. Pre-producao: densidade ganha label e unidade ----------

UPDATE form_fields f
SET label = '1º teste de densidade', unit = 'g/cm³'
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'density_test_1';

UPDATE form_fields f
SET label = '2º teste de densidade', unit = 'g/cm³'
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'density_test_2';

UPDATE form_fields f
SET label = '3º teste de densidade', unit = 'g/cm³'
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'density_test_3';

UPDATE form_fields f
SET label = 'Média de densidade', unit = 'g/cm³'
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'density_average';

-- ---------- 2. Pre-producao: abrir espaco no sort_order ----------
-- Observacoes Pre Producao (32) vai para o fim, depois dos 8 campos novos.
-- Os dois blocos novos ocupam 32..39.

UPDATE form_fields f
SET sort_order = 40
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'pre_production_observations';

-- ---------- 3. Pre-producao: bloco de scoop padrao ----------

INSERT INTO form_fields (section_id, key, label, field_type, unit, required, computed_from, sort_order)
SELECT s.id, v.key, v.label, v.ftype::field_type, v.unit, false, v.cfrom, v.ord
FROM form_sections s
CROSS JOIN (VALUES
  ('pre_scoop_1',     '1º teste de scoop padrão', 'number',       'g', NULL::jsonb, 32),
  ('pre_scoop_2',     '2º teste de scoop padrão', 'number',       'g', NULL::jsonb, 33),
  ('pre_scoop_3',     '3º teste de scoop padrão', 'number',       'g', NULL::jsonb, 34),
  ('pre_scoop_media', 'Média de scoop padrão',    'computed_avg', 'g',
     '["pre_scoop_1","pre_scoop_2","pre_scoop_3"]'::jsonb, 35)
) AS v(key, label, ftype, unit, cfrom, ord)
WHERE s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
ON CONFLICT (section_id, key) DO NOTHING;

-- ---------- 4. Pre-producao: bloco de simulacao consumidor ----------

INSERT INTO form_fields (section_id, key, label, field_type, unit, required, computed_from, sort_order)
SELECT s.id, v.key, v.label, v.ftype::field_type, v.unit, false, v.cfrom, v.ord
FROM form_sections s
CROSS JOIN (VALUES
  ('pre_consumidor_1',     '1º teste de simulação consumidor', 'number',       'g', NULL::jsonb, 36),
  ('pre_consumidor_2',     '2º teste de simulação consumidor', 'number',       'g', NULL::jsonb, 37),
  ('pre_consumidor_3',     '3º teste de simulação consumidor', 'number',       'g', NULL::jsonb, 38),
  ('pre_consumidor_media', 'Média de simulação consumidor',    'computed_avg', 'g',
     '["pre_consumidor_1","pre_consumidor_2","pre_consumidor_3"]'::jsonb, 39)
) AS v(key, label, ftype, unit, cfrom, ord)
WHERE s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
ON CONFLICT (section_id, key) DO NOTHING;

-- ---------- 5. Pre-producao: OBS quando NAO ha necessidade de padrao ----------
-- Entra em 1.5 conceitualmente; usa 41 e depois e reordenado para 2.
-- Simplificacao: empurra os campos 2..31 em +1 e insere direto em 2.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.sort_order BETWEEN 2 AND 39
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id
      AND x.key = 'motivo_nao_necessidade_padrao'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'motivo_nao_necessidade_padrao', 'Motivo da não necessidade',
       'textarea'::field_type, false,
       '{"field":"development_needed","equals":"Não"}'::jsonb, 2
FROM form_sections s
WHERE s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
ON CONFLICT (section_id, key) DO NOTHING;

-- ---------- 6. Mistura: OBS quando HA ocorrencia ----------
-- mixing_occurrence e sort_order 6; o novo campo entra em 7 e empurra o resto.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'processo_mistura'
  AND f.sort_order >= 7
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id
      AND x.key = 'mixing_occurrence_obs'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'mixing_occurrence_obs', 'Descrição da ocorrência — Mistura',
       'textarea'::field_type, false,
       '{"field":"mixing_occurrence","equals":"Sim"}'::jsonb, 7
FROM form_sections s
WHERE s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'processo_mistura'
ON CONFLICT (section_id, key) DO NOTHING;

-- ---------- 7. Mistura: relabel do motivo do scoop ----------

UPDATE form_fields f
SET label = 'Descrever plano de ação'
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'processo_mistura'
  AND f.key = 'scoop_motivo_nao_conformidade';

-- ---------- 8. Envase: motivo quando HA ocorrencia ----------
-- bagging_occurrence e sort_order 8; o novo campo entra em 9.

UPDATE form_fields f
SET sort_order = f.sort_order + 1
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'processo_envase'
  AND f.sort_order >= 9
  AND NOT EXISTS (
    SELECT 1 FROM form_fields x
    WHERE x.section_id = f.section_id
      AND x.key = 'bagging_occurrence_motivo'
  );

INSERT INTO form_fields (section_id, key, label, field_type, required, visible_if, sort_order)
SELECT s.id, 'bagging_occurrence_motivo', 'Motivo da não conformidade — Envase',
       'textarea'::field_type, false,
       '{"field":"bagging_occurrence","equals":"Sim"}'::jsonb, 9
FROM form_sections s
WHERE s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'processo_envase'
ON CONFLICT (section_id, key) DO NOTHING;

COMMIT;

-- ---------- 9. CORRECAO pos-aplicacao ----------
-- O passo 2 fixou pre_production_observations em 40, mas o shift do
-- motivo_nao_necessidade_padrao (passo 5) empurrou os blocos novos em +1,
-- levando pre_consumidor_media tambem para 40. Empate de sort_order deixa
-- a ordem de exibicao indefinida.
-- Ordem final da secao: densidade 29-32, scoop padrao 33-36,
-- simulacao consumidor 37-40, observacoes 41.

UPDATE form_fields f
SET sort_order = 41
FROM form_sections s
WHERE f.section_id = s.id
  AND s.template_id = '5641e4d5-6ea5-4381-92c3-bc31620dfa58'
  AND s.key = 'pre_producao'
  AND f.key = 'pre_production_observations';
