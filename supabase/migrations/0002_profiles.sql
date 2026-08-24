-- BLOCO B3 — profiles, funções de papel e RLS
-- RED-029 REV. 06 — Portal de Checklist de Primeira Produção
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- TABELA public.profiles
-- Perfil dos usuários autenticados do Supabase Auth.
-- 1:1 com auth.users, sincronizado por trigger no INSERT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    registration_code text UNIQUE,
    role public.app_role NOT NULL DEFAULT 'operador'::public.app_role,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Comentários curtos de domínio, auditáveis em pg_description.
COMMENT ON TABLE public.profiles IS
    'Perfil 1:1 com auth.users, criado por trigger on_auth_user_created. Base das policies de RLS.';

COMMENT ON COLUMN public.profiles.id IS
    'PK 1:1 com auth.users.id. Preenchida pelo trigger, nunca manualmente.';

COMMENT ON COLUMN public.profiles.full_name IS
    'Nome de exibição. Signup: raw_user_meta_data.full_name ou email fallback. Atualizável pelo dono.';

COMMENT ON COLUMN public.profiles.registration_code IS
    'Matrícula interna do colaborador Pronutrition. Única, opcional.';

COMMENT ON COLUMN public.profiles.role IS
    'Papel no sistema (app_role). Default operador. Nunca lido de raw_user_meta_data. Só admin altera.';

COMMENT ON COLUMN public.profiles.active IS
    'Flag de ativação. Perfil inativo retém histórico. Só admin altera.';

COMMENT ON COLUMN public.profiles.created_at IS
    'Data de criação. Default now(), nunca atualizada.';

-- ============================================================
-- TRIGGER: criação automática de profile a partir de auth.users
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        DEFAULT
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Trigger no auth.users. DROP IF EXISTS garante idempotência, pois o
-- Postgres não oferece CREATE TRIGGER IF NOT EXISTS.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNÇÕES AUXILIARES DE PAPEL
-- ============================================================

-- Retorna o app_role do usuário autenticado, lendo direto de profiles.
-- SECURITY DEFINER é OBRIGATÓRIO: policies de outras tabelas chamam essa
-- função para decidir permissões; SECURITY INVOKER causaria recursão
-- infinita com a RLS da própria profiles.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid();
$$;

-- Atalho para policies: true se o usuário autenticado tem role = 'admin'.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT coalesce(public.current_app_role() = 'admin', false);
$$;

-- Execução restrita a usuários autenticados. Nunca public (anon).
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- RLS — profiles
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado lê todos os profiles, pois o nome e o
-- papel de quem assinou um registro precisam aparecer em detalhe.
-- A tabela não contém dado sensível (email, telefone etc.).
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Usuário pode atualizar a própria linha (nome próprio por exemplo).
-- O trigger prevent_privilege_escalation bloqueia alteração de role e
-- active por não-admin.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin tem CRUD completo (exceto DELETE — perfis são desativados,
-- e INSERT via trigger; o ALL aqui cobre UPDATE e SELECT além do que
-- as policies acima já permitem, e serve como camada única de referência
-- para futuras operações administrativas).
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- TRIGGER: proteção contra escalada de privilégio
-- Bloqueia alteração de role ou active por quem não é admin,
-- mesmo que a policy profiles_update_own permita UPDATE na linha.
-- RLS do Postgres não faz restrição por coluna em WITH CHECK —
-- essa proteção tem que ser trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode alterar o papel de um usuário.';
    END IF;

    IF NEW.active IS DISTINCT FROM OLD.active AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas um administrador pode ativar ou desativar um usuário.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_privilege_escalation_trg
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_privilege_escalation();
