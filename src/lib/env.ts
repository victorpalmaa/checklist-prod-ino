import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({
      required_error:
        "ausente. Defina no arquivo .env (copie o .env.example).",
    })
    .min(1, {
      message:
        "vazio. Defina um valor no arquivo .env (copie o .env.example).",
    })
    .url({
      message:
        "inválida: não é uma URL válida. Verifique o valor no arquivo .env.",
    })
    .refine((val) => val.startsWith("https://"), {
      message:
        "inválida: deve começar com https://. Verifique o valor no arquivo .env.",
    }),
  VITE_SUPABASE_ANON_KEY: z
    .string({
      required_error:
        "ausente. Defina no arquivo .env (copie o .env.example).",
    })
    .min(1, {
      message:
        "vazio. Defina um valor no arquivo .env (copie o .env.example).",
    })
    .min(20, {
      message:
        "muito curto (mínimo 20 caracteres). Verifique se copiou a anon key correta no arquivo .env.",
    }),
});

type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => {
    const name = issue.path.join(".");
    return `  - ${name}: ${issue.message}`;
  });
  const header =
    "[env] Falha ao carregar variáveis de ambiente. Copie o .env.example para .env e preencha os valores corretamente:";
  const fullMessage = [header, ...issues].join("\n");
  console.error(fullMessage);
  throw new Error(fullMessage);
}

export const env: Env = parsed.data;
