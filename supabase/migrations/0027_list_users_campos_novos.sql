-- =====================================================================
-- 0027_list_users_campos_novos.sql
--
-- Expoe as colunas criadas pela 0026 (first_name, last_name, area,
-- job_title, invited_by) na RPC list_users_for_admin, para que o painel
-- /admin/usuarios consiga exibir e editar o cadastro completo.
--
-- Sem isto o ADM nao tem como preencher os perfis existentes pela UI, e
-- tres dos quatro perfis ainda estao com dado incompleto.
--
-- DROP antes de CREATE: RETURNS TABLE com assinatura diferente NAO passa
-- por CREATE OR REPLACE — o Postgres rejeita com "cannot change return
-- type of existing function".
--
-- Casts ::tipo explicitos em cada coluna do RETURN QUERY: exigencia do
-- RETURNS TABLE neste projeto, mesmo quando os tipos parecem corretos.
--
-- Idempotente: DROP IF EXISTS + CREATE.
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
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem listar usuários.';
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
        -- LEFT JOIN: quem convidou pode ter sido desativado ou o perfil
        -- pode nunca ter tido convite (cadastros anteriores ao fluxo).
        inv.full_name::text AS invited_by_name,
        p.role::public.app_role,
        p.active::boolean,
        p.created_at::timestamptz
    FROM public.profiles p
    JOIN auth.users u        ON u.id  = p.id
    LEFT JOIN public.profiles inv ON inv.id = p.invited_by
    ORDER BY p.full_name;
END;
$function$;
