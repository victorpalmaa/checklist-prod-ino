-- =====================================================================
-- 0030_correcao_herda_evidencias.sql
--
-- Faz a correcao herdar as evidencias fotograficas do registro anulado,
-- para que o PDF da correcao nao saia sem foto. Segunda metade da acao 6
-- da ATA de 31/08/2026 ("passa a incluir as fotos anexadas anteriormente
-- no PDF de correcao").
--
-- ---------------------------------------------------------------------
-- DESENHO
-- ---------------------------------------------------------------------
-- A linha em run_attachments e copiada; o OBJETO no Storage NAO. As duas
-- linhas passam a apontar para o mesmo storage_path.
--
-- Isto e possivel porque a policy de leitura do Storage
-- (run_attachments_object_select) so verifica bucket_id — nao amarra ao
-- run_id do path. A amarragem por run_id existe apenas em INSERT e
-- DELETE, que e onde ela protege de fato.
--
-- Copiar bytes seria a alternativa, mas exigiria copia server-side com
-- service key (que nao existe neste projeto) ou download/reupload pelo
-- client, com duplicacao de armazenamento e risco de falha parcial.
--
-- ---------------------------------------------------------------------
-- POR QUE A COLUNA copied_from_attachment_id
-- ---------------------------------------------------------------------
-- Sem ela nao ha como distinguir evidencia PRODUZIDA neste registro de
-- evidencia HERDADA do anterior. Em auditoria essa distincao importa: a
-- foto pertence ao ato em que foi tirada.
--
-- Ela tambem e o que permite a remocao segura: anexo herdado aponta para
-- objeto de um registro ANULADO, que e imutavel. Remover o vinculo e
-- legitimo; apagar o arquivo, nao.
--
-- Idempotente.
-- =====================================================================

-- =====================================================================
-- 1. COLUNA DE PROCEDENCIA
-- =====================================================================

ALTER TABLE public.run_attachments
    ADD COLUMN IF NOT EXISTS copied_from_attachment_id uuid;

COMMENT ON COLUMN public.run_attachments.copied_from_attachment_id IS
    'Preenchido quando a evidencia foi herdada de um registro anulado via correcao. NULL = foto produzida neste proprio registro. Herdada compartilha storage_path com a origem: remover a linha NUNCA pode apagar o objeto.';

ALTER TABLE public.run_attachments
    DROP CONSTRAINT IF EXISTS run_attachments_copied_from_fkey;

-- ON DELETE SET NULL: se a linha de origem sumir, a copia continua
-- valida — o objeto no Storage nao depende dela.
ALTER TABLE public.run_attachments
    ADD CONSTRAINT run_attachments_copied_from_fkey
    FOREIGN KEY (copied_from_attachment_id)
    REFERENCES public.run_attachments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS run_attachments_copied_from_idx
    ON public.run_attachments (copied_from_attachment_id)
    WHERE copied_from_attachment_id IS NOT NULL;


-- =====================================================================
-- 2. void_and_supersede_run COPIA AS EVIDENCIAS
-- =====================================================================
-- Ordem preservada da 0029: cria o novo run, copia valores, copia
-- evidencias, e so entao anula o original.
--
-- uploaded_by recebe v_auth_uid: quem emitiu a correcao e quem
-- respondeu por trazer a evidencia para o registro novo. A autoria
-- original permanece rastreavel pela linha de origem.

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

    -- 0029: aceita 'submitted' alem de 'signed'.
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

    -- Valores preenchidos. Se o original estava em 'submitted' pela
    -- metade, a correcao nasce pela metade — continuar de onde parou.
    INSERT INTO public.run_values (
        run_id, section_key, field_key,
        value_text, value_num, value_bool, value_date,
        updated_by, updated_at
    )
    SELECT
        v_new_run_id, rv.section_key, rv.field_key,
        rv.value_text, rv.value_num, rv.value_bool, rv.value_date,
        v_auth_uid, now()
    FROM public.run_values rv
    WHERE rv.run_id = p_run_id;

    -- NOVO NA 0030: evidencias fotograficas.
    -- storage_path e mantido: aponta para o objeto do registro original,
    -- que nao e duplicado.
    INSERT INTO public.run_attachments (
        run_id, section_key, field_key,
        storage_path, file_name, mime_type, size_bytes,
        uploaded_by, copied_from_attachment_id
    )
    SELECT
        v_new_run_id, ra.section_key, ra.field_key,
        ra.storage_path, ra.file_name, ra.mime_type, ra.size_bytes,
        v_auth_uid, ra.id
    FROM public.run_attachments ra
    WHERE ra.run_id = p_run_id;

    UPDATE public.checklist_runs
    SET status = 'voided'::public.run_status,
        voided_reason = v_trimmed_reason
    WHERE id = p_run_id;

    RETURN v_new_run_id;
END;
$function$;
