-- =====================================================================
-- 0029_correcao_a_partir_de_submitted.sql
--
-- Libera a emissao de correcao a partir de 'submitted', nao apenas de
-- 'signed'. Decisao da reuniao de 31/08/2026, acao 6: "emissao de
-- correcao nao depende mais das 4 assinaturas completas — disponivel a
-- qualquer momento apos o envio para assinatura".
--
-- Motivacao: com a regra anterior, um registro enviado com erro e ainda
-- nao assinado por todos ficava travado — nao podia ser editado (o
-- status 'submitted' bloqueia) nem corrigido (a correcao exigia as 4
-- assinaturas).
--
-- O que NAO muda:
--   - 'draft' segue fora: rascunho se edita direto, nao se corrige
--   - 'voided' segue fora: registro anulado nao gera nova correcao
--   - uma correcao por registro (supersedes_run_id unico)
--   - autor ou admin
--   - justificativa de 20+ caracteres
--   - assinaturas ja dadas no original permanecem: o registro anulado
--     preserva o historico do que foi assinado antes do erro aparecer
--
-- CREATE OR REPLACE basta: assinatura e tipo de retorno inalterados.
-- Idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.void_and_supersede_run(p_run_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_auth_uid uuid;
    v_original public.checklist_runs%ROWTYPE;
    v_has_superseder boolean;
    v_trimmed_reason text;
    v_new_run_id uuid;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Sessão não autenticada.';
    END IF;

    SELECT * INTO v_original
    FROM public.checklist_runs r
    WHERE r.id = p_run_id;

    -- ALTERADO NA 0029: aceita 'submitted' alem de 'signed'.
    IF v_original.id IS NULL
       OR v_original.status NOT IN (
            'submitted'::public.run_status,
            'signed'::public.run_status
          )
    THEN
        RAISE EXCEPTION 'Apenas registros enviados para assinatura ou assinados podem ser corrigidos. Status atual: %.',
            coalesce(v_original.status::text, 'inexistente');
    END IF;

    IF v_original.created_by <> v_auth_uid AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Apenas o autor ou um administrador pode corrigir este registro.';
    END IF;

    v_trimmed_reason := btrim(coalesce(p_reason, ''));
    IF length(v_trimmed_reason) < 20 THEN
        RAISE EXCEPTION 'A justificativa da correção deve ter ao menos 20 caracteres.';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.checklist_runs r
        WHERE r.supersedes_run_id = p_run_id
    ) INTO v_has_superseder;
    IF v_has_superseder THEN
        RAISE EXCEPTION 'Este registro já possui uma correção emitida.';
    END IF;

    -- Ordem: primeiro cria o novo run (cabeçalho), depois copia valores,
    -- por último marca o original como voided.
    INSERT INTO public.checklist_runs (
        template_id,
        template_snapshot,
        product_name,
        client,
        formulation_code,
        batch_number,
        accompaniment_reason,
        production_date,
        status,
        created_by,
        supersedes_run_id
    ) VALUES (
        v_original.template_id,
        v_original.template_snapshot,
        v_original.product_name,
        v_original.client,
        v_original.formulation_code,
        v_original.batch_number,
        v_original.accompaniment_reason,
        v_original.production_date,
        'draft'::public.run_status,
        v_auth_uid,
        p_run_id
    )
    RETURNING id INTO v_new_run_id;

    -- Copia os valores preenchidos. Se o original estava em 'submitted'
    -- com campos pela metade, a correcao nasce pela metade — o objetivo
    -- e continuar de onde parou, nao recomecar.
    INSERT INTO public.run_values (
        run_id,
        section_key,
        field_key,
        value_text,
        value_num,
        value_bool,
        value_date,
        updated_by,
        updated_at
    )
    SELECT
        v_new_run_id,
        rv.section_key,
        rv.field_key,
        rv.value_text,
        rv.value_num,
        rv.value_bool,
        rv.value_date,
        v_auth_uid,
        now()
    FROM public.run_values rv
    WHERE rv.run_id = p_run_id;

    UPDATE public.checklist_runs
    SET status = 'voided'::public.run_status,
        voided_reason = v_trimmed_reason
    WHERE id = p_run_id;

    RETURN v_new_run_id;
END;
$function$;
