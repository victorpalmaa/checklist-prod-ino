import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";

const createRunSchema = z.object({
  product_name: z
    .string({ required_error: "Informe o nome do produto" })
    .min(1, "Informe o nome do produto"),
  client: z
    .string({ required_error: "Informe o cliente" })
    .min(1, "Informe o cliente"),
  formulation_code: z
    .string({ required_error: "Informe o código de formulação" })
    .min(1, "Informe o código de formulação"),
  production_date: z
    .string({ required_error: "Informe a data prevista de produção" })
    .min(1, "Informe a data prevista de produção")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido"),
  accompaniment_reason: z.string().nullish(),
});

type CreateRunForm = z.infer<typeof createRunSchema>;

function mapCreateRunError(message: string | null | undefined): string {
  if (!message) return "Não foi possível criar o registro. Tente novamente.";
  if (/Sessão não autenticada/i.test(message)) {
    return "Sua sessão expirou. Saia e entre novamente.";
  }
  if (/Usuário inativo/i.test(message)) {
    return "Seu usuário não está autorizado para esta operação.";
  }
  if (/Perfil de usuário não encontrado/i.test(message)) {
    return "Perfil de usuário não localizado.";
  }
  if (/nome do produto é obrigatório/i.test(message)) {
    return "Informe o nome do produto.";
  }
  if (/cliente é obrigatório/i.test(message)) {
    return "Informe o cliente.";
  }
  if (/código de formulação é obrigatório/i.test(message)) {
    return "Informe o código de formulação.";
  }
  if (/data de produção é obrigatória/i.test(message)) {
    return "Informe a data prevista de produção.";
  }
  if (/Nenhum template publicado/i.test(message)) {
    return "Nenhum formulário publicado para este tipo de produto. Contate o administrador.";
  }
  return "Não foi possível criar o registro. Tente novamente.";
}

export function ChecklistNew() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRunForm>({
    resolver: zodResolver(createRunSchema),
    defaultValues: {
      product_name: "",
      client: "",
      formulation_code: "",
      production_date: "",
      accompaniment_reason: "",
    },
  });

  async function onSubmit(data: CreateRunForm) {
    setSubmitting(true);
    try {
      const reasonTrim = data.accompaniment_reason?.trim() ?? "";
      const params: {
        p_product_type: "po";
        p_product_name: string;
        p_client: string;
        p_formulation_code: string;
        p_production_date: string;
        p_accompaniment_reason?: string;
      } = {
        p_product_type: "po",
        p_product_name: data.product_name.trim(),
        p_client: data.client.trim(),
        p_formulation_code: data.formulation_code.trim(),
        p_production_date: data.production_date,
      };
      if (reasonTrim.length > 0) {
        params.p_accompaniment_reason = reasonTrim;
      }
      const { data: newRunId, error } = await supabase.rpc("create_run", params);
      if (error) throw error;
      if (!newRunId) {
        throw new Error("RPC não retornou um id do registro.");
      }
      navigate(`/checklists/${String(newRunId)}/editar`, { replace: true });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : undefined;
      toast.error(mapCreateRunError(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display">Novo checklist</h1>
        <p className="text-caption text-[var(--color-fg-secondary)]">
          Preencha os dados de identificação do registro. Os campos do
          RED-029 serão carregados na próxima tela.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6"
        noValidate
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="product_name" className="text-sm font-medium text-[var(--color-fg)]">
              Nome do produto
            </Label>
            <Input
              id="product_name"
              type="text"
              aria-invalid={!!errors.product_name}
              aria-describedby={errors.product_name ? "product_name-error" : undefined}
              {...register("product_name")}
            />
            {errors.product_name ? (
              <p
                id="product_name-error"
                className="text-xs"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.product_name.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="client" className="text-sm font-medium text-[var(--color-fg)]">
              Cliente
            </Label>
            <Input
              id="client"
              type="text"
              aria-invalid={!!errors.client}
              aria-describedby={errors.client ? "client-error" : undefined}
              {...register("client")}
            />
            {errors.client ? (
              <p
                id="client-error"
                className="text-xs"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.client.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="formulation_code" className="text-sm font-medium text-[var(--color-fg)]">
              Código Formulação
            </Label>
            <Input
              id="formulation_code"
              type="text"
              aria-invalid={!!errors.formulation_code}
              aria-describedby={errors.formulation_code ? "formulation_code-error" : undefined}
              {...register("formulation_code")}
            />
            {errors.formulation_code ? (
              <p
                id="formulation_code-error"
                className="text-xs"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.formulation_code.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="production_date" className="text-sm font-medium text-[var(--color-fg)]">
              Data prevista de produção
            </Label>
            <Input
              id="production_date"
              type="date"
              aria-invalid={!!errors.production_date}
              aria-describedby={errors.production_date ? "production_date-error" : undefined}
              {...register("production_date")}
            />
            {errors.production_date ? (
              <p
                id="production_date-error"
                className="text-xs"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.production_date.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="accompaniment_reason" className="text-sm font-medium text-[var(--color-fg)]">
            Motivo do Acompanhamento
          </Label>
          <Textarea
            id="accompaniment_reason"
            aria-invalid={!!errors.accompaniment_reason}
            {...register("accompaniment_reason")}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            asChild
            className="min-h-[44px] min-w-[120px]"
          >
            <Link to="/checklists/novo">Voltar</Link>
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(-1)}
              disabled={submitting}
              className="min-h-[44px] min-w-[120px]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] min-w-[140px]"
            >
              {submitting ? "Criando..." : "Criar registro"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
