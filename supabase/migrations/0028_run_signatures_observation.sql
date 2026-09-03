-- =====================================================================
-- 0028_run_signatures_observation.sql
--
-- Campo de observacao opcional na assinatura, decidido na reuniao de
-- 31/08/2026 ("pop-up de assinatura mantem texto padrao pre-preenchido,
-- com opcao de editar ou adicionar observacao").
--
-- Interpretacao adotada (confirmada em 03/09): a DECLARACAO permanece
-- FIXA e nao editavel — em documento controlado, o texto padrao e a
-- declaracao formal do assinante; se cada um reescreve, some a
-- padronizacao que justifica ter texto padrao e a auditoria passa a
-- comparar declaracoes diferentes entre si.
--
-- A observacao e um campo SEPARADO, opcional, para contexto do ato.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, DROP antes de CREATE.
-- =====================================================================

-- =====================================================================
-- 1. COLUNA
-- =====================================================================

ALTER TABLE public.run_signatures
    ADD COLUMN IF NOT EXISTS observation text;

COMMENT ON COLUMN public.run_signatures.observation IS
    'Observacao opcional do assinante. Complementa a declaracao (statement), que e fixa por papel e nao editavel.';


-- =====================================================================
-- 2. IMUTABILIDADE
-- =====================================================================
-- Assinatura e ato, nao rascunho: gravada, nao muda mais. Sem isto, a
-- observacao seria o unico campo editavel de um registro que existe
-- justamente para provar o que foi declarado e quando.
--
-- DELETE segue permitido pelas policies existentes (nao ha caminho de
-- UI para isso hoje); o que se bloqueia aqui e a reescrita silenciosa.

CREATE OR REPLACE FUNCTION public.prevent_signature_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    RAISE EXCEPTION 'Assinaturas são imutáveis. Para corrigir um registro assinado, emita uma correção.';
END;
$function$;

DROP TRIGGER IF EXISTS run_signatures_prevent_update ON public.run_signatures;

CREATE TRIGGER run_signatures_prevent_update
    BEFORE UPDATE ON public.run_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_signature_update();


-- =====================================================================
-- 3. sign_run COM OBSERVACAO
-- =====================================================================
-- p_observation com DEFAULT NULL: a assinatura do frontend anterior
-- continua funcionando se houver defasagem entre o deploy do banco e o
-- da aplicacao.
--
-- CREATE OR REPLACE basta: RETURNS void nao muda, e o parametro novo
-- entra no fim com default. NAO ha mudanca de assinatura de retorno,
-- entao nao exige DROP.

CREATE OR REPLACE FUNCTION public.sign_run(
    p_run_id      uuid,
    p_role        signature_role,
    p_statement   text,
    p_observation text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    -- Quatro papéis de assinatura do formulário RED-029 (B2). A contagem
    -- é usada para decidir quando o run fecha como "signed".
    c_total_signatures constant int := 4;
    v_auth_uid uuid;
    v_run public.checklist_runs%ROWTYPE;
    v_existing boolean;
    v_signed_name text;
    v_signature_count int;
    v_trimmed_statement text;
    v_trimmed_observation text;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    IF NOT public.can_sign_role(p_role) THEN
        RAISE EXCEPTION 'Seu perfil não pode assinar como %.', p_role;
    END IF;

    SELECT * INTO v_run
    FROM public.checklist_runs r
    WHERE r.id = p_run_id;
    IF v_run.id IS NULL OR v_run.status <> 'submitted'::public.run_status THEN
        RAISE EXCEPTION 'Só é possível assinar um registro enviado para assinatura. Status atual: %.',
            coalesce(v_run.status::text, 'inexistente');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.run_signatures rs
        WHERE rs.run_id = p_run_id
          AND rs.role = p_role
    ) INTO v_existing;
    IF v_existing THEN
        RAISE EXCEPTION 'Este papel já foi assinado neste registro.';
    END IF;

    v_trimmed_statement := btrim(coalesce(p_statement, ''));
    IF length(v_trimmed_statement) < 10 THEN
        RAISE EXCEPTION 'A declaração do assinante deve ter pelo menos 10 caracteres.';
    END IF;

    -- Observacao e opcional: string vazia vira NULL para nao poluir o
    -- PDF com bloco em branco.
    v_trimmed_observation := nullif(btrim(coalesce(p_observation, '')), '');

    IF v_trimmed_observation IS NOT NULL AND length(v_trimmed_observation) > 1000 THEN
        RAISE EXCEPTION 'A observação da assinatura deve ter no máximo 1000 caracteres.';
    END IF;

    SELECT p.full_name INTO v_signed_name
    FROM public.profiles p
    WHERE p.id = v_auth_uid;

    IF v_signed_name IS NULL OR btrim(v_signed_name) = '' THEN
        RAISE EXCEPTION 'Perfil de usuário não encontrado ou sem nome cadastrado.';
    END IF;

    INSERT INTO public.run_signatures (
        run_id,
        role,
        signed_by,
        signed_name,
        statement,
        observation
    ) VALUES (
        p_run_id,
        p_role,
        v_auth_uid,
        v_signed_name,
        v_trimmed_statement,
        v_trimmed_observation
    );

    SELECT count(*) INTO v_signature_count
    FROM public.run_signatures rs
    WHERE rs.run_id = p_run_id;

    IF v_signature_count >= c_total_signatures THEN
        UPDATE public.checklist_runs
        SET status = 'signed'::public.run_status,
            completed_at = now()
        WHERE id = p_run_id;
    END IF;
END;
$function$;
