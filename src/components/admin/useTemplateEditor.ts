import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { FieldDraft } from "./template-editor-meta";
import { requiresOptions } from "./template-editor-meta";

/**
 * Mutations de edicao de rascunho de template.
 *
 * Toda escrita aqui so passa porque o template esta em draft: o trigger
 * prevent_published_template_change bloqueia INSERT/UPDATE/DELETE em
 * secoes e campos de template publicado ou arquivado. O client nao
 * replica essa regra; a UI apenas esconde os controles.
 *
 * options vai no MESMO INSERT do campo. A constraint
 * form_fields_options_required_for_enum_types rejeita radio/select sem
 * options: nao existe caminho de INSERT vazio + UPDATE depois.
 */
export function useTemplateEditor(templateId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["admin-template-detail", templateId],
    });
    queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
  };

  const onError = (err: unknown) => {
    toast.error(mapSupabaseError(err));
  };

  const createSection = useMutation({
    mutationFn: async (input: {
      key: string;
      title: string;
      sort_order: number;
    }) => {
      const { error } = await supabase.from("form_sections").insert({
        template_id: templateId,
        key: input.key,
        title: input.title,
        sort_order: input.sort_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Seção criada.");
    },
    onError,
  });

  const renameSection = useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      const { error } = await supabase
        .from("form_sections")
        .update({ title: input.title })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Seção renomeada.");
    },
    onError,
  });

  const deleteSection = useMutation({
    mutationFn: async (sectionId: string) => {
      // ON DELETE CASCADE em form_fields.section_id leva os campos junto.
      const { error } = await supabase
        .from("form_sections")
        .delete()
        .eq("id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Seção excluída.");
    },
    onError,
  });

  const saveField = useMutation({
    mutationFn: async (input: {
      sectionId: string;
      fieldId: string | null;
      draft: FieldDraft;
    }) => {
      const { draft } = input;
      const options = requiresOptions(draft.field_type)
        ? draft.options
        : null;
      const payload = {
        key: draft.key,
        label: draft.label,
        field_type: draft.field_type,
        unit: draft.unit || null,
        required: draft.required,
        help_text: draft.help_text || null,
        sort_order: draft.sort_order,
        options,
        visible_if: draft.visible_if,
      };

      if (input.fieldId) {
        const { error } = await supabase
          .from("form_fields")
          .update(payload)
          .eq("id", input.fieldId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("form_fields")
          .insert({ ...payload, section_id: input.sectionId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Campo salvo.");
    },
    onError,
  });

  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase
        .from("form_fields")
        .delete()
        .eq("id", fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Campo excluído.");
    },
    onError,
  });

  const busy =
    createSection.isPending ||
    renameSection.isPending ||
    deleteSection.isPending ||
    saveField.isPending ||
    deleteField.isPending;

  return {
    createSection,
    renameSection,
    deleteSection,
    saveField,
    deleteField,
    busy,
  };
}
