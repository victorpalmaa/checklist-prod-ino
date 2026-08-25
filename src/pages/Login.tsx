import * as React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  email: z
    .string({ required_error: "Informe o e-mail" })
    .min(1, "Informe o e-mail")
    .email("E-mail inválido"),
  password: z
    .string({ required_error: "Informe a senha" })
    .min(1, "Informe a senha"),
  persist: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function mapAuthError(message: string | undefined): string {
  if (!message) return "Não foi possível entrar. Tente novamente.";
  if (message.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (message.includes("Email not confirmed")) {
    return "E-mail ainda não confirmado.";
  }
  return "Não foi possível entrar. Tente novamente.";
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, session, loading } = useAuth();
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      persist: false,
    },
  });

  const persist = watch("persist");

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-page)]">
        <span className="text-caption">Carregando...</span>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/checklists" replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await signIn(values.email, values.password, values.persist);
      const from = (location.state as { from?: { pathname: string } })
        ?.from?.pathname ?? "/checklists";
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : undefined;
      setAuthError(mapAuthError(msg));
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

        <div className="mb-6">
          <h1 className="text-title">Entrar</h1>
          <p className="text-caption mt-2">
            Portal de checklist de produção — RED-029
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
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

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="persist"
              checked={persist}
              onCheckedChange={(v) => {
                setValue("persist", v === true);
              }}
              className="mt-0.5"
            />
            <Label htmlFor="persist" className="cursor-pointer font-normal">
              Manter conectado neste dispositivo
            </Label>
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
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
