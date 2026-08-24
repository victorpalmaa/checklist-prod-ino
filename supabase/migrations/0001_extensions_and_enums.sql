-- BLOCO B2 — Extensões e tipos enum
-- RED-029 REV. 06 — Portal de Checklist de Primeira Produção
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- EXTENSÕES
-- ============================================================

-- pg_trgm: busca textual por similaridade (trigramas) nos campos
-- product_name, client e formulation_code da listagem de registros.
CREATE EXTENSION IF NOT EXISTS pg_trgm
    WITH SCHEMA extensions;

-- pgcrypto: gen_random_uuid() para geração de chaves primárias UUID
-- em todas as tabelas do domínio. Observação: gen_random_uuid() é
-- nativa no Postgres desde a versão 13; a extensão é mantida apenas
-- por compatibilidade, não por dependência real.
CREATE EXTENSION IF NOT EXISTS pgcrypto
    WITH SCHEMA extensions;

-- ============================================================
-- ENUMS
-- Postgres não tem CREATE TYPE IF NOT EXISTS. Cada enum é criado
-- dentro de um bloco DO $$ ... $$ com checagem prévia em pg_type.
-- ============================================================

-- Tipos de produto fabricados pela Pronutrition que possuem
-- formulário RED-029 específico. A escolha do tipo determina
-- quais seções e campos serão carregados no template.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'product_type'
    ) THEN
        CREATE TYPE public.product_type AS ENUM (
            'po',
            'capsula',
            'gel'
        );
    END IF;
END $$;

-- Ciclo de vida da revisão do template de formulário.
-- draft     — em edição, ainda não disponível para novos registros.
-- published — disponível para uso; bloqueia edição de campos/seções.
-- archived  — histórico; não aceita novos runs, mas continua sendo
--             referenciado por runs já preenchidos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'template_status'
    ) THEN
        CREATE TYPE public.template_status AS ENUM (
            'draft',
            'published',
            'archived'
        );
    END IF;
END $$;

-- Ciclo de vida de um registro de checklist (run).
-- draft     — preenchimento em andamento, operador pode editar.
-- submitted — enviado para aprovação, já imutável, aguarda 4 assinaturas.
-- signed    — 4 assinaturas coletadas, registro definitivo e imutável.
-- voided    — cancelado por correção; substituído por outro run via
--             coluna supersedes_run_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'run_status'
    ) THEN
        CREATE TYPE public.run_status AS ENUM (
            'draft',
            'submitted',
            'signed',
            'voided'
        );
    END IF;
END $$;

-- Tipos de campo suportados pelo motor de formulário dinâmico.
-- text         — texto curto, uma linha.
-- textarea     — texto longo, multilinha.
-- number       — grandeza numérica (valores persistidos como numeric).
-- date         — data, sem horário.
-- radio        — escolha única de opções fechadas.
-- select       — dropdown de opções fechadas.
-- checkbox     — booleano / múltipla escolha.
-- computed_avg — campo calculado (média de densidade a partir de
--                múltiplas medições), porém persistido no banco.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'field_type'
    ) THEN
        CREATE TYPE public.field_type AS ENUM (
            'text',
            'textarea',
            'number',
            'date',
            'radio',
            'select',
            'checkbox',
            'computed_avg'
        );
    END IF;
END $$;

-- Papel de assinatura no fluxo RED-029, na ordem de coleta.
-- producao             — Responsável pela produção (1ª assinatura).
-- qualidade            — Responsável pelo Controle de Qualidade (2ª).
-- inovacao             — Responsável pela Inovação / Desenvolvimento (3ª).
-- verificacao_inovacao — Verificação final pela Inovação (4ª).
-- Conceito diferente de app_role: um usuário com app_role = 'inovacao'
-- pode assinar tanto 'inovacao' quanto 'verificacao_inovacao'.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'signature_role'
    ) THEN
        CREATE TYPE public.signature_role AS ENUM (
            'producao',
            'qualidade',
            'inovacao',
            'verificacao_inovacao'
        );
    END IF;
END $$;

-- Papel do usuário autenticado no sistema, base das policies de RLS.
-- operador  — Preenche e envia checklists. Assina como 'producao'.
-- qualidade — Assina como 'qualidade'. Visualiza registros.
-- inovacao  — Assina como 'inovacao' e 'verificacao_inovacao'.
-- admin     — Gerencia profiles e templates, emite correção de registro
--             assinado, acessa audit_log. Pode assinar qualquer papel.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typtype = 'e'
          AND n.nspname = 'public'
          AND t.typname = 'app_role'
    ) THEN
        CREATE TYPE public.app_role AS ENUM (
            'operador',
            'qualidade',
            'inovacao',
            'admin'
        );
    END IF;
END $$;
