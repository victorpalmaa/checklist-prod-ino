/**
 * Tipos do banco de dados — MANTIDOS MANUALMENTE.
 *
 * Este arquivo espelha o schema definido em supabase/migrations/
 * (0001_* a 0007_*). Não há geração automática de tipos neste projeto.
 *
 * Regra: toda vez que uma migration nova for criada e aplicada, este
 * arquivo deve ser atualizado à mão para refletir as novas tabelas,
 * colunas, enums ou RPCs. Nenhuma coluna, enum ou função do banco pode
 * existir sem a sua entrada correspondente aqui.
 *
 * Estrutura compatível com a assinatura de createClient<Database>() do
 * @supabase/supabase-js.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          registration_code: string | null;
          area: string | null;
          job_title: string | null;
          invited_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          first_name?: string | null;
          last_name?: string | null;
          registration_code?: string | null;
          area?: string | null;
          job_title?: string | null;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          registration_code?: string | null;
          area?: string | null;
          job_title?: string | null;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedSchema: "auth";
            referencedColumns: ["id"];
          },
        ];
      };
      form_templates: {
        Row: {
          id: string;
          document_code: string;
          revision: string;
          product_type: Database["public"]["Enums"]["product_type"];
          title: string;
          status: Database["public"]["Enums"]["template_status"];
          published_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_code: string;
          revision: string;
          product_type: Database["public"]["Enums"]["product_type"];
          title: string;
          status?: Database["public"]["Enums"]["template_status"];
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_code?: string;
          revision?: string;
          product_type?: Database["public"]["Enums"]["product_type"];
          title?: string;
          status?: Database["public"]["Enums"]["template_status"];
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      form_sections: {
        Row: {
          id: string;
          template_id: string;
          key: string;
          title: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          key: string;
          title: string;
          sort_order: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          key?: string;
          title?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "form_sections_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "form_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      form_fields: {
        Row: {
          id: string;
          section_id: string;
          key: string;
          label: string;
          field_type: Database["public"]["Enums"]["field_type"];
          unit: string | null;
          required: boolean;
          options: Json | null;
          validation: Json | null;
          computed_from: Json | null;
          help_text: string | null;
          sort_order: number;
          visible_if: Json | null;
        };
        Insert: {
          id?: string;
          section_id: string;
          key: string;
          label: string;
          field_type: Database["public"]["Enums"]["field_type"];
          unit?: string | null;
          required?: boolean;
          options?: Json | null;
          validation?: Json | null;
          computed_from?: Json | null;
          help_text?: string | null;
          sort_order: number;
          visible_if?: Json | null;
        };
        Update: {
          id?: string;
          section_id?: string;
          key?: string;
          label?: string;
          field_type?: Database["public"]["Enums"]["field_type"];
          unit?: string | null;
          required?: boolean;
          options?: Json | null;
          validation?: Json | null;
          computed_from?: Json | null;
          help_text?: string | null;
          sort_order?: number;
          visible_if?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "form_fields_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "form_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_runs: {
        Row: {
          id: string;
          template_id: string;
          template_snapshot: Json;
          product_name: string;
          client: string;
          formulation_code: string;
          batch_number: string | null;
          accompaniment_reason: string | null;
          production_date: string;
          status: Database["public"]["Enums"]["run_status"];
          created_by: string;
          submitted_at: string | null;
          completed_at: string | null;
          voided_reason: string | null;
          supersedes_run_id: string | null;
          legacy_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          template_snapshot: Json;
          product_name: string;
          client: string;
          formulation_code: string;
          batch_number?: string | null;
          accompaniment_reason?: string | null;
          production_date: string;
          status?: Database["public"]["Enums"]["run_status"];
          created_by: string;
          submitted_at?: string | null;
          completed_at?: string | null;
          voided_reason?: string | null;
          supersedes_run_id?: string | null;
          legacy_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          template_snapshot?: Json;
          product_name?: string;
          client?: string;
          formulation_code?: string;
          batch_number?: string | null;
          accompaniment_reason?: string | null;
          production_date?: string;
          status?: Database["public"]["Enums"]["run_status"];
          created_by?: string;
          submitted_at?: string | null;
          completed_at?: string | null;
          voided_reason?: string | null;
          supersedes_run_id?: string | null;
          legacy_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checklist_runs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "form_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checklist_runs_supersedes_run_id_fkey";
            columns: ["supersedes_run_id"];
            isOneToOne: false;
            referencedRelation: "checklist_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      run_values: {
        Row: {
          id: string;
          run_id: string;
          section_key: string;
          field_key: string;
          value_text: string | null;
          value_num: number | null;
          value_bool: boolean | null;
          value_date: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          section_key: string;
          field_key: string;
          value_text?: string | null;
          value_num?: number | null;
          value_bool?: boolean | null;
          value_date?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          section_key?: string;
          field_key?: string;
          value_text?: string | null;
          value_num?: number | null;
          value_bool?: boolean | null;
          value_date?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_values_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "checklist_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "run_values_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      run_signatures: {
        Row: {
          id: string;
          run_id: string;
          role: Database["public"]["Enums"]["signature_role"];
          signed_by: string;
          signed_name: string;
          statement: string;
          observation: string | null;
          signed_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          role: Database["public"]["Enums"]["signature_role"];
          signed_by: string;
          signed_name: string;
          statement: string;
          observation?: string | null;
          signed_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          role?: Database["public"]["Enums"]["signature_role"];
          signed_by?: string;
          signed_name?: string;
          statement?: string;
          observation?: string | null;
          signed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_signatures_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "checklist_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "run_signatures_signed_by_fkey";
            columns: ["signed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      run_attachments: {
        Row: {
          id: string;
          run_id: string;
          section_key: string | null;
          field_key: string | null;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string;
          uploaded_at: string;
          copied_from_attachment_id: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          section_key?: string | null;
          field_key?: string | null;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string;
          uploaded_at?: string;
          copied_from_attachment_id?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          section_key?: string | null;
          field_key?: string | null;
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number;
          uploaded_by?: string;
          uploaded_at?: string;
          copied_from_attachment_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "run_attachments_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "checklist_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "run_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          table_name: string;
          record_id: string;
          action: string;
          actor_id: string | null;
          before: Json | null;
          after: Json | null;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          table_name: string;
          record_id: string;
          action: string;
          actor_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          occurred_at?: string;
        };
        Update: {
          id?: number;
          table_name?: string;
          record_id?: string;
          action?: string;
          actor_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_run: {
        Args: {
          p_product_type: Database["public"]["Enums"]["product_type"];
          p_product_name: string;
          p_client: string;
          p_formulation_code: string;
          p_production_date: string;
          p_accompaniment_reason?: string;
        };
        Returns: string;
      };
      submit_run: {
        Args: {
          p_run_id: string;
        };
        Returns: undefined;
      };
      sign_run: {
        Args: {
          p_run_id: string;
          p_role: Database["public"]["Enums"]["signature_role"];
          p_statement: string;
        };
        Returns: undefined;
      };
      void_and_supersede_run: {
        Args: {
          p_run_id: string;
          p_reason: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "operador" | "qualidade" | "inovacao" | "admin";
      field_type:
        | "text"
        | "textarea"
        | "number"
        | "date"
        | "radio"
        | "select"
        | "checkbox"
        | "computed_avg";
      product_type: "po" | "capsula" | "gel";
      run_status: "draft" | "submitted" | "signed" | "voided";
      signature_role:
        | "producao"
        | "qualidade"
        | "inovacao"
        | "verificacao_inovacao";
      template_status: "draft" | "published" | "archived";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
