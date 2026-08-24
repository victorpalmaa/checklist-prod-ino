-- BLOCO B6 — run_signatures, run_attachments, função can_sign_role
-- RED-029 REV. 06 — Assinaturas eletrônicas e anexos dos checklists
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- TABELA public.run_signatures
-- Assinaturas eletrônicas coletadas no fluxo RED-029.
-- Quatro assinaturas por run (uma por signature_role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.run_signatures (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    run_id uuid NOT NULL
        REFERENCES public.checklist_runs(id) ON DELETE CASCADE,
    role public.signature_role NOT NULL,
    signed_by uuid NOT NULL REFERENCES public.profiles(id),
    signed_name text NOT NULL,
    statement text NOT NULL,
    signed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS run_signatures_run_role_uq
    ON public.run_signatures (run_id, role);

COMMENT ON TABLE public.run_signatures IS
    'Assinaturas coletadas por run. UNIQUE(run_id, role). Snapshot do nome e do statement no momento da assinatura.';

COMMENT ON COLUMN public.run_signatures.id IS
    'PK UUID da assinatura.';

COMMENT ON COLUMN public.run_signatures.run_id IS
    'FK para checklist_runs. ON DELETE CASCADE.';

COMMENT ON COLUMN public.run_signatures.role IS
    'Papel da assinatura no RED-029: producao / qualidade / inovacao / verificacao_inovacao.';

COMMENT ON COLUMN public.run_signatures.signed_by IS
    'FK para o profile que efetivamente assinou.';

COMMENT ON COLUMN public.run_signatures.signed_name IS
    'Snapshot de profiles.full_name no momento da assinatura. Histórico imutável.';

COMMENT ON COLUMN public.run_signatures.statement IS
    'Texto atestado pelo assinante, congelado no momento da assinatura (>= 10 caracteres).';

COMMENT ON COLUMN public.run_signatures.signed_at IS
    'Data/hora da assinatura. Default now().';

-- ============================================================
-- TABELA public.run_attachments
-- Anexos de produção: fotos de etiquetas, laudos, PDFs de acompanhamento.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.run_attachments (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    run_id uuid NOT NULL
        REFERENCES public.checklist_runs(id) ON DELETE CASCADE,
    section_key text,
    field_key text,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes int NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.run_attachments IS
    'Anexos (imagens e PDF) vinculados a um run, opcionalmente a uma section_key/field_key específica.';

COMMENT ON COLUMN public.run_attachments.id IS
    'PK UUID do anexo.';

COMMENT ON COLUMN public.run_attachments.run_id IS
    'FK para checklist_runs. ON DELETE CASCADE.';

COMMENT ON COLUMN public.run_attachments.section_key IS
    'Chave da seção, se o anexo for de um campo. NULL para anexo geral do registro.';

COMMENT ON COLUMN public.run_attachments.field_key IS
    'Chave do campo. Só pode ser NOT NULL se section_key também for NOT NULL.';

COMMENT ON COLUMN public.run_attachments.storage_path IS
    'Caminho dentro do Supabase Storage (bucket checklists).';

COMMENT ON COLUMN public.run_attachments.file_name IS
    'Nome original do arquivo no upload.';

COMMENT ON COLUMN public.run_attachments.mime_type IS
    'Tipo MIME permitido: image/jpeg, image/png, image/webp, application/pdf.';

COMMENT ON COLUMN public.run_attachments.size_bytes IS
    'Tamanho em bytes. 0 < size <= 10 MiB.';

COMMENT ON COLUMN public.run_attachments.uploaded_by IS
    'FK para profile que subiu o anexo.';

COMMENT ON COLUMN public.run_attachments.uploaded_at IS
    'Data/hora do upload. Default now().';

-- ============================================================
-- CONSTRAINTS DE INTEGRIDADE
-- ============================================================

-- run_signatures: statement com pelo menos 10 caracteres.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'run_signatures_statement_min_length'
          AND conrelid = 'public.run_signatures'::regclass
    ) THEN
        ALTER TABLE public.run_signatures
            ADD CONSTRAINT run_signatures_statement_min_length
            CHECK (length(statement) >= 10);
    END IF;
END $$;

-- run_attachments: tamanho entre 1 byte e 10 MiB inclusive.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'run_attachments_size_bytes_range'
          AND conrelid = 'public.run_attachments'::regclass
    ) THEN
        ALTER TABLE public.run_attachments
            ADD CONSTRAINT run_attachments_size_bytes_range
            CHECK (size_bytes > 0 AND size_bytes <= 10485760);
    END IF;
END $$;

-- run_attachments: mime_type restrito aos tipos permitidos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'run_attachments_mime_type_allowed'
          AND conrelid = 'public.run_attachments'::regclass
    ) THEN
        ALTER TABLE public.run_attachments
            ADD CONSTRAINT run_attachments_mime_type_allowed
            CHECK (
                mime_type IN (
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'application/pdf'
                )
            );
    END IF;
END $$;

-- run_attachments: field_key exige section_key presente.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'run_attachments_field_requires_section'
          AND conrelid = 'public.run_attachments'::regclass
    ) THEN
        ALTER TABLE public.run_attachments
            ADD CONSTRAINT run_attachments_field_requires_section
            CHECK (field_key IS NULL OR section_key IS NOT NULL);
    END IF;
END $$;

-- ============================================================
-- ÍNDICES DE CONSULTA
-- ============================================================

CREATE INDEX IF NOT EXISTS run_signatures_run_id_idx
    ON public.run_signatures (run_id);

CREATE INDEX IF NOT EXISTS run_signatures_signed_by_idx
    ON public.run_signatures (signed_by);

CREATE INDEX IF NOT EXISTS run_attachments_run_id_idx
    ON public.run_attachments (run_id);

CREATE INDEX IF NOT EXISTS run_attachments_uploaded_by_idx
    ON public.run_attachments (uploaded_by);

-- ============================================================
-- FUNÇÃO: can_sign_role
-- [AJUSTAR] Mapa papel do sistema -> papel de assinatura. Premissa a
-- confirmar com a Qualidade. Isolado aqui para troca sem tocar no resto.
-- Também valida profiles.active: usuário desativado não assina nada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_sign_role(target public.signature_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT coalesce(
        (
            SELECT CASE
                WHEN NOT p.active THEN false
                WHEN p.role = 'admin'::public.app_role THEN true
                WHEN p.role = 'operador'::public.app_role
                    THEN target = 'producao'::public.signature_role
                WHEN p.role = 'qualidade'::public.app_role
                    THEN target = 'qualidade'::public.signature_role
                WHEN p.role = 'inovacao'::public.app_role
                    THEN target IN ('inovacao'::public.signature_role,
                                    'verificacao_inovacao'::public.signature_role)
                ELSE false
            END
            FROM public.profiles p
            WHERE p.id = auth.uid()
        ),
        false
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_sign_role(public.signature_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_sign_role(public.signature_role) TO authenticated;

-- ============================================================
-- TRIGGER: assinatura é imutável
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_signature_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run_exists boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Assinatura não pode ser alterada.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.checklist_runs r WHERE r.id = OLD.run_id
        ) INTO run_exists;

        IF run_exists THEN
            RAISE EXCEPTION 'Assinatura não pode ser removida.';
        END IF;

        RETURN OLD;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS a1_prevent_signature_change_trg
    ON public.run_signatures;
CREATE TRIGGER a1_prevent_signature_change_trg
    BEFORE UPDATE OR DELETE ON public.run_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_signature_change();

-- ============================================================
-- TRIGGER: assinatura só em run submitted + assinante é o próprio user
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_signature_run_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run_status public.run_status;
BEGIN
    SELECT status INTO run_status
    FROM public.checklist_runs
    WHERE id = NEW.run_id;

    IF run_status IS NULL OR run_status <> 'submitted'::public.run_status THEN
        RAISE EXCEPTION 'Só é possível assinar um registro enviado para assinatura. Status atual: %.', coalesce(run_status::text, 'inexistente');
    END IF;

    -- Quando auth.uid() é NULL (carga administrativa / migração legada),
    -- pula a validação de signed_by e deixa o inserter decidir.
    IF auth.uid() IS NOT NULL AND NEW.signed_by <> auth.uid() THEN
        RAISE EXCEPTION 'A assinatura deve ser feita pelo próprio usuário.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a2_enforce_signature_run_state_trg
    ON public.run_signatures;
CREATE TRIGGER a2_enforce_signature_run_state_trg
    BEFORE INSERT ON public.run_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_signature_run_state();

-- ============================================================
-- TRIGGER: anexo só em run draft, e anexo nunca se edita
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_attachment_run_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run_status public.run_status;
    target_run_id uuid;
BEGIN
    -- Anexos nunca são editados, nem em draft.
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Anexos não podem ser editados. Remova e envie novamente.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        target_run_id := OLD.run_id;
    ELSE
        target_run_id := NEW.run_id;
    END IF;

    SELECT status INTO run_status
    FROM public.checklist_runs
    WHERE id = target_run_id;

    -- Se o run não existe mais, é CASCADE: deixa seguir.
    IF run_status IS NOT NULL AND run_status <> 'draft'::public.run_status THEN
        RAISE EXCEPTION 'Anexo só pode ser manipulado em registro em rascunho. Status atual: %.', run_status;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS a1_enforce_attachment_run_draft_trg
    ON public.run_attachments;
CREATE TRIGGER a1_enforce_attachment_run_draft_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.run_attachments
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_attachment_run_draft();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.run_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_attachments ENABLE ROW LEVEL SECURITY;

-- ---------- run_signatures ----------

DROP POLICY IF EXISTS run_signatures_select_authenticated
    ON public.run_signatures;
CREATE POLICY run_signatures_select_authenticated
    ON public.run_signatures
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS run_signatures_insert_authorized
    ON public.run_signatures;
CREATE POLICY run_signatures_insert_authorized
    ON public.run_signatures
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.can_sign_role(role)
        AND signed_by = auth.uid()
    );

-- ---------- run_attachments ----------

DROP POLICY IF EXISTS run_attachments_select_authenticated
    ON public.run_attachments;
CREATE POLICY run_attachments_select_authenticated
    ON public.run_attachments
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS run_attachments_insert_own_draft
    ON public.run_attachments;
CREATE POLICY run_attachments_insert_own_draft
    ON public.run_attachments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_attachments.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS run_attachments_delete_own_draft
    ON public.run_attachments;
CREATE POLICY run_attachments_delete_own_draft
    ON public.run_attachments
    FOR DELETE
    TO authenticated
    USING (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id = run_attachments.run_id
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );
