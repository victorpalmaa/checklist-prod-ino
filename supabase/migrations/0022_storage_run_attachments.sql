-- 0022_storage_run_attachments.sql
-- Bloco G1 — bucket de evidências fotográficas.
--
-- Bucket PRIVADO. Acesso a arquivo só por signed URL de curta duração
-- gerada pelo client autenticado. Bucket público significaria que
-- qualquer um com o link vê a foto, inaceitável em documento controlado.
--
-- Convenção de caminho: "<run_id>/<uuid>.<ext>"
-- O primeiro segmento é o run_id, e é isso que as policies leem via
-- storage.foldername(name))[1] para amarrar o objeto ao run.
--
-- As policies de storage.objects espelham as de public.run_attachments:
-- escrita só pelo autor do run enquanto em draft, leitura para qualquer
-- autenticado (mesma visibilidade de checklist_runs).
--
-- Idempotente: pode ser reexecutada no SQL Editor sem erro.

-- ============================================================
-- 1) BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'run-attachments',
    'run-attachments',
    false,
    10485760,  -- 10 MB por arquivo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2) POLICIES EM storage.objects
-- ============================================================

DROP POLICY IF EXISTS run_attachments_object_insert ON storage.objects;
CREATE POLICY run_attachments_object_insert
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'run-attachments'
        AND owner = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS run_attachments_object_select ON storage.objects;
CREATE POLICY run_attachments_object_select
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'run-attachments');

DROP POLICY IF EXISTS run_attachments_object_delete ON storage.objects;
CREATE POLICY run_attachments_object_delete
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'run-attachments'
        AND owner = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.checklist_runs r
            WHERE r.id::text = (storage.foldername(name))[1]
              AND r.status = 'draft'::public.run_status
              AND r.created_by = auth.uid()
        )
    );

-- Sem policy de UPDATE: arquivo de evidência não é editado, é
-- removido e reenviado enquanto o run está em draft.
