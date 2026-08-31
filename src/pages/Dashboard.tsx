import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { RunStatus } from "@/types/form";
import { PRODUCT_TYPE_LABEL } from "@/lib/products";
import type { ProductType } from "@/lib/products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  RUN_STATUS_LABEL,
  type RunStatusValue,
} from "@/components/status/run-status-meta";

type RunRow = Pick<
  Database["public"]["Tables"]["checklist_runs"]["Row"],
  | "id"
  | "product_name"
  | "client"
  | "status"
  | "created_at"
  | "submitted_at"
  | "completed_at"
  | "template_id"
  | "accompaniment_reason"
>;

type TemplateRow = Pick<
  Database["public"]["Tables"]["form_templates"]["Row"],
  "id" | "product_type"
>;

const STATUS_CHART_FILL: Record<RunStatus, string> = {
  draft: "var(--color-fg-muted)",
  submitted: "var(--color-brand)",
  signed: "var(--color-success)",
  voided: "var(--color-danger)",
};

const PRODUCT_CHART_COLORS: Record<ProductType, string> = {
  po: "var(--color-brand)",
  gel: "var(--color-success)",
  capsula: "var(--color-fg)",
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function weekKey(date: Date): string {
  const sow = startOfWeek(date);
  return `${sow.getFullYear()}-W${String(
    Math.ceil(
      ((sow.getTime() -
        new Date(sow.getFullYear(), 0, 1).getTime()) /
        86400000 +
        new Date(sow.getFullYear(), 0, 1).getDay() +
        1) /
        7
    )
  ).padStart(2, "0")}`;
}

function weekLabel(date: Date): string {
  const sow = startOfWeek(date);
  return `${sow.getDate().toString().padStart(2, "0")}/${(sow.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

function monthKey(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  const d = new Date(date);
  const shortMonths = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  const month = shortMonths[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${year}`;
}

interface FormToggle {
  incluirTeste: boolean;
}

export function Dashboard() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const incluirTesteParam = searchParams.get("incluirTeste");
  const incluirTeste = incluirTesteParam !== "0";

  const { control } = useForm<FormToggle>({
    defaultValues: {
      incluirTeste,
    },
    values: {
      incluirTeste,
    },
  });

  const setIncluirTeste = (value: boolean) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.delete("incluirTeste");
      } else {
        next.set("incluirTeste", "0");
      }
      return next;
    });
  };

  const runsQuery = useQuery({
    queryKey: ["dashboard-runs", incluirTeste] as const,
    queryFn: async () => {
      let builder = supabase
        .from("checklist_runs")
        .select(
          "id, product_name, client, status, created_at, submitted_at, completed_at, template_id, accompaniment_reason"
        )
        .order("created_at", { ascending: false });
      if (!incluirTeste) {
        builder = builder.not("client", "ilike", "[TESTE-SEED]%");
      }
      const { data, error } = await builder;
      if (error) {
        toast.error("Não foi possível carregar os dados do dashboard.");
        throw error;
      }
      return (data ?? []) as RunRow[];
    },
    enabled: !auth.loading && !!auth.session,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const templatesQuery = useQuery({
    queryKey: ["dashboard-templates"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_templates")
        .select("id, product_type");
      if (error) {
        toast.error("Não foi possível carregar os dados de templates.");
        throw error;
      }
      return (data ?? []) as TemplateRow[];
    },
    enabled: !auth.loading && !!auth.session,
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const templateMap = useMemo(() => {
    const m = new Map<string, ProductType>();
    for (const t of templatesQuery.data ?? []) {
      m.set(t.id, t.product_type);
    }
    return m;
  }, [templatesQuery.data]);

  const empty = runs.length === 0;
  const loading = runsQuery.isLoading || templatesQuery.isLoading;
  const error = runsQuery.isError || templatesQuery.isError;

  const statusData = useMemo(() => {
    const counts: Record<RunStatus, number> = {
      draft: 0,
      submitted: 0,
      signed: 0,
      voided: 0,
    };
    for (const r of runs) counts[r.status] += 1;
    return (Object.keys(counts) as RunStatus[]).map((s) => ({
      status: s,
      label: RUN_STATUS_LABEL[s as RunStatusValue] ?? s,
      count: counts[s],
      fill: STATUS_CHART_FILL[s],
    }));
  }, [runs]);

  const weeklyData = useMemo(() => {
    const buckets: Record<string, { key: string; label: string; count: number }> =
      {};
    const today = new Date();
    const weeks: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const sow = startOfWeek(d);
      const k = weekKey(sow);
      buckets[k] = { key: k, label: weekLabel(sow), count: 0 };
      weeks.push(sow);
    }
    for (const r of runs) {
      const d = new Date(r.created_at);
      const k = weekKey(d);
      if (buckets[k]) buckets[k].count += 1;
    }
    return weeks.map((w) => buckets[weekKey(w)]);
  }, [runs]);

  const productData = useMemo(() => {
    const counts: Partial<Record<ProductType, number>> = {};
    for (const r of runs) {
      const pt = templateMap.get(r.template_id);
      if (pt) counts[pt] = (counts[pt] ?? 0) + 1;
    }
    return (Object.keys(counts) as ProductType[]).map((pt) => ({
      productType: pt,
      label: PRODUCT_TYPE_LABEL[pt],
      count: counts[pt] ?? 0,
      fill: PRODUCT_CHART_COLORS[pt],
    }));
  }, [runs, templateMap]);

  // Lista fechada definida pela Qualidade (ChecklistNew). Motivos fora
  // dela vem de runs anteriores a essa decisao e caem em "Nao informado".
  const reasonData = useMemo(() => {
    const REASONS = [
      "Teste piloto",
      "Primeira produção",
      "Intercorrência de produção",
      "Alteração de fórmula",
      "Validação processo",
    ] as const;

    const counts = new Map<string, number>();
    for (const r of REASONS) counts.set(r, 0);
    let outros = 0;

    for (const run of runs) {
      const reason = run.accompaniment_reason?.trim() ?? "";
      if (!reason) {
        outros += 1;
      } else if (counts.has(reason)) {
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
      } else {
        outros += 1;
      }
    }

    const rows = [...counts.entries()].map(([label, count]) => ({
      label,
      count,
    }));
    if (outros > 0) rows.push({ label: "Não informado", count: outros });
    return rows;
  }, [runs]);

  const monthlyData = useMemo(() => {
    const buckets: Record<string, { key: string; label: string; count: number }> =
      {};
    const today = new Date();
    const months: Date[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = monthKey(d);
      buckets[k] = { key: k, label: monthLabel(d), count: 0 };
      months.push(d);
    }
    for (const r of runs) {
      const d = new Date(r.created_at);
      const k = monthKey(d);
      if (buckets[k]) buckets[k].count += 1;
    }
    return months.map((m) => buckets[monthKey(m)]);
  }, [runs]);

  const avgCompletionDays = useMemo(() => {
    let totalMs = 0;
    let n = 0;
    for (const r of runs) {
      if (r.status !== "signed" || !r.completed_at) continue;
      const ms =
        new Date(r.completed_at).getTime() - new Date(r.created_at).getTime();
      if (Number.isFinite(ms) && ms >= 0) {
        totalMs += ms;
        n += 1;
      }
    }
    if (n === 0) return null;
    return totalMs / n / (1000 * 60 * 60 * 24);
  }, [runs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display">Dashboard</h1>
          <p className="text-body text-[var(--color-fg-secondary)]">
            Visão analítica dos checklists da Pronutrition.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
        <Controller
          control={control}
          name="incluirTeste"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Checkbox
                id="incluirTeste"
                checked={field.value}
                onCheckedChange={(v) => {
                  const bool = Boolean(v);
                  field.onChange(bool);
                  setIncluirTeste(bool);
                }}
              />
              <Label
                htmlFor="incluirTeste"
                className="text-[14px] font-medium"
              >
                Incluir dados de teste
              </Label>
            </div>
          )}
        />
      </div>

      {incluirTeste && (
        <div
          className="rounded-[12px] border px-4 py-3 text-body"
          style={{
            borderColor: "var(--color-danger-border)",
            backgroundColor: "var(--color-danger-tint)",
            color: "var(--color-danger-text)",
          }}
        >
          Exibindo dados sintéticos de teste. Desligue o filtro acima para ver
          apenas dados reais de produção.
        </div>
      )}

      {loading && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-body text-[var(--color-fg-secondary)]">
          Carregando dados…
        </div>
      )}

      {error && (
        <div className="rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] p-6 text-body text-[var(--color-danger-text)]">
          Erro ao carregar o dashboard. Tente novamente.
        </div>
      )}

      {!loading && !error && empty && (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6 text-center">
          <p className="text-body text-[var(--color-fg-secondary)]">
            Nenhum dado encontrado para os filtros aplicados
          </p>
        </div>
      )}

      {!loading && !error && !empty && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Registros por status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--color-fg)",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={entry.fill}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros criados por semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weeklyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--color-fg)",
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-brand)"
                      strokeWidth={2}
                      dot={{
                        fill: "var(--color-brand)",
                        strokeWidth: 0,
                        r: 4,
                      }}
                      activeDot={{
                        fill: "var(--color-brand)",
                        strokeWidth: 0,
                        r: 6,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por tipo de produto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                {productData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-body text-[var(--color-fg-secondary)]">
                    Sem dados suficientes
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productData}
                        dataKey="count"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                        stroke="var(--color-surface-card)"
                        strokeWidth={2}
                      >
                        {productData.map((entry) => (
                          <Cell
                            key={entry.productType}
                            fill={entry.fill}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "10px",
                          color: "var(--color-fg)",
                          fontSize: 13,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {productData.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {productData.map((entry) => (
                    <div
                      key={entry.productType}
                      className="flex items-center gap-2 text-[13px] text-[var(--color-fg-secondary)]"
                    >
                      <span
                        className="h-3 w-3 rounded-[4px]"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span>
                        {entry.label}: {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tempo médio até conclusão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
                {avgCompletionDays === null ? (
                  <p className="text-body text-[var(--color-fg-secondary)]">
                    Sem dados suficientes
                  </p>
                ) : (
                  <>
                    <p
                      className="text-display"
                      style={{ color: "var(--color-brand)" }}
                    >
                      {avgCompletionDays.toFixed(2)}
                    </p>
                    <p className="text-body text-[var(--color-fg-secondary)]">
                      dias em média entre criação e conclusão
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Motivo do acompanhamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reasonData}
                    layout="vertical"
                    margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={150}
                      tick={{ fontSize: 11, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--color-fg)",
                        fontSize: 13,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-brand)"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registros por mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "var(--color-fg-secondary)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-border)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "10px",
                        color: "var(--color-fg)",
                        fontSize: 13,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-brand)"
                      strokeWidth={2}
                      dot={{
                        fill: "var(--color-brand)",
                        strokeWidth: 0,
                        r: 4,
                      }}
                      activeDot={{
                        fill: "var(--color-brand)",
                        strokeWidth: 0,
                        r: 6,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
