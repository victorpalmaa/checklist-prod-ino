-- 0013_drop_duplicate_trgm_indexes.sql
-- Remove índices trigram duplicados criados pela 0012.
--
-- 0004_runs.sql já criava checklist_runs_product_name_trgm_idx e
-- checklist_runs_client_trgm_idx (com extensions.gin_trgm_ops) desde
-- a fundação do bloco B. A 0012 recriou os mesmos índices sob nomes
-- diferentes (idx_checklist_runs_product_name_trgm e
-- idx_checklist_runs_client_trgm), gerando escrita duplicada sem
-- ganho de leitura.
--
-- batch_number não tinha índice trigram antes da 0012 e permanece:
-- idx_checklist_runs_batch_number_trgm segue sendo o único cobrindo
-- essa coluna.

DROP INDEX IF EXISTS public.idx_checklist_runs_product_name_trgm;
DROP INDEX IF EXISTS public.idx_checklist_runs_client_trgm;
