-- 0019_list_users_for_admin.sql
-- Function de leitura para a tela /admin/usuarios (bloco J). Expõe
-- email de auth.users (inacessível ao client diretamente) apenas para
-- administradores, join com profiles.
--
-- Nota de governança: esta function foi criada e corrigida direto no
-- SQL Editor durante a sessão que construiu /admin/usuarios, antes de
-- ser commitada como migration. Esta é a versão final, já com os casts
-- explícitos que corrigiram o erro "structure of query does not match
-- function result type" (ambiguidade de tipo dentro de RETURN QUERY).

DROP FUNCTION IF EXISTS public.list_users_for_admin();

CREATE OR REPLACE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    registration_code text,
    role public.app_role,
    active boolean,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem listar usuários.';
    END IF;
    RETURN QUERY
    SELECT
        p.id::uuid,
        p.full_name::text,
        u.email::text,
        p.registration_code::text,
        p.role::public.app_role,
        p.active::boolean,
        p.created_at::timestamptz
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.full_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_for_admin() TO authenticated;
