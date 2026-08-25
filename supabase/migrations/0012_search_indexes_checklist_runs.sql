-- 0012_search_indexes_checklist_runs.sql
-- Índices trigram (pg_trgm) para suportar busca textual via ILIKE em
-- checklist_runs, usados pela listagem H1 (ChecklistsList).
--
-- pg_trgm já está habilitada desde 0001_extensions_and_enums.sql.
-- Sem estes índices, ILIKE em volume real faz sequential scan.

CREATE INDEX IF NOT EXISTS idx_checklist_runs_product_name_trgm
    ON public.checklist_runs
    USING gin (product_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_checklist_runs_client_trgm
    ON public.checklist_runs
    USING gin (client gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_checklist_runs_batch_number_trgm
    ON public.checklist_runs
    USING gin (batch_number gin_trgm_ops);
