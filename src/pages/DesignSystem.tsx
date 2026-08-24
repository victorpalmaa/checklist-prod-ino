import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { AppShell } from "@/components/shell/AppShell";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* =========================================================================
 *  Cálculo WCAG de luminância relativa e razão de contraste
 *  Fórmula oficial WCAG 2.1 — https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * =======================================================================*/

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function channelLuminance(c: number): number {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function aaStatus(ratio: number, isLargeText = false): string {
  const aaMin = isLargeText ? 3 : 4.5;
  const aaaMin = isLargeText ? 4.5 : 7;
  if (ratio >= aaaMin) return "AAA";
  if (ratio >= aaMin) return "AA";
  return "reprovado";
}

/* =========================================================================
 *  Tokens de cor e seus pares de uso (para cálculo de contraste real)
 * =======================================================================*/

type Swatch = {
  token: string;
  role: string;
  hex: string;
  bgHex: string;
  bgName: string;
};

const SWATCHES: Swatch[] = [
  { token: "primary", role: "texto clicável / legível", hex: "#6A4DBE", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "primary-hover", role: "estado hover primário", hex: "#5C41A6", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "primary-fg", role: "texto em botão primário", hex: "#FFFFFF", bgHex: "#6A4DBE", bgName: "primary" },
  { token: "primary-text", role: "texto sobre tint", hex: "#4A3585", bgHex: "#F3EFFE", bgName: "primary-tint" },
  { token: "brand", role: "preenchimento / identidade", hex: "#845AFA", bgHex: "#FFFFFF", bgName: "surface-card (não use como texto)" },
  { token: "brand-hover", role: "estado hover brand", hex: "#8345F6", bgHex: "#FFFFFF", bgName: "surface-card (não use como texto)" },

  { token: "fg", role: "texto de corpo", hex: "#1C1826", bgHex: "#F7F6FA", bgName: "surface-page" },
  { token: "fg-secondary", role: "texto secundário / label", hex: "#55506A", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "fg-muted (card)", role: "texto auxiliar / caption", hex: "#6F6A85", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "fg-muted (page)", role: "texto auxiliar / caption", hex: "#6F6A85", bgHex: "#F7F6FA", bgName: "surface-page" },

  { token: "success", role: "sinalização de conformidade", hex: "#32AB10", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "success-text", role: "texto em estado sucesso", hex: "#2A5E12", bgHex: "#F2F9EC", bgName: "success-tint" },

  { token: "danger", role: "sinalização de não-conformidade", hex: "#C0392B", bgHex: "#FFFFFF", bgName: "surface-card" },
  { token: "danger-text", role: "texto em estado perigo", hex: "#8C2020", bgHex: "#FCEDED", bgName: "danger-tint" },
];

/* =========================================================================
 *  Escala tipográfica
 * =======================================================================*/

type TypeSpec = {
  token: string;
  css: string;
  sample: string;
};

const TYPE_SCALE: TypeSpec[] = [
  { token: "display", css: "28px / 600 / -0.02em", sample: "Título de página" },
  { token: "title", css: "20px / 600 / -0.01em", sample: "Título de seção" },
  { token: "heading", css: "16px / 600", sample: "Título de card ou bloco" },
  { token: "body", css: "14px / 400 / 1.6", sample: "Corpo de texto e parágrafos longos — usamos Montserrat com respiro e densidade média, nunca apertado." },
  { token: "label", css: "13px / 500", sample: "Label de campo e rótulos de controle" },
  { token: "caption", css: "12px / 400", sample: "Legenda, ajuda ou meta-informação" },
  { token: "eyebrow", css: "11px / 500 / 0.06em caixa alta", sample: "Rótulo de bloco" },
];

/* =========================================================================
 *  Página de design system
 * =======================================================================*/

export function DesignSystem() {
  const [radio, setRadio] = React.useState("conforme");
  const [check1, setCheck1] = React.useState(true);
  const [check2, setCheck2] = React.useState(false);
  const [selected, setSelected] = React.useState<string | undefined>("lote-ativo");

  return (
    <AppShell pageTitle="Design system — validação Pronutrition">
      <TooltipProvider delayDuration={150}>
        <div className="space-y-10 max-w-6xl">
          {/* ======= Tipografia ======= */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-eyebrow block mb-2">Tipografia</span>
                <span className="text-title">Escala Montserrat, pesos 400/500/600/700</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-6">
                {TYPE_SCALE.map((t) => (
                  <li
                    key={t.token}
                    className="grid grid-cols-[140px_1fr] items-baseline gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-heading font-semibold text-[var(--color-fg)]">.text-{t.token}</span>
                      <span className="text-caption">{t.css}</span>
                    </div>
                    <p className={`text-${t.token} m-0`}>{t.sample}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* ======= Swatches + contraste WCAG ======= */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-eyebrow block mb-2">Cores semânticas</span>
                <span className="text-title">Swatches com contraste WCAG 2.1 calculado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Token</TableHead>
                    <TableHead className="w-40">Papel no UI</TableHead>
                    <TableHead className="w-28">Hex</TableHead>
                    <TableHead className="w-48">Amostra / fundo</TableHead>
                    <TableHead className="w-28 text-right">Contraste</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SWATCHES.map((s) => {
                    const ratio = contrastRatio(s.hex, s.bgHex);
                    const status = aaStatus(ratio);
                    const onlyFill = /não use como texto/.test(s.bgName);
                    return (
                      <TableRow key={s.token}>
                        <TableCell className="font-semibold text-[var(--color-primary-text)]">--{s.token}</TableCell>
                        <TableCell className="text-[13px] text-[var(--color-fg-secondary)]">{s.role}</TableCell>
                        <TableCell className="font-mono text-[13px] text-[var(--color-fg)] uppercase">{s.hex}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-9 w-9 rounded-[10px] border border-[var(--color-border)]"
                              style={{ backgroundColor: s.hex }}
                              aria-hidden="true"
                            />
                            <span
                              className="inline-block h-9 w-9 rounded-[10px] border border-[var(--color-border-strong)] text-[13px] font-semibold flex items-center justify-center"
                              style={{ backgroundColor: s.bgHex, color: s.hex }}
                            >
                              Aa
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[14px] text-[var(--color-fg)] font-medium">
                          {ratio.toFixed(2)} : 1
                        </TableCell>
                        <TableCell>
                          {onlyFill ? (
                            <Badge variant="outline">apenas fill</Badge>
                          ) : status === "reprovado" ? (
                            <Badge variant="destructive">reprovado</Badge>
                          ) : (
                            <Badge variant="success">{status}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ======= Logo com área de reserva ======= */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-eyebrow block mb-2">Logo — variantes oficiais</span>
                <span className="text-title">Área de reserva (25%) desenhada em tracejado. SVG ainda não fornecido.</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 md:grid-cols-3">
                {(["color", "white", "mono"] as const).map((variant) => {
                  const height = 48;
                  const padding = height * 0.25;
                  const outerH = height + padding * 2;
                  const outerW = height * 3 + padding * 2;
                  return (
                    <div
                      key={variant}
                      className="flex flex-col items-center gap-3 rounded-[12px] border border-[var(--color-border)] p-5"
                      style={{
                        backgroundColor: variant === "white" ? "var(--color-brand)" : "var(--color-surface-page)",
                      }}
                    >
                      <div
                        className="flex items-center justify-center border border-dashed rounded-[10px]"
                        style={{
                          width: outerW,
                          height: outerH,
                          borderColor: variant === "white" ? "rgba(255,255,255,0.5)" : "var(--color-border-strong)",
                        }}
                        aria-hidden="true"
                      >
                        <Logo variant={variant} height={height} />
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <Badge variant="outline">variant: {variant}</Badge>
                        <span className="text-caption" style={{ color: variant === "white" ? "rgba(255,255,255,0.85)" : undefined }}>
                          alt="Pronutrition" · altura {height}px
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ======= Controles shadcn ======= */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-eyebrow block mb-2">Controles</span>
                <span className="text-title">Todos shadcn estilizados com tokens Pronutrition</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Button variantes */}
              <div className="space-y-3">
                <span className="text-heading">Button — todas as variantes</span>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="default">Primário</Button>
                  <Button variant="secondary">Secundário</Button>
                  <Button variant="outline">Contorno</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Não conforme</Button>
                  <Button variant="default" size="sm">Sm</Button>
                  <Button variant="default" size="lg">Lg</Button>
                  <Button variant="default" size="icon" aria-label="Ícone">
                    <CheckCircle2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Input, Textarea, Select, Label */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <span className="text-heading">Input, textarea, select com label htmlFor</span>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ds-nome">Nome do operador</Label>
                      <Input id="ds-nome" placeholder="Nome completo" defaultValue="Operador 01" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ds-obs">Observações</Label>
                      <Textarea id="ds-obs" rows={3} placeholder="Campo de texto multilinha..." defaultValue="Conformidade mantida durante o turno." />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ds-lote">Linha de produção</Label>
                      <Select value={selected} onValueChange={setSelected}>
                        <SelectTrigger id="ds-lote">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lote-ativo">Lote A — Linha 1 (ativo)</SelectItem>
                          <SelectItem value="lote-b">Lote B — Linha 2</SelectItem>
                          <SelectItem value="lote-c">Lote C — Linha 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Radio + Checkbox */}
                <div className="space-y-5">
                  <div className="space-y-3">
                    <span className="text-heading">Radio group — conformidade</span>
                    <RadioGroup value={radio} onValueChange={setRadio}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="conforme" id="ds-r-conf" />
                        <Label htmlFor="ds-r-conf" className="text-body text-[var(--color-fg)]">Conforme</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="nao-conforme" id="ds-r-nc" />
                        <Label htmlFor="ds-r-nc" className="text-body text-[var(--color-fg)]">Não conforme</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="pendente" id="ds-r-p" />
                        <Label htmlFor="ds-r-p" className="text-body text-[var(--color-fg)]">Pendente de análise</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <span className="text-heading">Checkbox</span>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 min-h-[44px]">
                        <Checkbox id="ds-c1" checked={check1} onCheckedChange={(v) => setCheck1(Boolean(v))} />
                        <Label htmlFor="ds-c1" className="text-body text-[var(--color-fg)] font-normal">
                          Temperatura aferida
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 min-h-[44px]">
                        <Checkbox id="ds-c2" checked={check2} onCheckedChange={(v) => setCheck2(Boolean(v))} />
                        <Label htmlFor="ds-c2" className="text-body text-[var(--color-fg)] font-normal">
                          Assinatura do responsável
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="space-y-3">
                <span className="text-heading">Tabs</span>
                <Tabs defaultValue="resumo">
                  <TabsList>
                    <TabsTrigger value="resumo">Resumo do lote</TabsTrigger>
                    <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="resumo">
                    <div className="rounded-[12px] border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] p-4">
                      <p className="text-body text-[var(--color-primary-text)]">
                        Conteúdo da aba resumo. Densidade média com respiro, sem sombra, sem gradient.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="parametros">
                    <p className="text-body text-[var(--color-fg-secondary)]">Parâmetros do lote aqui.</p>
                  </TabsContent>
                  <TabsContent value="historico">
                    <p className="text-body text-[var(--color-fg-secondary)]">Histórico aqui.</p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Dialog */}
              <div className="space-y-3">
                <span className="text-heading">Dialog</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Abrir confirmação</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmar novo registro</DialogTitle>
                      <DialogDescription>
                        Esta ação cria um novo checklist em rascunho para o lote selecionado.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="ghost">Cancelar</Button>
                      <Button variant="default">Criar registro</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Alert variantes + Badge + Tooltip */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <span className="text-heading">Alert</span>
                  <div className="space-y-3">
                    <Alert variant="default">
                      <Info className="h-5 w-5" />
                      <AlertTitle>Lembrete</AlertTitle>
                      <AlertDescription>
                        Assinatura é obrigatória no fechamento do checklist.
                      </AlertDescription>
                    </Alert>
                    <Alert variant="success">
                      <CheckCircle2 className="h-5 w-5" />
                      <AlertTitle>Liberado</AlertTitle>
                      <AlertDescription>
                        Todos os pontos de controle estão conformes.
                      </AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                      <XCircle className="h-5 w-5" />
                      <AlertTitle>Não conformidade</AlertTitle>
                      <AlertDescription>
                        Viscosidade fora da faixa. Registro de ação corretiva exigido.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-3">
                    <span className="text-heading">Badge</span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">Primário</Badge>
                      <Badge variant="secondary">Neutro</Badge>
                      <Badge variant="purple">Roxo tint</Badge>
                      <Badge variant="success">Conforme</Badge>
                      <Badge variant="destructive">Não conforme</Badge>
                      <Badge variant="outline">Contorno</Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-heading">Tooltip</span>
                    <div className="flex items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm">
                            O que é conformidade?
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Faixa de parâmetro dentro do tolerado para o lote.
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ajuda">
                            <AlertCircle className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Passe o mouse ou foque para ler a ajuda.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}

export default DesignSystem;
