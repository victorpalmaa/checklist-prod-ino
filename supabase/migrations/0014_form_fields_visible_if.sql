-- 0014_form_fields_visible_if.sql
-- Adiciona suporte a campo condicional: form_fields.visible_if guarda
-- { "field": "chave_do_campo_controlador", "equals": "valor_string" }
-- na mesma seção. NULL = campo sempre visível (comportamento atual,
-- sem mudança para templates existentes).
--
-- IMPORTANTE: create_run precisa incluir esta coluna na montagem do
-- snapshot (ver 0015_create_run_include_visible_if.sql) para que o
-- valor chegue ao front-end. Esta migration sozinha não tem efeito
-- visível — é pré-requisito da 0015.

ALTER TABLE public.form_fields
    ADD COLUMN IF NOT EXISTS visible_if jsonb;

COMMENT ON COLUMN public.form_fields.visible_if IS
    'Condição de visibilidade: {"field": "key_do_campo", "equals": "valor"}. '
    'NULL = sempre visível. O campo referenciado deve estar na mesma seção.';
