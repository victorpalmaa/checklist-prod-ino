import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";

const setPasswordSchema = z
  .object({
    password: z
      .string({ required_error: "Informe a senha" })
      .min(8, "A senha deve ter ao menos 8 caracteres"),
    confirm: z.string({ required_error: "Confirme a senha" }),
  })
  .refine((v) => v.password === v.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

function mapAuthError(message: string | undefined): string {
  if (!message) return "Não foi possível alterar a senha. Tente novamente.";

  // O texto do GoTrue ja mudou de forma entre versoes ("same password" x
  // "should be different from the old password"). Comparar em minusculas e
  // por trecho curto evita que a mensagem volte a cair no generico.
  const m = message.toLowerCase();

  if (
    m.includes("different from the old password") ||
    m.includes("same password") ||
    m.includes("same as the old")
  ) {
    return "A nova senha precisa ser diferente da senha atual.";
  }
  if (m.includes("weak password") || m.includes("password is too weak")) {
    return "A senha é muito fraca. Use uma senha mais forte.";
  }
  if (m.includes("at least") && m.includes("characters")) {
    return "A senha não atende ao tamanho mínimo exigido.";
  }
  if (
    m.includes("invalid token") ||
    m.includes("token has expired") ||
    m.includes("session") && m.includes("expired")
  ) {
    return "Este link expirou ou já foi utilizado.";
  }
  return "Não foi possível alterar a senha. Tente novamente.";
}

export function SetPassword() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirm: "",
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)]">
        <span className="text-caption">Carregando...</span>
      </div>
    );
  }

  const onSubmit = async (values: SetPasswordFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) {
        setAuthError(mapAuthError(error.message));
        return;
      }
      toast.success("Senha definida com sucesso.");
      navigate("/checklists", { replace: true });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : undefined;
      setAuthError(mapAuthError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)] px-4 py-10">
        <div className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8">
          <div className="mb-8 flex justify-center">
            <Logo variant="color" height={32} />
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-title">Link inválido</h1>
            <p className="text-label mt-2">
              Este link expirou ou já foi utilizado. Solicite um novo pela
              tela de login.
            </p>
          </div>

          <Button
            asChild
            className="min-h-[44px] w-full"
          >
            <Link to="/login">Ir para login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)] px-4 py-10">
      <div className="w-full max-w-[400px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-8">
        <div className="mb-8 flex justify-center">
          <Logo variant="color" height={32} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-title">Definir senha</h1>
          <p className="text-label mt-2">
            Escolha uma senha para acessar o portal.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password ? (
              <p
                id="password-error"
                className="text-[12px] leading-tight"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Confirme a nova senha</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirm ? "true" : "false"}
              aria-describedby={errors.confirm ? "confirm-error" : undefined}
              {...register("confirm")}
            />
            {errors.confirm ? (
              <p
                id="confirm-error"
                className="text-[12px] leading-tight"
                style={{ color: "var(--color-danger-text)" }}
              >
                {errors.confirm.message}
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
            {submitting ? "Definindo..." : "Definir senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
