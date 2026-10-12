// Fase 9 — blocos do Dashboard executivo. Recebem dados já calculados (camada de métricas).
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, ChevronDown, Info, OctagonAlert } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  KpiCard,
  SectionCard,
  SegmentedControl,
  SeloValidacao,
  EmptyState,
} from "@/components/ui-kit";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarBRL, formatarBRLCompacto, formatarMes, formatarPercentual } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Alerta, Item } from "@/data/metricas";

export type Destino =
  | "/negocios"
  | "/faturamento"
  | "/recebiveis"
  | "/controladoria"
  | "/pipe-x-faturado"
  | "/qualidade"
  | "/clientes"
  | "/jornada"
  | "/importacao";

/** Link que herda os filtros globais da URL. */
export function LinkFiltrado({
  to,
  className,
  children,
  title,
}: {
  to: Destino;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <Link to={to} search={((p: unknown) => p) as never} className={className} title={title}>
      {children}
    </Link>
  );
}

const cores = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);
const eixo = (v: number) => formatarBRLCompacto(v).replace("R$ ", "");
const tooltipBRL = (
  <ChartTooltipContent
    formatter={(v, n, it) => (
      <div className="flex w-full items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ background: (it as { color?: string }).color }}
          />
          {String(n)}
        </span>
        <span className="num font-medium">{formatarBRL(Number(v))}</span>
      </div>
    )}
  />
);

/* 1. Saudação */
export function Saudacao({
  titulo,
  corte,
  ultimaImportacao,
  selo,
}: {
  titulo: string;
  corte: string;
  ultimaImportacao?: string | null | undefined;
  selo: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-primary-container p-6 text-on-primary-container md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-label font-medium uppercase tracking-wider opacity-80">
          Dashboard executivo
        </p>
        <h1 className="mt-1 text-3xl font-medium">Visão de {titulo}</h1>
        <p className="mt-1 text-body opacity-80">
          Posição em {corte.split("-").reverse().join("/")} · Última importação{" "}
          {ultimaImportacao === undefined
            ? "carregando…"
            : ultimaImportacao
              ? new Date(ultimaImportacao).toLocaleString("pt-BR")
              : "nenhuma"}
        </p>
      </div>
      <div className="flex items-center gap-2">{selo}</div>
    </section>
  );
}

/* 2. KPIs */
export interface Kpi {
  label: string;
  valor: number;
  serie: number[];
  variacao: number | null;
  destino: Destino;
  inverter?: boolean;
  validar?: boolean;
}
export function LinhaKpis({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12" data-testid="kpis">
      {kpis.map((k) => (
        <LinkFiltrado
          key={k.label}
          to={k.destino}
          title={formatarBRL(k.valor)}
          className="rounded-[var(--radius-card)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring lg:col-span-4 xl:col-span-2"
        >
          <KpiCard
            label={k.label}
            value={formatarBRLCompacto(k.valor)}
            sparkline={k.serie}
            {...(k.variacao != null ? { variation: k.variacao } : {})}
            variationLabel={k.variacao == null ? "sem base no mês anterior" : "vs mês anterior"}
            invertColors={!!k.inverter}
            needsValidation={!!k.validar}
          />
        </LinkFiltrado>
      ))}
    </div>
  );
}

/* 3. Gráfico principal */
export type Ponto = { chave: string; pipe: number; faturado: number; recebido: number };
export function GraficoPrincipal({
  series,
  mesRef,
  buInicial,
}: {
  series: Record<"Ambas" | "Advertising" | "Analytics", { mensal: Ponto[]; acumulado: Ponto[] }>;
  mesRef: string;
  buInicial: string;
}) {
  const [modo, setModo] = useState<"mensal" | "acumulado">("mensal");
  const [bu, setBu] = useState<"Ambas" | "Advertising" | "Analytics">(
    buInicial === "Advertising" || buInicial === "Analytics" ? buInicial : "Ambas",
  );
  const dados = series[bu][modo].map((p) => ({ ...p, mes: formatarMes(`${p.chave}-01`) }));
  const cfg: ChartConfig = {
    pipe: { label: "Pipe", color: cores[0]! },
    faturado: { label: "Faturado", color: cores[1]! },
    recebido: { label: "Recebido", color: cores[2]! },
  };
  return (
    <SectionCard
      menu={false}
      title="Pipe × Faturado × Recebido"
      subtitle="12 meses do ano-base · linha tracejada = mês de referência"
      className="lg:col-span-8"
      action={
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            ariaLabel="Modo"
            value={modo}
            onChange={setModo}
            options={[
              { value: "mensal", label: "Mensal" },
              { value: "acumulado", label: "Acumulado" },
            ]}
          />
          <SegmentedControl
            ariaLabel="BU"
            value={bu}
            onChange={setBu}
            options={[
              { value: "Advertising", label: "Advertising" },
              { value: "Analytics", label: "Analytics" },
              { value: "Ambas", label: "Ambas" },
            ]}
          />
        </div>
      }
    >
      <ChartContainer config={cfg} className="h-72 w-full">
        <AreaChart data={dados}>
          <defs>
            {(["pipe", "faturado", "recebido"] as const).map((k) => (
              <linearGradient key={k} id={`g-${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={`var(--color-${k})`} stopOpacity={0.25} />
                <stop offset="1" stopColor={`var(--color-${k})`} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="mes" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={eixo} tickLine={false} axisLine={false} width={56} />
          <ChartTooltip content={tooltipBRL} />
          <ChartLegend content={<ChartLegendContent />} />
          <ReferenceLine
            x={formatarMes(`${mesRef}-01`)}
            stroke="var(--outline)"
            strokeDasharray="4 4"
          />
          {(["pipe", "faturado", "recebido"] as const).map((k) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={`var(--color-${k})`}
              fill={`url(#g-${k})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </SectionCard>
  );
}

/* 4. Jornada resumida */
export function JornadaResumida({
  etapas,
}: {
  etapas: { etapa: string; valor: number; conversao: number | null }[];
}) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  return (
    <SectionCard
      menu={false}
      title="Jornada do dinheiro"
      subtitle="Conversão entre etapas no período"
      className="lg:col-span-4"
      action={
        <LinkFiltrado
          to="/jornada"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-label font-medium text-primary hover:bg-primary/10"
        >
          Ver jornada completa <ArrowRight className="size-4" />
        </LinkFiltrado>
      }
    >
      <ol className="space-y-3">
        {etapas.map((e, i) => (
          <li key={e.etapa} title={formatarBRL(e.valor)}>
            <div className="mb-1 flex items-baseline justify-between text-body">
              <span className="text-foreground">{e.etapa}</span>
              <span className="num font-medium">{formatarBRLCompacto(e.valor)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(0, (e.valor / max) * 100)}%`, background: cores[i] }}
              />
            </div>
            {e.conversao != null && (
              <p className="num mt-0.5 text-label text-muted-foreground">
                {formatarPercentual(e.conversao)} da etapa anterior
              </p>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

/* 5. Cards de faturado e aging */
export function FaturadoPorBU({
  dados,
  produtos,
}: {
  dados: Record<string, number | string>[];
  produtos: string[];
}) {
  const cfg: ChartConfig = Object.fromEntries(
    produtos.map((p, i) => [p, { label: p, color: cores[i % cores.length]! }]),
  );
  return (
    <SectionCard
      menu={false}
      title="Faturado por BU"
      subtitle="Empilhado por produto"
      className="lg:col-span-4"
    >
      {dados.length ? (
        <LinkFiltrado to="/faturamento" className="block">
          <ChartContainer config={cfg} className="h-56 w-full">
            <BarChart data={dados}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="bu" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={eixo} tickLine={false} axisLine={false} width={52} />
              <ChartTooltip content={tooltipBRL} />
              {produtos.map((p, i) => (
                <Bar
                  key={p}
                  dataKey={p}
                  stackId="a"
                  fill={cores[i % cores.length]}
                  radius={i === produtos.length - 1 ? [6, 6, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </LinkFiltrado>
      ) : (
        <Vazio />
      )}
    </SectionCard>
  );
}

export function ListaBarras({
  titulo,
  subtitulo,
  itens,
  destino,
  className,
  extra,
}: {
  titulo: string;
  subtitulo?: string | undefined;
  itens: { nome: string; valor: number; extra?: string }[];
  destino: Destino;
  className?: string | undefined;
  extra?: ReactNode;
}) {
  const max = Math.max(...itens.map((x) => Math.abs(x.valor)), 1);
  return (
    <SectionCard
      menu={false}
      title={titulo}
      {...(subtitulo ? { subtitle: subtitulo } : {})}
      {...(className ? { className } : {})}
      action={extra}
    >
      {itens.length ? (
        <LinkFiltrado to={destino} className="block space-y-2.5">
          {itens.map((x, i) => (
            <div key={x.nome} title={formatarBRL(x.valor)}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-body">
                <span className="truncate text-foreground">{x.nome}</span>
                <span className="num shrink-0 font-medium">
                  {formatarBRLCompacto(x.valor)}
                  {x.extra && (
                    <span className="ml-2 text-label font-normal text-muted-foreground">
                      {x.extra}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Math.abs(x.valor) / max) * 100}%`,
                    background: cores[i % cores.length],
                  }}
                />
              </div>
            </div>
          ))}
        </LinkFiltrado>
      ) : (
        <Vazio />
      )}
    </SectionCard>
  );
}

export function Aging({ faixas }: { faixas: { faixa: string; valor: number; qtd: number }[] }) {
  const cfg: ChartConfig = { valor: { label: "Em aberto", color: cores[0]! } };
  const tons = [
    "var(--success)",
    "var(--warning)",
    "var(--chart-4)",
    "var(--danger)",
    "var(--destructive)",
  ];
  return (
    <SectionCard
      menu={false}
      title="Aging de recebíveis"
      subtitle="NFs em aberto na data de posição"
      className="lg:col-span-4"
    >
      <LinkFiltrado to="/recebiveis" className="block">
        <ChartContainer config={cfg} className="h-56 w-full">
          <BarChart
            data={faixas.map((f) => ({ ...f, faixa: f.faixa === ">90" ? "90+" : f.faixa }))}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="faixa" tickLine={false} axisLine={false} />
            <YAxis tickFormatter={eixo} tickLine={false} axisLine={false} width={52} />
            <ChartTooltip content={tooltipBRL} />
            <Bar dataKey="valor" name="Em aberto" radius={[6, 6, 0, 0]}>
              {faixas.map((f, i) => (
                <Cell key={f.faixa} fill={tons[i]} />
              ))}
              <LabelList
                dataKey="qtd"
                position="top"
                className="fill-muted-foreground text-[11px]"
                formatter={(v: unknown) => `${v} NF`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </LinkFiltrado>
    </SectionCard>
  );
}

/* 6. Top clientes com concentração */
export function TopClientes({
  itens,
}: {
  itens: (Item & { participacao: number; acumulado: number })[];
}) {
  return (
    <ListaBarras
      titulo="Top 10 clientes"
      subtitulo={
        itens.length
          ? `Concentração: top 10 = ${formatarPercentual(itens.at(-1)!.acumulado)} do faturado`
          : undefined
      }
      destino="/clientes"
      className="lg:col-span-7"
      itens={itens.map((x) => ({
        nome: x.chave,
        valor: x.valor,
        extra: `${formatarPercentual(x.participacao)} · acum. ${formatarPercentual(x.acumulado, 0)}`,
      }))}
    />
  );
}

/* 7. Alertas */
export function Alertas({ itens }: { itens: Alerta[] }) {
  return (
    <SectionCard
      menu={false}
      title={`Alertas e atenção (${itens.length})`}
      subtitle="Gerados por regras · limiares necessitam validação"
      className="lg:col-span-12"
      action={<SeloValidacao />}
    >
      {itens.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {itens.map((a) => {
            const Icone =
              a.prioridade === 1 ? OctagonAlert : a.prioridade === 2 ? AlertTriangle : Info;
            return (
              <li key={a.id}>
                <LinkFiltrado
                  to={a.destino}
                  className="flex items-start gap-3 rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
                >
                  <span
                    className={cn(
                      "mt-0.5 rounded-full p-1.5",
                      a.prioridade === 1
                        ? "bg-danger-soft text-danger"
                        : a.prioridade === 2
                          ? "bg-warning-soft text-warning"
                          : "bg-info-soft text-info",
                    )}
                  >
                    <Icone className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{a.titulo}</span>
                    <span className="block truncate text-label text-muted-foreground">
                      {a.detalhe}
                    </span>
                  </span>
                  {a.valor != null && (
                    <span
                      className="num shrink-0 text-body font-medium"
                      title={formatarBRL(a.valor)}
                    >
                      {formatarBRLCompacto(a.valor)}
                    </span>
                  )}
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </LinkFiltrado>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-success-soft p-4 text-body text-success">
          Nenhum alerta para os filtros atuais.
        </p>
      )}
    </SectionCard>
  );
}

/* 8. Como ler */
export function ComoLer() {
  const [aberto, setAberto] = useState(false);
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="surface-card p-5">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-title font-medium text-card-foreground">
        Como ler este dashboard
        <ChevronDown className={cn("size-5 transition-transform", aberto && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2 text-body text-muted-foreground">
        <p>
          <strong className="text-foreground">Competência</strong>: mês a que o serviço se refere.{" "}
          <strong className="text-foreground">Emissão</strong>: mês em que a NF foi emitida.{" "}
          <strong className="text-foreground">Vencimento</strong>: mês em que a NF vence.{" "}
          <strong className="text-foreground">Recebimento</strong>: mês em que o dinheiro entrou.
        </p>
        <p>
          "Faturado" segue o regime escolhido na barra de filtros (Emissão usa a data de emissão; os
          demais usam a competência). "A receber" e "Em atraso" consideram as NFs em aberto na
          data de posição (fim do período, ou hoje se o período ainda não terminou).
        </p>
        <p>
          Valores aparecem resumidos (ex.: R$ 1,2 mi); passe o mouse para ver o valor completo.
          Clique em qualquer cartão para abrir a tela detalhada com os mesmos filtros.
        </p>
        <p>
          A margem estimada (Faturado − Custos − Impostos + Créditos) e os limiares dos alertas
          ainda <strong className="text-foreground">necessitam validação</strong>.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Vazio() {
  return (
    <p className="py-10 text-center text-body text-muted-foreground">
      Sem dados para os filtros atuais.
    </p>
  );
}

export function DashboardVazio() {
  return (
    <EmptyState
      title="Nenhum dado importado"
      description="Importe a planilha para ver o dashboard."
      action={
        <LinkFiltrado
          to="/importacao"
          className="rounded-full bg-primary px-5 py-2 text-primary-foreground"
        >
          Importar planilha
        </LinkFiltrado>
      }
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-80 rounded-[var(--radius-card)] lg:col-span-8" />
        <Skeleton className="h-80 rounded-[var(--radius-card)] lg:col-span-4" />
      </div>
    </div>
  );
}
