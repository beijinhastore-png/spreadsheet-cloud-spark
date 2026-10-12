import { useState } from "react";
import { FilterBar, filtrosIniciais, type Filtros } from "@/components/filter-bar";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  PageHeader,
  KpiCard,
  StatusBadge,
  ValidacaoBadge,
  EmptyState,
  DataTable,
  Skeleton,
  type Column,
  type Status,
} from "@/components/base";
import { Button } from "@/components/ui/button";
import {
  formatarBRL,
  formatarBRLCompacto,
  formatarData,
  formatarMes,
  formatarPercentual,
  formatarPercentualSinal,
} from "@/lib/format";
import {
  AnimatedTabs,
  AssistChip,
  ChartTooltip,
  FilterChip,
  SectionCard,
  SegmentedControl,
} from "@/components/ui-kit";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/design-system")({
  head: () => ({
    meta: [
      { title: "Design system — Controladoria" },
      {
        name: "description",
        content: "Tokens visuais e componentes-base do sistema de controladoria.",
      },
      { property: "og:title", content: "Design system — Controladoria" },
      {
        property: "og:description",
        content: "Tokens visuais e componentes-base do sistema de controladoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignSystem,
});

type Linha = { nf: string; cliente: string; vencimento: string; valor: number; status: Status };
const linhas: Linha[] = [
  {
    nf: "NF 1023",
    cliente: "Agência Alfa",
    vencimento: "2026-03-10",
    valor: 48500,
    status: "pago",
  },
  {
    nf: "NF 1024",
    cliente: "Anunciante Beta",
    vencimento: "2026-04-15",
    valor: 12340.9,
    status: "pendente",
  },
  {
    nf: "NF 1025",
    cliente: "Grupo Gama",
    vencimento: "2026-02-28",
    valor: 7800,
    status: "atrasado",
  },
];
const colunas: Column<Linha>[] = [
  { key: "nf", header: "NF" },
  { key: "cliente", header: "Cliente" },
  { key: "vencimento", header: "Vencimento", render: (r) => formatarData(r.vencimento) },
  { key: "valor", header: "Valor", align: "right", render: (r) => formatarBRL(r.valor) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

function Secao({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-title font-medium text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const cores = [
  "primary",
  "primary-container",
  "on-primary-container",
  "surface",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "outline",
  "outline-variant",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "info",
  "info-soft",
  "bu-advertising",
  "bu-analytics",
];
const charts = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `chart-${i}`);
const serie = ["jan", "fev", "mar", "abr", "mai", "jun"].map((m, i) => ({
  mes: `${m}/26`,
  Advertising: [820, 910, 870, 1040, 1120, 1210][i]! * 1000,
  Analytics: [310, 330, 360, 340, 390, 420][i]! * 1000,
}));

function Paleta() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
      {[...cores, ...charts].map((c) => (
        <div key={c} className="text-label text-muted-foreground">
          <div
            className="h-12 rounded-xl border border-outline-variant"
            style={{ background: `var(--${c})` }}
          />
          <p className="mt-1 truncate">{c}</p>
        </div>
      ))}
    </div>
  );
}

function DesignSystem() {
  const [visao, setVisao] = useState<"competencia" | "emissao" | "recebimento">("competencia");
  const [aba, setAba] = useState<"resumo" | "bu" | "clientes">("resumo");
  const [chips, setChips] = useState<string[]>(["Advertising"]);
  const toggle = (c: string) =>
    setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <PageHeader
        title="Design system"
        description="Tokens e componentes-base no estilo Material 3"
        actions={
          <>
            <Button variant="outline">Secundária</Button>
            <Button variant="tonal">Tonal</Button>
            <Button>Ação principal</Button>
          </>
        }
      />

      <Secao title="Cores — claro">
        <div className="surface-card p-5">
          <Paleta />
        </div>
      </Secao>
      <Secao title="Cores — escuro">
        <div className="dark rounded-[var(--radius-card)] bg-background p-5 text-foreground">
          <Paleta />
        </div>
      </Secao>

      <Secao title="Tipografia">
        <div className="surface-card space-y-2 p-6">
          <p className="text-display font-normal">Display 44</p>
          <p className="text-headline">Headline 28</p>
          <p className="text-title font-medium">Title 18</p>
          <p className="text-body">Body 14 — texto padrão do sistema.</p>
          <p className="text-label font-medium text-muted-foreground">Label 12</p>
          <p className="num text-title">
            {formatarBRL(1234.5)} · {formatarBRLCompacto(1_234_000)} ·{" "}
            {formatarBRLCompacto(350_000)} · {formatarPercentualSinal(0.082)} ·{" "}
            {formatarPercentualSinal(-0.03)} · {formatarMes("2026-01-01")} ·{" "}
            {formatarData("2026-01-31")} · {formatarPercentual(0.125)}
          </p>
        </div>
      </Secao>

      <Secao title="KPI cards v2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Faturado"
            value={formatarBRLCompacto(1_250_000)}
            variation={0.082}
            variationLabel="vs. mês anterior"
            sparkline={[3, 4, 3.6, 5, 5.4, 6.1]}
          />
          <KpiCard
            label="Custos"
            value={formatarBRLCompacto(480_400)}
            variation={0.12}
            invertColors
            variationLabel="vs. mês anterior"
            sparkline={[2, 2.4, 2.2, 2.9, 3.1, 3.4]}
          />
          <KpiCard label="Margem" value="38,4%" needsValidation />
          <KpiCard label="Carregando" loading />
        </div>
      </Secao>

      <Secao title="Chips, segmented control e abas">
        <div className="surface-card space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {["Advertising", "Analytics", "Terceiro", "Anunciante"].map((c) => (
              <FilterChip key={c} selected={chips.includes(c)} onClick={() => toggle(c)}>
                {c}
              </FilterChip>
            ))}
            <AssistChip icon={<Sparkles />}>Sugestão</AssistChip>
          </div>
          <SegmentedControl
            ariaLabel="Visão de data"
            value={visao}
            onChange={setVisao}
            options={[
              { value: "competencia", label: "Competência" },
              { value: "emissao", label: "Emissão" },
              { value: "recebimento", label: "Recebimento" },
            ]}
          />
          <AnimatedTabs
            value={aba}
            onChange={setAba}
            tabs={[
              { value: "resumo", label: "Resumo" },
              { value: "bu", label: "Por BU" },
              { value: "clientes", label: "Clientes" },
            ]}
          />
        </div>
      </Secao>

      <Secao title="Status e badges">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="pago" />
          <StatusBadge status="pendente" />
          <StatusBadge status="atrasado" />
          <ValidacaoBadge />
        </div>
      </Secao>

      <Secao title="Gráficos de exemplo">
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Faturado por BU" subtitle="Competência · 2026">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={serie}>
                  <CartesianGrid vertical={false} stroke="var(--outline-variant)" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={formatarBRLCompacto}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "var(--surface-container)" }}
                  />
                  <Bar dataKey="Advertising" fill="var(--bu-advertising)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Analytics" fill="var(--bu-analytics)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Tendência" subtitle="Total mensal">
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={serie}>
                  <CartesianGrid vertical={false} stroke="var(--outline-variant)" />
                  <XAxis
                    dataKey="mes"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={formatarBRLCompacto}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="Advertising"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Analytics"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </Secao>

      <Secao title="Filtros">
        <FilterBarDemo />
      </Secao>

      <Secao title="Tabela — padrão">
        <DataTable columns={colunas} rows={linhas} />
      </Secao>
      <Secao title="Tabela — vazio">
        <DataTable columns={colunas} rows={[]} />
      </Secao>
      <Secao title="Tabela — carregando">
        <DataTable columns={colunas} rows={[]} loading />
      </Secao>

      <Secao title="Estado vazio">
        <EmptyState
          title="Nenhum negócio cadastrado"
          description="Os dados aparecerão aqui após a importação."
          action={<Button variant="tonal">Importar planilha</Button>}
        />
      </Secao>

      <Secao title="Skeleton">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </Secao>
    </main>
  );
}

function FilterBarDemo() {
  const [f, setF] = useState<Filtros>(filtrosIniciais);
  return (
    <FilterBar
      value={f}
      onChange={setF}
      opcoes={{
        bu: o("Advertising", "Analytics"),
        produto: o("GA4"),
        contrato: o("Licenciamento"),
        plataforma: o("GA360"),
        categoria: o("Terceiro", "Anunciante"),
        cliente: [],
        status: o("pago", "pendente"),
      }}
    />
  );
}
const o = (...xs: string[]) => xs.map((x) => ({ value: x, label: x }));
