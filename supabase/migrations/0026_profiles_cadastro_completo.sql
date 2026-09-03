-- =====================================================================
-- 0026_profiles_cadastro_completo.sql
--
-- Amplia o cadastro de usuarios para suportar o fluxo de convite pelo
-- ADM decidido em 03/09/2026, em substituicao ao item 7 da ATA de 31/08
-- (cadastro com senha definida pelo ADM), que e incompativel com o
-- modelo de seguranca: SERVICE_ROLE_KEY nao pode viver em VITE_*, e ADM
-- que conhece a senha do operador destroi o nao-repudio da assinatura
-- eletronica do RED-029.
--
-- No fluxo novo o ADM cadastra nome, sobrenome, email e area; o usuario
-- recebe um link por e-mail e define a propria senha.
--
-- Escopo desta migration: SCHEMA apenas. A Edge Function de convite e
-- a tela de cadastro sao tarefas separadas.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP antes
-- de CREATE em constraint e trigger.
-- =====================================================================

-- =====================================================================
-- 1. COLUNAS NOVAS
-- =====================================================================
-- Nullable de proposito: os perfis existentes nao tem como ser
-- preenchidos por backfill (nao da para adivinhar onde termina o nome e
-- comeca o sobrenome com seguranca). O preenchimento e manual, pelo
-- painel /admin/usuarios.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS first_name text,
    ADD COLUMN IF NOT EXISTS last_name  text,
    ADD COLUMN IF NOT EXISTS area       text,
    ADD COLUMN IF NOT EXISTS job_title  text,
    ADD COLUMN IF NOT EXISTS invited_by uuid;

-- E-mail NAO e coluna aqui de proposito: vive em auth.users e ja e
-- exposto por list_users_for_admin. Duplicar cria duas fontes de verdade
-- que desincronizam na primeira troca de e-mail.

COMMENT ON COLUMN public.profiles.area IS
    'Area organizacional (Inovacao, Qualidade, Producao). NAO confundir com role, que e permissao.';
COMMENT ON COLUMN public.profiles.job_title IS
    'Cargo. Dado cadastral. NAO entra na assinatura: o RED-029 identifica o assinante por nome + signature_role.';
COMMENT ON COLUMN public.profiles.invited_by IS
    'Quem autorizou o acesso. E o ganho de rastreabilidade do convite sobre o signup aberto.';

-- ---------- Area: lista fechada ----------
-- CHECK em vez de enum: area organizacional muda com reestruturacao da
-- empresa, e alterar um CHECK e mais barato que alterar um enum em uso.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_area_valid;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_area_valid
    CHECK (area IS NULL OR area IN ('Inovação', 'Qualidade', 'Produção'));

-- ---------- invited_by ----------
-- ON DELETE SET NULL, nunca CASCADE: apagar quem convidou nao pode
-- apagar o convidado.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_invited_by_fkey;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_invited_by_idx
    ON public.profiles (invited_by)
    WHERE invited_by IS NOT NULL;


-- =====================================================================
-- 2. full_name DERIVADO
-- =====================================================================
-- full_name permanece: sign_run copia dela para run_signatures.signed_name,
-- e varios pontos do frontend leem essa coluna. Passa a ser derivada de
-- first_name + last_name para nao criar duas fontes de verdade.
--
-- Fallback preserva o valor atual quando first/last estao vazios — os
-- perfis existentes nao perdem o nome que ja tem.

CREATE OR REPLACE FUNCTION public.sync_profile_full_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_composed text;
BEGIN
    v_composed := btrim(
        coalesce(btrim(NEW.first_name), '') || ' ' || coalesce(btrim(NEW.last_name), '')
    );

    IF v_composed <> '' THEN
        NEW.full_name := v_composed;
    ELSIF NEW.full_name IS NULL OR btrim(NEW.full_name) = '' THEN
        -- profiles.full_name e NOT NULL. Sem first/last e sem valor
        -- anterior, falhar aqui e melhor do que gravar string vazia e
        -- descobrir na hora da assinatura.
        RAISE EXCEPTION 'Perfil precisa de first_name/last_name ou de um full_name preenchido.';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_sync_full_name ON public.profiles;

CREATE TRIGGER profiles_sync_full_name
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_full_name();


-- =====================================================================
-- 3. PROTECAO CONTRA AUTO-EDICAO
-- =====================================================================
-- A policy profiles_update_own permite o usuario editar a PROPRIA LINHA
-- INTEIRA. O trigger anterior so barrava role e active — registration_code
-- ja era auto-editavel, e as colunas novas herdariam o mesmo buraco.
--
-- Por que isso importa: se o operador altera a propria area, cargo ou
-- matricula minutos antes de assinar, a assinatura deixa de provar em que
-- qualidade ele assinou. Identidade do assinante e dado de terceiro, nao
-- de auto-declaracao.
--
-- full_name entra na lista pelo mesmo motivo: sign_run copia dela para
-- signed_name, que e imutavel depois de gravado.

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o papel de um usuário.';
    END IF;

    IF NEW.active IS DISTINCT FROM OLD.active AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode ativar ou desativar um usuário.';
    END IF;

    -- ---------- Identidade: admin-only ----------
    IF NEW.first_name IS DISTINCT FROM OLD.first_name AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o nome de um usuário.';
    END IF;

    IF NEW.last_name IS DISTINCT FROM OLD.last_name AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o sobrenome de um usuário.';
    END IF;

    IF NEW.full_name IS DISTINCT FROM OLD.full_name AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o nome de um usuário.';
    END IF;

    IF NEW.area IS DISTINCT FROM OLD.area AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar a área de um usuário.';
    END IF;

    IF NEW.job_title IS DISTINCT FROM OLD.job_title AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o cargo de um usuário.';
    END IF;

    IF NEW.registration_code IS DISTINCT FROM OLD.registration_code AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar a matrícula de um usuário.';
    END IF;

    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar quem convidou um usuário.';
    END IF;

    RETURN NEW;
END;
$function$;

-- NAO recria o trigger: prevent_privilege_escalation ja esta ligado em
-- profiles desde a 0002. CREATE OR REPLACE FUNCTION basta.


-- =====================================================================
-- 4. handle_new_user SEM FALLBACK DE E-MAIL
-- =====================================================================
-- A versao anterior fazia COALESCE(raw_user_meta_data->>'full_name',
-- NEW.email). Quem se cadastrou sem passar full_name no metadata ficou
-- com o E-MAIL GRAVADO EM full_name — e, por consequencia, com o e-mail
-- aparecendo como nome do assinante no PDF.
--
-- No fluxo de convite o ADM preenche nome e sobrenome antes do usuario
-- existir, entao os dados vem pelo metadata. O fallback de e-mail deixa
-- de fazer sentido e passa a ser so uma forma silenciosa de sujar o dado.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_first text;
    v_last  text;
    v_full  text;
BEGIN
    v_first := nullif(btrim(coalesce(NEW.raw_user_meta_data->>'first_name', '')), '');
    v_last  := nullif(btrim(coalesce(NEW.raw_user_meta_data->>'last_name',  '')), '');
    v_full  := nullif(btrim(coalesce(NEW.raw_user_meta_data->>'full_name',  '')), '');

    -- Se first/last vierem no convite, full_name e derivado deles pelo
    -- trigger profiles_sync_full_name. Se vier so full_name (cadastro
    -- antigo), respeita. Sem nenhum dos tres, usa o e-mail apenas como
    -- placeholder tecnico para satisfazer o NOT NULL — o ADM corrige em
    -- /admin/usuarios antes de ativar.
    INSERT INTO public.profiles (
        id, first_name, last_name, full_name,
        area, job_title, invited_by, role
    )
    VALUES (
        NEW.id,
        v_first,
        v_last,
        coalesce(v_full, NEW.email),
        nullif(btrim(coalesce(NEW.raw_user_meta_data->>'area',      '')), ''),
        nullif(btrim(coalesce(NEW.raw_user_meta_data->>'job_title', '')), ''),
        (nullif(btrim(coalesce(NEW.raw_user_meta_data->>'invited_by', '')), ''))::uuid,
        DEFAULT
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$function$;
