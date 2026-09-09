-- 0032_service_role_bypass_privilege_trigger.sql
--
-- Problema: a Edge Function invite-user usa SERVICE_ROLE_KEY para ajustar
-- profiles.role logo apos o convite. A service key bypassa RLS, mas NAO
-- bypassa trigger. prevent_privilege_escalation chama is_admin(), que
-- depende de auth.uid() — NULL sob service_role. Resultado: toda tentativa
-- de convite com papel != 'operador' falhava com excecao, e o usuario
-- nascia como 'operador'. Confirmado em 5 de 5 convites.
--
-- Solucao: liberar explicitamente o role service_role no inicio do trigger.
-- Nao amplia superficie de ataque: quem detem a service key ja poderia
-- derrubar o proprio trigger. A regra de negocio de quem-convida-qual-papel
-- (CAN_INVITE / ROLES_BY_INVITER) continua validada na Edge Function.
--
-- Nao afeta:
--   - frontend (anon/authenticated nunca tem claim service_role)
--   - SQL Editor (request.jwt.claims ausente -> coalesce vazio -> nao bypassa)

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Bypass para service_role (Edge Function invite-user).
    IF coalesce(
         current_setting('request.jwt.claims', true)::jsonb->>'role',
         ''
       ) = 'service_role'
    THEN
        RETURN NEW;
    END IF;

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
