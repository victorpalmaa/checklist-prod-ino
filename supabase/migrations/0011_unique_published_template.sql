-- 0011_unique_published_template.sql
-- Garante no máximo um template publicado por product_type.
--
-- Motivo: create_run (0006_rpc.sql, linhas 76-86) resolve o template
-- internamente por product_type + status = 'published', desempatando
-- por published_at DESC LIMIT 1. Templates publicados na mesma
-- transação compartilham published_at, porque now() em PL/pgSQL é
-- timestamp de transação e não de statement. Nesse caso a escolha
-- do LIMIT 1 depende do plano de execução.
--
-- Com este índice o erro migra do momento errado (criação de run,
-- silencioso e não-determinístico) para o momento certo (publicação
-- de template, explícito e com contexto para decidir).
--
-- Fluxo de nova revisão passa a ser: arquivar a revisão vigente,
-- depois publicar a nova. Runs existentes não são afetados --
-- checklist_runs.template_snapshot congela o formulário no momento
-- da criação.

CREATE UNIQUE INDEX IF NOT EXISTS uq_form_templates_published_per_type
    ON public.form_templates (product_type)
    WHERE status = 'published';

COMMENT ON INDEX public.uq_form_templates_published_per_type IS
    'No maximo um template published por product_type. create_run '
    'depende desta unicidade para resolver o template de forma '
    'deterministica.';
