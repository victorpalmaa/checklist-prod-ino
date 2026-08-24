-- BLOCO B4 — form_templates, form_sections, form_fields
-- RED-029 REV. 06 — Definição de templates de formulário
-- Template e Run são separados: editar template nunca altera run preenchido.
-- Idempotente: pode ser reexecutado no SQL Editor sem erro.

-- ============================================================
-- TABELA public.form_templates
-- Cabeçalho da revisão do formulário RED-029.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_templates (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    document_code text NOT NULL,
    revision text NOT NULL,
    product_type public.product_type NOT NULL,
    title text NOT NULL,
    status public.template_status NOT NULL DEFAULT 'draft'::public.template_status,
    published_at timestamptz,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS form_templates_document_revision_product_uq
    ON public.form_templates (document_code, revision, product_type);

COMMENT ON TABLE public.form_templates IS
    'Cabeçalho de revisão do formulário RED-029. UNIQUE(document_code, revision, product_type).';

COMMENT ON COLUMN public.form_templates.id IS
    'PK UUID, gerada por extensions.gen_random_uuid().';

COMMENT ON COLUMN public.form_templates.document_code IS
    'Código do documento, ex.: RED-029.';

COMMENT ON COLUMN public.form_templates.revision IS
    'Revisão do documento, ex.: 06. Cresce com alterações de formulário.';

COMMENT ON COLUMN public.form_templates.product_type IS
    'Tipo de produto: po / capsula / gel. Seleciona campos específicos.';

COMMENT ON COLUMN public.form_templates.title IS
    'Título de exibição do template para operadores e qualidade.';

COMMENT ON COLUMN public.form_templates.status IS
    'Ciclo de vida: draft / published / archived.';

COMMENT ON COLUMN public.form_templates.published_at IS
    'Data de publicação. Não NULL quando status = published.';

COMMENT ON COLUMN public.form_templates.created_by IS
    'Perfil admin que criou ou publicou esta revisão do template.';

COMMENT ON COLUMN public.form_templates.created_at IS
    'Data de criação do registro de template. Default now().';

-- ============================================================
-- TABELA public.form_sections
-- Agrupamento visual e lógico de campos dentro de um template.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_sections (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    template_id uuid NOT NULL
        REFERENCES public.form_templates(id) ON DELETE CASCADE,
    key text NOT NULL,
    title text NOT NULL,
    sort_order int NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS form_sections_template_key_uq
    ON public.form_sections (template_id, key);

COMMENT ON TABLE public.form_sections IS
    'Seção de campos do formulário. Ordem e agrupamento visual.';

COMMENT ON COLUMN public.form_sections.id IS
    'PK UUID da seção.';

COMMENT ON COLUMN public.form_sections.template_id IS
    'FK para form_templates. ON DELETE CASCADE.';

COMMENT ON COLUMN public.form_sections.key IS
    'Identificador estável da seção. UNIQUE com template_id.';

COMMENT ON COLUMN public.form_sections.title IS
    'Título exibido no cabeçalho da seção.';

COMMENT ON COLUMN public.form_sections.sort_order IS
    'Ordem de exibição dentro do template. Crescente.';

-- ============================================================
-- TABELA public.form_fields
-- Definição de cada campo do formulário dinâmico.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_fields (
    id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    section_id uuid NOT NULL
        REFERENCES public.form_sections(id) ON DELETE CASCADE,
    key text NOT NULL,
    label text NOT NULL,
    field_type public.field_type NOT NULL,
    unit text,
    required boolean NOT NULL DEFAULT false,
    options jsonb,
    validation jsonb,
    computed_from jsonb,
    help_text text,
    sort_order int NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS form_fields_section_key_uq
    ON public.form_fields (section_id, key);

COMMENT ON TABLE public.form_fields IS
    'Definição de cada campo do formulário, por seção.';

COMMENT ON COLUMN public.form_fields.id IS
    'PK UUID do campo.';

COMMENT ON COLUMN public.form_fields.section_id IS
    'FK para form_sections. ON DELETE CASCADE.';

COMMENT ON COLUMN public.form_fields.key IS
    'Identificador estável do campo. UNIQUE com section_id.';

COMMENT ON COLUMN public.form_fields.label IS
    'Rótulo exibido ao lado do input no formulário.';

COMMENT ON COLUMN public.form_fields.field_type IS
    'Tipo de input: text, textarea, number, date, radio, select, checkbox, computed_avg.';

COMMENT ON COLUMN public.form_fields.unit IS
    'Unidade de medida: g/cm³, °C, cP, %, min etc. Null quando não aplicável.';

COMMENT ON COLUMN public.form_fields.required IS
    'Flag de campo obrigatório. Default false.';

COMMENT ON COLUMN public.form_fields.options IS
    'Opções fechadas para radio/select. Array jsonb não vazio quando aplicável.';

COMMENT ON COLUMN public.form_fields.validation IS
    'Regras de validação: min, max, step etc. Objeto jsonb.';

COMMENT ON COLUMN public.form_fields.computed_from IS
    'Chaves de campos usados em computed_avg (média de densidade). Array jsonb.';

COMMENT ON COLUMN public.form_fields.help_text IS
    'Texto auxiliar exibido abaixo do campo.';

COMMENT ON COLUMN public.form_fields.sort_order IS
    'Ordem de exibição dentro da seção. Crescente.';

-- ============================================================
-- ÍNDICES DE CONSULTA
-- ============================================================

CREATE INDEX IF NOT EXISTS form_templates_product_type_status_idx
    ON public.form_templates (product_type, status);

CREATE INDEX IF NOT EXISTS form_sections_template_sort_order_idx
    ON public.form_sections (template_id, sort_order);

CREATE INDEX IF NOT EXISTS form_fields_section_sort_order_idx
    ON public.form_fields (section_id, sort_order);

-- ============================================================
-- CONSTRAINTS DE INTEGRIDADE (idempotentes via pg_constraint)
-- ============================================================

-- form_fields: radio/select -> options array jsonb com pelo menos 1 elemento
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'form_fields_options_required_for_enum_types'
          AND conrelid = 'public.form_fields'::regclass
    ) THEN
        ALTER TABLE public.form_fields
            ADD CONSTRAINT form_fields_options_required_for_enum_types
            CHECK (
                field_type NOT IN ('radio'::public.field_type, 'select'::public.field_type)
                OR (
                    options IS NOT NULL
                    AND jsonb_typeof(options) = 'array'
                    AND jsonb_array_length(options) >= 1
                )
            );
    END IF;
END $$;

-- form_fields: computed_avg -> computed_from array jsonb com pelo menos 2 elementos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'form_fields_computed_from_required_for_avg'
          AND conrelid = 'public.form_fields'::regclass
    ) THEN
        ALTER TABLE public.form_fields
            ADD CONSTRAINT form_fields_computed_from_required_for_avg
            CHECK (
                field_type <> 'computed_avg'::public.field_type
                OR (
                    computed_from IS NOT NULL
                    AND jsonb_typeof(computed_from) = 'array'
                    AND jsonb_array_length(computed_from) >= 2
                )
            );
    END IF;
END $$;

-- form_templates: published -> published_at NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'form_templates_published_at_required'
          AND conrelid = 'public.form_templates'::regclass
    ) THEN
        ALTER TABLE public.form_templates
            ADD CONSTRAINT form_templates_published_at_required
            CHECK (
                status <> 'published'::public.template_status
                OR published_at IS NOT NULL
            );
    END IF;
END $$;

-- ============================================================
-- TRIGGER DE IMUTABILIDADE DE TEMPLATE PUBLICADO
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_published_template_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tpl_status public.template_status;
BEGIN
    -- ============================================================
    -- Caso 1: disparo em form_templates (TG_TABLE_NAME = 'form_templates')
    -- ============================================================
    IF TG_TABLE_NAME = 'form_templates' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.status <> 'draft'::public.template_status THEN
                RAISE EXCEPTION 'Não é possível excluir um template publicado ou arquivado.';
            END IF;
            RETURN OLD;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            -- Transições de status permitidas:
            --   draft → published
            --   draft → archived
            --   published → archived
            -- Nenhuma transição que retorne para draft ou saia de archived.
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                IF NOT (
                    (OLD.status = 'draft'::public.template_status AND NEW.status IN ('published'::public.template_status, 'archived'::public.template_status))
                 OR (OLD.status = 'published'::public.template_status AND NEW.status = 'archived'::public.template_status)
                ) THEN
                    RAISE EXCEPTION 'Transição de status inválida: % para %.', OLD.status, NEW.status;
                END IF;
            END IF;

            -- published_at só pode ser alterado durante a transição draft → published.
            -- Em qualquer outro UPDATE de template não-draft, é imutável.
            IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
                IF NOT (OLD.status = 'draft'::public.template_status AND NEW.status = 'published'::public.template_status) THEN
                    RAISE EXCEPTION 'A data de publicação não pode ser alterada.';
                END IF;
            END IF;

            IF OLD.status <> 'draft'::public.template_status THEN
                -- Qualquer outra alteração em coluna de conteúdo bloqueia.
                IF
                    NEW.id IS DISTINCT FROM OLD.id
                    OR NEW.document_code IS DISTINCT FROM OLD.document_code
                    OR NEW.revision IS DISTINCT FROM OLD.revision
                    OR NEW.product_type IS DISTINCT FROM OLD.product_type
                    OR NEW.title IS DISTINCT FROM OLD.title
                    OR NEW.created_by IS DISTINCT FROM OLD.created_by
                    OR NEW.created_at IS DISTINCT FROM OLD.created_at
                THEN
                    RAISE EXCEPTION 'Template publicado é somente leitura. Crie uma nova revisão.';
                END IF;
            END IF;
            RETURN NEW;
        END IF;

        RETURN COALESCE(NEW, OLD);
    END IF;

    -- ============================================================
    -- Caso 2: disparo em form_sections
    -- ============================================================
    IF TG_TABLE_NAME = 'form_sections' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT status INTO tpl_status
            FROM public.form_templates
            WHERE id = OLD.template_id;
            -- Se o template pai não existe mais (tpl_status NULL), o CASCADE
            -- de form_templates está rodando: deixa seguir, não bloqueia.
            IF tpl_status IS NOT NULL AND tpl_status <> 'draft'::public.template_status THEN
                RAISE EXCEPTION 'Não é possível alterar seções ou campos de um template publicado.';
            END IF;
            RETURN OLD;
        ELSE
            SELECT status INTO tpl_status
            FROM public.form_templates
            WHERE id = NEW.template_id;
            IF tpl_status IS NOT NULL AND tpl_status <> 'draft'::public.template_status THEN
                RAISE EXCEPTION 'Não é possível alterar seções ou campos de um template publicado.';
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    -- ============================================================
    -- Caso 3: disparo em form_fields
    -- Precisa subir até a seção e daí até o template.
    -- ============================================================
    IF TG_TABLE_NAME = 'form_fields' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT t.status INTO tpl_status
            FROM public.form_sections s
            JOIN public.form_templates t ON t.id = s.template_id
            WHERE s.id = OLD.section_id;
            IF tpl_status IS NOT NULL AND tpl_status <> 'draft'::public.template_status THEN
                RAISE EXCEPTION 'Não é possível alterar seções ou campos de um template publicado.';
            END IF;
            RETURN OLD;
        ELSE
            SELECT t.status INTO tpl_status
            FROM public.form_sections s
            JOIN public.form_templates t ON t.id = s.template_id
            WHERE s.id = NEW.section_id;
            IF tpl_status IS NOT NULL AND tpl_status <> 'draft'::public.template_status THEN
                RAISE EXCEPTION 'Não é possível alterar seções ou campos de um template publicado.';
            END IF;
            RETURN NEW;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers individuais por tabela e operação.
DROP TRIGGER IF EXISTS form_templates_published_immutable_trg
    ON public.form_templates;
CREATE TRIGGER form_templates_published_immutable_trg
    BEFORE UPDATE OR DELETE ON public.form_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_published_template_change();

DROP TRIGGER IF EXISTS form_sections_published_immutable_trg
    ON public.form_sections;
CREATE TRIGGER form_sections_published_immutable_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.form_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_published_template_change();

DROP TRIGGER IF EXISTS form_fields_published_immutable_trg
    ON public.form_fields;
CREATE TRIGGER form_fields_published_immutable_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.form_fields
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_published_template_change();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- ---------- form_templates ----------

DROP POLICY IF EXISTS form_templates_select_visible
    ON public.form_templates;
CREATE POLICY form_templates_select_visible
    ON public.form_templates
    FOR SELECT
    TO authenticated
    USING (status = 'published'::public.template_status OR public.is_admin());

DROP POLICY IF EXISTS form_templates_write_admin
    ON public.form_templates;
CREATE POLICY form_templates_write_admin
    ON public.form_templates
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_templates_update_admin
    ON public.form_templates;
CREATE POLICY form_templates_update_admin
    ON public.form_templates
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_templates_delete_admin
    ON public.form_templates;
CREATE POLICY form_templates_delete_admin
    ON public.form_templates
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ---------- form_sections ----------

DROP POLICY IF EXISTS form_sections_select_visible
    ON public.form_sections;
CREATE POLICY form_sections_select_visible
    ON public.form_sections
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.form_templates t
            WHERE t.id = form_sections.template_id
              AND (t.status = 'published'::public.template_status OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS form_sections_write_admin
    ON public.form_sections;
CREATE POLICY form_sections_write_admin
    ON public.form_sections
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_sections_update_admin
    ON public.form_sections;
CREATE POLICY form_sections_update_admin
    ON public.form_sections
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_sections_delete_admin
    ON public.form_sections;
CREATE POLICY form_sections_delete_admin
    ON public.form_sections
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ---------- form_fields ----------

DROP POLICY IF EXISTS form_fields_select_visible
    ON public.form_fields;
CREATE POLICY form_fields_select_visible
    ON public.form_fields
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.form_sections s
            JOIN public.form_templates t ON t.id = s.template_id
            WHERE s.id = form_fields.section_id
              AND (t.status = 'published'::public.template_status OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS form_fields_write_admin
    ON public.form_fields;
CREATE POLICY form_fields_write_admin
    ON public.form_fields
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_fields_update_admin
    ON public.form_fields;
CREATE POLICY form_fields_update_admin
    ON public.form_fields
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS form_fields_delete_admin
    ON public.form_fields;
CREATE POLICY form_fields_delete_admin
    ON public.form_fields
    FOR DELETE
    TO authenticated
    USING (public.is_admin());
