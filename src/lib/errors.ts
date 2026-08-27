type PostgresErrorShape = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
};

const PGSQLSTATE_RAISE_EXCEPTION = "P0001";
const PG_CODE_UNIQUE = "23505";
const PG_CODE_FK = "23503";
const PG_CODE_NOT_NULL = "23502";
const PG_CODE_INSUFFICIENT_PRIVILEGE = "42501";
const PGRST_NOT_FOUND = "PGRST116";

const NETWORK_HINTS: readonly string[] = [
  "Failed to fetch",
  "NetworkError",
  "Load failed",
  "Network request failed",
] as const;

function looksLikeNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "string") {
    return NETWORK_HINTS.some((h) => err.includes(h));
  }
  if (err instanceof TypeError) {
    const m = err.message ?? "";
    if (/fetch/i.test(m) || /network/i.test(m)) return true;
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name ?? "")
      : "";
  if (/AuthRetryableFetchError/i.test(name)) return true;
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : "";
  return NETWORK_HINTS.some((h) => msg.includes(h));
}

function extractPgError(err: unknown): PostgresErrorShape | null {
  if (!err || typeof err !== "object") return null;
  const candidate = err as PostgresErrorShape;
  if (
    typeof candidate.code === "string" ||
    typeof candidate.message === "string"
  ) {
    return {
      code: candidate.code,
      message: candidate.message,
      details: candidate.details,
      hint: candidate.hint,
      name: candidate.name,
    };
  }
  if (
    "error" in err &&
    (err as { error?: unknown }).error &&
    typeof (err as { error?: unknown }).error === "object"
  ) {
    const inner = (err as { error: PostgresErrorShape }).error;
    if (
      typeof inner.code === "string" ||
      typeof inner.message === "string"
    ) {
      return {
        code: inner.code,
        message: inner.message,
        details: inner.details,
        hint: inner.hint,
        name: inner.name,
      };
    }
  }
  if (
    "data" in err &&
    (err as { data?: unknown }).data &&
    typeof (err as { data?: unknown }).data === "object"
  ) {
    const inner = (err as { data: PostgresErrorShape }).data;
    if (
      typeof inner.code === "string" ||
      typeof inner.message === "string"
    ) {
      return {
        code: inner.code,
        message: inner.message,
        details: inner.details,
        hint: inner.hint,
        name: inner.name,
      };
    }
  }
  return null;
}

export function mapSupabaseError(error: unknown): string {
  if (import.meta.env.DEV) {
    console.error("[supabase]", error);
  }

  // a) Falha de rede
  if (looksLikeNetworkError(error)) {
    return "Não foi possível conectar ao servidor. Verifique sua conexão.";
  }

  const pg = extractPgError(error);

  // b) P0001 RAISE EXCEPTION: usa mensagem do próprio Postgres
  if (pg?.code === PGSQLSTATE_RAISE_EXCEPTION && pg.message) {
    return pg.message;
  }
  const rawMsg =
    pg?.message ??
    (error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : typeof error === "string"
        ? error
        : "");
  // Em caso de RPC com mensagem direta mas sem code P0001, ainda assim usar mensagem se parecer pt-BR.
  // (Esta é a mensagem textual das RPCs que vêm como SupabaseClientError sem o code exposto.)
  // Fallback apenas se tiver código conhecido abaixo.

  const code = pg?.code;
  if (code === PG_CODE_UNIQUE) {
    return "Este registro já existe.";
  }
  if (code === PG_CODE_FK) {
    return "Registro relacionado não encontrado.";
  }
  if (code === PG_CODE_NOT_NULL) {
    return "Campo obrigatório não preenchido.";
  }
  if (code === PG_CODE_INSUFFICIENT_PRIVILEGE) {
    return "Você não tem permissão para esta operação.";
  }
  if (code === PGRST_NOT_FOUND || /PGRST116/i.test(rawMsg)) {
    return "Registro não encontrado.";
  }
  if (pg?.code === PGSQLSTATE_RAISE_EXCEPTION && pg.message) {
    return pg.message;
  }
  if (typeof rawMsg === "string" && rawMsg.length > 0) {
    return rawMsg;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}
