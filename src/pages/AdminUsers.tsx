import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { mapSupabaseError } from "@/lib/errors";
import type { Database } from "@/types/database";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type AppRole = Database["public"]["Enums"]["app_role"];

type ListUserRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  registration_code: string | null;
  area: string | null;
  job_title: string | null;
  invited_by_name: string | null;
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

/** Espelha a constraint profiles_area_valid. Divergir daqui quebra o
 *  UPDATE com erro de check constraint. */
const AREAS = ["Inovação", "Qualidade", "Produção"] as const;
type Area = (typeof AREAS)[number];

/** Espelha ROLES_BY_INVITER da Edge Function invite-user. O servidor e quem
 *  decide; isto so evita oferecer uma opcao que seria recusada. */
const ROLES_BY_INVITER: Record<string, AppRole[]> = {
  admin: ["operador", "qualidade", "inovacao", "admin"],
  inovacao: ["operador", "qualidade", "inovacao"],
};

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

const inviteSchema = z.object({
  first_name: z.string().min(1, "Informe o nome"),
  last_name: z.string().min(1, "Informe o sobrenome"),
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  area: z.enum(AREAS, { required_error: "Selecione a área" }),
  job_title: z.string().optional(),
  role: z.string().min(1, "Selecione o papel"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function AdminUsers() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const profile = auth.profile;
  const isAdmin = !!(profile && profile.role === "admin");
  const canView =
    isAdmin || !!(profile && profile.role === "inovacao");
  const canInvite =
    isAdmin || !!(profile && profile.role === "inovacao");
  const invitableRoles = profile
    ? (ROLES_BY_INVITER[profile.role] ?? [])
    : [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      area: undefined,
      job_title: "",
      role: "operador",
    },
  });

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
    enabled: !auth.loading && !!auth.session && canView,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredUsers = useMemo(() => {
    const list = listQuery.data ?? [];
    const q = qParam.trim().toLowerCase();
    return list.filter((u) => {
      if (q) {
        const matchesName = u.full_name.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesEmail) return false;
      }
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

  const updateFirstNameMutation = useMutation({
    mutationFn: async ({
      userId,
      newValue,
    }: {
      userId: string;
      newValue: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: newValue })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Nome atualizado.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const updateLastNameMutation = useMutation({
    mutationFn: async ({
      userId,
      newValue,
    }: {
      userId: string;
      newValue: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ last_name: newValue })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Sobrenome atualizado.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({
      userId,
      newValue,
    }: {
      userId: string;
      newValue: Area | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ area: newValue })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Área atualizada.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const updateJobTitleMutation = useMutation({
    mutationFn: async ({
      userId,
      newValue,
    }: {
      userId: string;
      newValue: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ job_title: newValue })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Cargo atualizado.");
    },
    onError: (err) => {
      toast.error(mapSupabaseError(err));
    },
  });

  const onInvite = async (values: InviteFormValues) => {
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.trim(),
          area: values.area,
          job_title: values.job_title?.trim() ?? "",
          role: values.role,
        },
      });

      if (error) {
        let msg = "Não foi possível enviar o convite.";
        if (error instanceof FunctionsHttpError) {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch {
            // corpo nao-JSON: mantem a mensagem generica
          }
        }
        toast.error(msg);
        return;
      }

      if (data?.warning) {
        toast(data.warning);
      } else {
        toast.success("Convite enviado.");
      }

      setInviteOpen(false);
      reset();
      await queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    } finally {
      setInviting(false);
    }
  };

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

  if (!canView) {
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
        {canInvite ? (
          <Button onClick={() => setInviteOpen(true)} className="min-h-[44px]">
            Convidar usuário
          </Button>
        ) : null}
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
                <TableHead>Nome completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Sobrenome</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Cargo</TableHead>
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
                        disabled={!isAdmin}
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
                      <Input
                        defaultValue={row.first_name ?? ""}
                        placeholder="(sem nome)"
                        aria-label={`Nome de ${row.full_name}`}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const newValue = raw.length > 0 ? raw : null;
                          if (
                            (row.first_name ?? null) ===
                            (newValue ?? null)
                          ) {
                            return;
                          }
                          updateFirstNameMutation.mutate({
                            userId: row.id,
                            newValue,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Input
                        defaultValue={row.last_name ?? ""}
                        placeholder="(sem sobrenome)"
                        aria-label={`Sobrenome de ${row.full_name}`}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const newValue = raw.length > 0 ? raw : null;
                          if (
                            (row.last_name ?? null) ===
                            (newValue ?? null)
                          ) {
                            return;
                          }
                          updateLastNameMutation.mutate({
                            userId: row.id,
                            newValue,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={row.area ?? ""}
                        disabled={!isAdmin || isSelf || updateAreaMutation.isPending}
                        onValueChange={(v) =>
                          updateAreaMutation.mutate({
                            userId: row.id,
                            newValue: v.length > 0 ? (v as Area) : null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          {AREAS.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Input
                        defaultValue={row.job_title ?? ""}
                        placeholder="(sem cargo)"
                        aria-label={`Cargo de ${row.full_name}`}
                        disabled={!isAdmin}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const newValue = raw.length > 0 ? raw : null;
                          if (
                            (row.job_title ?? null) ===
                            (newValue ?? null)
                          ) {
                            return;
                          }
                          updateJobTitleMutation.mutate({
                            userId: row.id,
                            newValue,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={row.role}
                        disabled={!isAdmin || isSelf || updateRoleMutation.isPending}
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
                        disabled={!isAdmin || isSelf || updateActiveMutation.isPending}
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

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              A pessoa receberá um e-mail para definir a própria senha.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(onInvite)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-first_name">Nome</Label>
              <Input
                id="invite-first_name"
                {...register("first_name")}
                aria-invalid={!!errors.first_name}
                className="min-h-[44px]"
              />
              {errors.first_name ? (
                <p className="text-[12px] font-medium text-[var(--color-danger-text)] leading-relaxed">
                  {errors.first_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-last_name">Sobrenome</Label>
              <Input
                id="invite-last_name"
                {...register("last_name")}
                aria-invalid={!!errors.last_name}
                className="min-h-[44px]"
              />
              {errors.last_name ? (
                <p className="text-[12px] font-medium text-[var(--color-danger-text)] leading-relaxed">
                  {errors.last_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                {...register("email")}
                aria-invalid={!!errors.email}
                className="min-h-[44px]"
              />
              {errors.email ? (
                <p className="text-[12px] font-medium text-[var(--color-danger-text)] leading-relaxed">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-area">Área</Label>
              <Controller
                name="area"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger
                      id="invite-area"
                      className="min-h-[44px]"
                      aria-invalid={!!errors.area}
                    >
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.area ? (
                <p className="text-[12px] font-medium text-[var(--color-danger-text)] leading-relaxed">
                  {errors.area.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-job_title">Cargo (opcional)</Label>
              <Input
                id="invite-job_title"
                {...register("job_title")}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Papel</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v)}
                  >
                    <SelectTrigger
                      id="invite-role"
                      className="min-h-[44px]"
                      aria-invalid={!!errors.role}
                    >
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {invitableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role ? (
                <p className="text-[12px] font-medium text-[var(--color-danger-text)] leading-relaxed">
                  {errors.role.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteOpen(false);
                  reset();
                }}
                className="min-h-[44px]"
                disabled={inviting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="min-h-[44px]"
                disabled={inviting}
              >
                {inviting ? "Enviando…" : "Enviar convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
