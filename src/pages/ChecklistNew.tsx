import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import {
  SIGNATURE_ROLES_ORDER,
  SIGNATURE_ROLE_LABEL,
} from "@/components/signatures/signatureMeta";
import type { Database } from "@/types/database";

type AllowedProductType = "po" | "gel";

const ALLOWED_TYPES: readonly AllowedProductType[] = ["po", "gel"] as const;

const TYPE_LABEL: Record<AllowedProductType, string> = {
  po: "Pó",
  gel: "Gel",
};

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
  accompaniment_reason: z
    .enum([
      "Teste piloto",
      "Primeira produção",
      "Intercorrência de produção",
      "Alteração de fórmula",
      "Validação processo",
    ])
    .nullish(),
});

type CreateRunForm = z.infer<typeof createRunSchema>;

export function ChecklistNew() {
  const { pathname } = useLocation();
  const tipo = pathname.split("/").filter(Boolean).pop();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateRunForm>({
    resolver: zodResolver(createRunSchema),
    defaultValues: {
      product_name: "",
      client: "",
      formulation_code: "",
      production_date: "",
      accompaniment_reason: undefined,
    },
  });

  const typedProductType = (() => {
    if (!tipo) return null;
    if (!ALLOWED_TYPES.includes(tipo as AllowedProductType)) {
      return null;
    }
    return tipo as AllowedProductType;
  })();

  if (!typedProductType) {
    return <Navigate to="/checklists/novo" replace />;
  }

  const productTypeEnum = typedProductType as AllowedProductType &
    Database["public"]["Enums"]["product_type"];

  async function onSubmit(data: CreateRunForm) {
    setSubmitting(true);
    try {
      const reasonTrim = data.accompaniment_reason?.trim() ?? "";
      const params: {
        p_product_type: Database["public"]["Enums"]["product_type"];
        p_product_name: string;
        p_client: string;
        p_formulation_code: string;
        p_production_date: string;
        p_accompaniment_reason?: string;
      } = {
        p_product_type: productTypeEnum,
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
      toast.error(mapSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display">
          Novo checklist — {TYPE_LABEL[typedProductType]}
        </h1>
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
          <Controller
            control={control}
            name="accompaniment_reason"
            render={({ field }) => (
              <Select
                value={field.value ?? undefined}
                onValueChange={(v) => {
                  field.onChange(v);
                  field.onBlur();
                }}
              >
                <SelectTrigger
                  id="accompaniment_reason"
                  aria-invalid={!!errors.accompaniment_reason}
                >
                  <SelectValue placeholder="Selecione uma opção (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teste piloto">Teste piloto</SelectItem>
                  <SelectItem value="Primeira produção">Primeira produção</SelectItem>
                  <SelectItem value="Intercorrência de produção">Intercorrência de produção</SelectItem>
                  <SelectItem value="Alteração de fórmula">Alteração de fórmula</SelectItem>
                  <SelectItem value="Validação processo">Validação processo</SelectItem>
                </SelectContent>
              </Select>
            )}
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

      <Card>
        <CardHeader>
          <CardTitle>
            Após o envio, este registro seguirá para assinatura de:
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {SIGNATURE_ROLES_ORDER.map((role, idx) => (
            <div
              key={role}
              className="flex min-h-[44px] items-center gap-3 rounded-[10px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] px-4 py-2"
            >
              <span
                className="text-caption tabular-nums text-[var(--color-primary-text)]"
                aria-hidden
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                aria-hidden
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: "var(--color-brand)" }}
              />
              <span className="text-body text-[var(--color-primary-text)]">
                {SIGNATURE_ROLE_LABEL[role]}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
