import * as React from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

const recoverSchema = z.object({
  email: z
    .string({ required_error: "Informe o e-mail" })
    .min(1, "Informe o e-mail")
    .email("E-mail inválido"),
});

type RecoverFormValues = z.infer<typeof recoverSchema>;

export function RecoverPassword() {
  const [sent, setSent] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: RecoverFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email.trim(),
        { redirectTo: `${window.location.origin}/definir-senha` },
      );
      if (error) {
        setAuthError("Não foi possível enviar o e-mail. Tente novamente.");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8">
        <div className="mb-8 flex justify-center">
          <Logo variant="color" height={32} />
        </div>

        {sent === false ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-title">Recuperar senha</h1>
              <p className="text-label mt-2">
                Informe o e-mail cadastrado. Enviaremos um link para você
                definir uma nova senha.
              </p>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                {errors.email ? (
                  <p
                    id="email-error"
                    className="text-[12px] leading-tight"
                    style={{ color: "var(--color-danger-text)" }}
                  >
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              {authError ? (
                <div
                  role="alert"
                  className="rounded-[10px] border p-3 text-[13px] leading-relaxed"
                  style={{
                    backgroundColor: "var(--color-danger-tint)",
                    borderColor: "var(--color-danger-border)",
                    color: "var(--color-danger-text)",
                  }}
                >
                  {authError}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] w-full"
              >
                {submitting ? "Enviando…" : "Enviar link"}
              </Button>

              <Button
                asChild
                variant="ghost"
                className="min-h-[44px] w-full"
              >
                <Link to="/login">Voltar para o login</Link>
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-title">Verifique seu e-mail</h1>
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-label text-center leading-relaxed">
                Se houver uma conta com esse e-mail, você receberá um link para
                definir uma nova senha em instantes.
              </p>
              <p
                className="text-center text-[12px] leading-tight"
                style={{ color: "var(--color-fg-muted)" }}
              >
                Não recebeu? Verifique a caixa de spam.
              </p>

              <Button
                asChild
                variant="ghost"
                className="min-h-[44px] w-full mt-2"
              >
                <Link to="/login">Voltar para o login</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
