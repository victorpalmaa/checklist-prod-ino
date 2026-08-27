import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppRole = Database["public"]["Enums"]["app_role"];

type ListUserRow = {
  id: string;
  full_name: string;
  email: string | null;
  registration_code: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
};

const ROLE_OPTIONS: readonly { value: AppRole; label: string }[] = [
  { value: "operador", label: "Operador" },
  { value: "qualidade", label: "Qualidade" },
  { value: "inovacao", label: "Inovação" },
  { value: "admin", label: "Administrador" },
] as const;

function roleLabel(r: AppRole): string {
  return ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

function formatDateTimePtBr(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminUsers() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const profile = auth.profile;
  const isAdmin = !!(profile && profile.role === "admin");

  const qParam = searchParams.get("q") ?? "";
  const papelParam = searchParams.get("papel") ?? "all";
  const [qLocal, setQLocal] = useState(qParam);

  const listQuery = useQuery({
    queryKey: ["admin-users-list"] as const,
    queryFn: async () => {
      const supabaseAny = supabase as unknown as {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
      const result = await supabaseAny.rpc("list_users_for_admin");
      const { data, error } = result;
      if (error) {
        toast.error(mapSupabaseError(error));
        throw error;
      }
      const arr = Array.isArray(data) ? (data as unknown as ListUserRow[]) : [];
      return arr;
    },
    enabled: !auth.loading && !!auth.session && isAdmin,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredUsers = useMemo(() => {
    const list = listQuery.data ?? [];
    const q = qParam.trim().toLowerCase();
    return list.filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q)) return false;
      if (papelParam !== "all" && u.role !== papelParam) return false;
      return true;
    });
  }, [listQuery.data, qParam, papelParam]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: AppRole;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Papel atualizado.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const updateActiveMutation = useMutation({
    mutationFn: async ({
      userId,
      newActive,
    }: {
      userId: string;
      newActive: boolean;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ active: newActive })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Status atualizado.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const updateRegistrationMutation = useMutation({
    mutationFn: async ({
      userId,
      newCode,
    }: {
      userId: string;
      newCode: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ registration_code: newCode })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Matrícula atualizada.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const onQChange = (v: string) => {
    setQLocal(v);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v.trim()) next.set("q", v);
      else next.delete("q");
      return next;
    });
  };

  const onPapelChange = (v: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v && v !== "all") next.set("papel", v);
      else next.delete("papel");
      return next;
    });
  };

  const clearFilters = () => {
    setQLocal("");
    setSearchParams({});
  };

  const hasAnyFilter = qParam !== "" || papelParam !== "all";

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-8 text-center">
        <ShieldAlert
          className="h-12 w-12 shrink-0 text-[var(--color-danger-text)]"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h1 className="text-title text-[var(--color-danger-text)]">
            Acesso restrito a administradores
          </h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Esta página contém dados de usuários e só pode ser acessada por
            usuários com perfil de administrador.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display">Usuários</h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Gerencie contas e permissões de acesso ao sistema.
          </p>
        </div>
      </div>

      <div
        className="flex items-start gap-3 rounded-[12px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] p-4"
        role="note"
      >
        <Users
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary-text)]"
          aria-hidden="true"
        />
        <p className="text-body text-[var(--color-primary-text)]">
          Para criar uma nova conta, use o painel do Supabase (Authentication →
          Add user). Esta tela gerencia usuários já existentes.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-[260px]">
          <Input
            value={qLocal}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Buscar por nome…"
            aria-label="Buscar por nome"
          />
        </div>
        <div className="sm:w-[220px]">
          <Select value={papelParam} onValueChange={onPapelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {listQuery.isLoading && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-body text-[var(--color-fg-secondary)]">
          Carregando usuários…
        </div>
      )}

      {listQuery.isError && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-6 text-body text-[var(--color-danger-text)]">
          Erro ao carregar a lista de usuários. Tente novamente.
        </div>
      )}

      {listQuery.isSuccess && filteredUsers.length === 0 && !hasAnyFilter && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum usuário cadastrado
          </p>
        </div>
      )}

      {listQuery.isSuccess && filteredUsers.length === 0 && hasAnyFilter && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum resultado para os filtros aplicados
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      )}

      {listQuery.isSuccess && filteredUsers.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((row) => {
                const isSelf = row.id === profile.id;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-medium text-[var(--color-fg)]">
                          {row.full_name}
                        </span>
                        {isSelf && (
                          <span className="text-[12px] text-[var(--color-fg-muted)]">
                            (você)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[14px] text-[var(--color-fg-secondary)]">
                      {row.email ?? "—"}
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Input
                        defaultValue={row.registration_code ?? ""}
                        placeholder="(sem matrícula)"
                        aria-label={`Matrícula de ${row.full_name}`}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const newCode = raw.length > 0 ? raw : null;
                          if (
                            (row.registration_code ?? null) ===
                            (newCode ?? null)
                          ) {
                            return;
                          }
                          updateRegistrationMutation.mutate({
                            userId: row.id,
                            newCode,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={row.role}
                        disabled={isSelf || updateRoleMutation.isPending}
                        onValueChange={(v) =>
                          updateRoleMutation.mutate({
                            userId: row.id,
                            newRole: v as AppRole,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>{roleLabel(row.role)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.active}
                        aria-label={`Status de ${row.full_name}`}
                        disabled={isSelf || updateActiveMutation.isPending}
                        onClick={() =>
                          updateActiveMutation.mutate({
                            userId: row.id,
                            newActive: !row.active,
                          })
                        }
                        className={
                          "relative inline-flex h-7 min-w-[44px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 " +
                          (row.active
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]")
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full border border-[var(--color-border)] bg-[var(--color-surface-card)] transition-transform duration-150 " +
                            (row.active
                              ? "translate-x-[calc(100%-6px)]"
                              : "translate-x-[3px]")
                          }
                        />
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[14px] text-[var(--color-fg-secondary)]">
                      {formatDateTimePtBr(row.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
