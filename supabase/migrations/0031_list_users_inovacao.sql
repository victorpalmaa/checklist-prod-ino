-- =====================================================================
-- 0031_list_users_inovacao.sql
--
-- Permite que o papel 'inovacao' liste usuarios, para que possa usar a
-- tela /admin/usuarios e convidar novas pessoas pela Edge Function
-- invite-user.
--
-- ---------------------------------------------------------------------
-- ESCOPO: LEITURA APENAS
-- ---------------------------------------------------------------------
-- 'inovacao' passa a LER a lista e a CONVIDAR. NAO passa a editar papel,
-- status, area ou matricula de terceiros.
--
-- O motivo e escalada de privilegio por caminho alternativo: a Edge
-- Function impede que 'inovacao' convide alguem como 'admin'
-- (ROLES_BY_INVITER). Se ele pudesse editar o papel de um usuario ja
-- existente, promoveria qualquer pessoa a admin pela tabela e a
-- restricao do convite viraria decorativa.
--
-- A escrita continua barrada em duas camadas independentes:
--   1. policy profiles_admin_all, que exige is_admin() para UPDATE
--   2. trigger prevent_privilege_escalation, que exige is_admin() por
--      coluna sensivel
-- Esta migration NAO toca em nenhuma das duas.
--
-- A tela replica a regra apenas para desabilitar controles; forcar a
-- chamada nao contorna nada.
--
-- DROP antes de CREATE: a assinatura de RETURNS TABLE nao muda, mas
-- manter o mesmo padrao da 0027 evita surpresa. Idempotente.
-- =====================================================================

DROP FUNCTION IF EXISTS public.list_users_for_admin();

CREATE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
    id                uuid,
    full_name         text,
    first_name        text,
    last_name         text,
    email             text,
    registration_code text,
    area              text,
    job_title         text,
    invited_by        uuid,
    invited_by_name   text,
    role              app_role,
    active            boolean,
    created_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_role public.app_role;
BEGIN
    SELECT p.role INTO v_role
    FROM public.profiles p
    WHERE p.id = auth.uid();

    -- Leitura liberada para admin e inovacao. Escrita permanece
    -- admin-only, garantida por policy e trigger.
    IF v_role IS NULL
       OR v_role NOT IN ('admin'::public.app_role, 'inovacao'::public.app_role)
    THEN
        RAISE EXCEPTION 'Seu perfil não pode listar usuários.';
    END IF;

    RETURN QUERY
    SELECT
        p.id::uuid,
        p.full_name::text,
        p.first_name::text,
        p.last_name::text,
        u.email::text,
        p.registration_code::text,
        p.area::text,
        p.job_title::text,
        p.invited_by::uuid,
        inv.full_name::text AS invited_by_name,
        p.role::public.app_role,
        p.active::boolean,
        p.created_at::timestamptz
    FROM public.profiles p
    JOIN auth.users u             ON u.id  = p.id
    LEFT JOIN public.profiles inv ON inv.id = p.invited_by
    ORDER BY p.full_name;
END;
$function$;
