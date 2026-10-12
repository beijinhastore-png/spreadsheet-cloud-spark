import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { Search } from "lucide-react";
import * as M from "@/data/metricas";
import { useDados, useFiltros } from "@/hooks/use-dados";
import { obterPlataformas } from "@/data/repository";
import {
  KpiCard,
  SectionCard,
  SegmentedControl,
  StatusPill,
  SeloValidacao,
  ChartTooltip,
} from "@/components/ui-kit";
import { DataTableV2, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import {
  Cliente360Gaveta,
  CompararClientes,
  STATUS_RECEB,
} from "@/components/clientes/cliente-360";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarBRL, formatarBRLCompacto, formatarData, formatarPercentual } from "@/lib/format";

const META =
  "Clientes 360°: faturado, recebido, atrasos, margem, curva ABC e comparação entre clientes.";
export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes 360° — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Clientes 360° — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Clientes,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar Clientes</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const brl = (v: number) => <span className="num">{formatarBRL(v)}</span>;
const CORES_ABC = {
  A: "var(--color-chart-1)",
  B: "var(--color-chart-2)",
  C: "var(--color-chart-4)",
} as const;
type Status = "todos" | M.StatusReceb;
type Modo = "lista" | "comparar";

function Clientes() {
  const d = useDados();
  const { filtros, definir } = useFiltros();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<Status>("todos");
  const [modo, setModo] = useState<Modo>("lista");
  const [aberto, setAberto] = useState<string | null>(null);
  const [cmp, setCmp] = useState<[string, string]>(["", ""]);

  const todos = M.clientes360(d, filtros);
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter(
      (c) =>
        (status === "todos" || c.status === status) && (!q || c.nome.toLowerCase().includes(q)),
    );
  }, [todos, busca, status]);

  const abc = useMemo(
    () => M.curvaABC(linhas.map((c) => ({ chave: c.nome, valor: c.faturado }))),
    [linhas],
  );
  const tot = linhas.reduce(
    (a, c) => ({
      fat: a.fat + c.faturado,
      rec: a.rec + c.recebido,
      ab: a.ab + c.emAberto,
      atr: a.atr + c.atrasado,
      mg: a.mg + c.margem,
    }),
    { fat: 0, rec: 0, ab: 0, atr: 0, mg: 0 },
  );
  const classeA = abc.filter((x) => x.classe === "A").length;
  const treemap = abc.slice(0, 30).map((x) => ({ name: x.chave, size: x.valor, classe: x.classe }));

  const colunas: ColunaV2<M.LinhaCliente>[] = [
    {
      key: "nome",
      header: "Cliente",
      value: (c) => c.nome,
      render: (c) => (
        <button
          type="button"
          className="text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => setAberto(c.id)}
        >
          {c.nome}
        </button>
      ),
    },
    { key: "cat", header: "Categoria", value: (c) => c.categoria },
    { key: "bu", header: "BU", value: (c) => c.bus.join(", "), oculta: true },
    { key: "plat", header: "Plataformas", value: (c) => c.plataformas.join(", "), oculta: true },
    {
      key: "fat",
      header: "Faturado",
      align: "right",
      value: (c) => c.faturado,
      render: (c) => brl(c.faturado),
    },
    {
      key: "rec",
      header: "Recebido",
      align: "right",
      value: (c) => c.recebido,
      render: (c) => brl(c.recebido),
    },
    {
      key: "ab",
      header: "Em aberto",
      align: "right",
      value: (c) => c.emAberto,
      render: (c) => brl(c.emAberto),
    },
    {
      key: "atr",
      header: "Atrasado",
      align: "right",
      value: (c) => c.atrasado,
      render: (c) => (
        <span className={c.atrasado ? "num text-danger" : "num"}>{formatarBRL(c.atrasado)}</span>
      ),
    },
    {
      key: "mg",
      header: "Margem",
      align: "right",
      value: (c) => c.margem,
      render: (c) => (
        <span className={c.margem < 0 ? "num text-danger" : "num"}>{formatarBRL(c.margem)}</span>
      ),
    },
    {
      key: "mgp",
      header: "Margem %",
      align: "right",
      value: (c) => c.margemPct,
      render: (c) => <span className="num">{formatarPercentual(c.margemPct, 1)}</span>,
    },
    { key: "nnf", header: "Nº NFs", align: "right", value: (c) => c.nNFs },
    {
      key: "ult",
      header: "Última NF",
      value: (c) => c.ultimaNF,
      render: (c) => (c.ultimaNF ? formatarData(c.ultimaNF) : "—"),
    },
    {
      key: "st",
      header: "Recebimento",
      value: (c) => STATUS_RECEB[c.status].label,
      render: (c) => (
        <StatusPill tom={STATUS_RECEB[c.status].tom}>{STATUS_RECEB[c.status].label}</StatusPill>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-headline font-medium text-foreground">Clientes 360°</h1>
          <p className="text-body text-muted-foreground">
            Valores da Parte 2 por cliente, com NFs e atrasos da Parte 1. Clique num cliente para a
            visão completa.
          </p>
        </div>
        <SegmentedControl<Modo>
          value={modo}
          onChange={setModo}
          ariaLabel="Modo"
          options={[
            { value: "lista", label: "Lista" },
            { value: "comparar", label: "Comparar" },
          ]}
        />
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente…"
            className="h-9 w-64 pl-9"
          />
        </div>
        <SegmentedControl
          value={filtros.categoria || "todas"}
          onChange={(v) => definir({ categoria: v === "todas" ? "" : v } as never)}
          ariaLabel="Categoria"
          options={[
            { value: "todas", label: "Todas" },
            { value: "Terceiro", label: "Terceiro" },
            { value: "Anunciante", label: "Anunciante" },
          ]}
        />
        <SegmentedControl
          value={filtros.bu || "todas"}
          onChange={(v) => definir({ bu: v === "todas" ? "" : v } as never)}
          ariaLabel="BU"
          options={[
            { value: "todas", label: "Todas BUs" },
            { value: "Advertising", label: "Advertising" },
            { value: "Analytics", label: "Analytics" },
          ]}
        />
        <select
          aria-label="Plataforma"
          value={filtros.plataforma}
          onChange={(e) => definir({ plataforma: e.target.value } as never)}
          className="h-9 rounded-full border bg-background px-3 text-body"
        >
          <option value="">Todas plataformas</option>
          {obterPlataformas().map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          aria-label="Status de recebimento"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="h-9 rounded-full border bg-background px-3 text-body"
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(STATUS_RECEB) as M.StatusReceb[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_RECEB[s].label}
            </option>
          ))}
        </select>
      </div>

      {modo === "comparar" ? (
        <CompararClientes
          a={cmp[0]}
          b={cmp[1]}
          filtros={filtros}
          opcoes={todos.map((c) => ({ id: c.id, nome: c.nome }))}
          onA={(v) => setCmp([v, cmp[1]])}
          onB={(v) => setCmp([cmp[0], v])}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Clientes"
              value={String(linhas.length)}
              variationLabel={`${classeA} na classe A`}
            />
            <KpiCard label="Faturado" value={formatarBRLCompacto(tot.fat)} />
            <KpiCard label="Recebido" value={formatarBRLCompacto(tot.rec)} />
            <KpiCard
              label="Atrasado"
              value={formatarBRLCompacto(tot.atr)}
              variationLabel={`em aberto ${formatarBRLCompacto(tot.ab)}`}
            />
            <KpiCard label="Margem" value={formatarBRLCompacto(tot.mg)} needsValidation />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Ranking" subtitle="Maiores por faturado" menu={false}>
              <ol className="space-y-2">
                {abc.slice(0, 8).map((x, i) => (
                  <li key={x.chave} className="flex items-center gap-3 text-body">
                    <span className="num w-5 text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{x.chave}</span>
                    <span className="num">{formatarBRLCompacto(x.valor)}</span>
                    <span className="num w-12 text-right text-muted-foreground">
                      {formatarPercentual(x.participacao, 0)}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>
            <SectionCard
              title="Curva ABC (Pareto)"
              subtitle="A até 80% acumulado, B até 95%"
              className="lg:col-span-2"
              menu={false}
            >
              <div className="h-64">
                <ResponsiveContainer>
                  <ComposedChart
                    data={abc.slice(0, 40).map((x) => ({ ...x, acumuladoPct: x.acumulado * 100 }))}
                  >
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="chave" tick={false} />
                    <YAxis yAxisId="v" tickFormatter={formatarBRLCompacto} tick={eixo} width={64} />
                    <YAxis
                      yAxisId="p"
                      orientation="right"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={eixo}
                      width={40}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      yAxisId="v"
                      dataKey="valor"
                      name="Faturado"
                      fill="var(--color-chart-1)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="p"
                      dataKey="acumuladoPct"
                      name="% acumulado"
                      stroke="var(--color-chart-5)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Concentração"
            subtitle="Treemap dos 30 maiores clientes por faturado (cor = classe ABC)"
            menu={false}
          >
            <div className="h-72">
              <ResponsiveContainer>
                <Treemap
                  data={treemap}
                  dataKey="size"
                  stroke="var(--color-card)"
                  isAnimationActive={false}
                  content={<Celula />}
                />
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="Lista de clientes"
            subtitle="Margem = Faturado − Custos − Impostos + Créditos"
            action={<SeloValidacao />}
            menu={false}
          >
            <DataTableV2
              rows={linhas}
              columns={colunas}
              rowKey={(c) => c.id}
              vazio="Nenhum cliente com esses filtros."
            />
          </SectionCard>
        </>
      )}

      <Cliente360Gaveta id={aberto} filtros={filtros} onClose={() => setAberto(null)} />
    </div>
  );
}

function Celula(p: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  classe?: "A" | "B" | "C";
  size?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, classe = "C", size = 0 } = p;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CORES_ABC[classe]}
        stroke="var(--color-card)"
        strokeWidth={2}
        rx={4}
      />
      {width > 70 && height > 32 && (
        <>
          <text x={x + 6} y={y + 16} fontSize={11} fill="var(--color-primary-foreground)">
            {(name ?? "").slice(0, Math.floor(width / 7))}
          </text>
          <text x={x + 6} y={y + 30} fontSize={10} fill="var(--color-primary-foreground)">
            {formatarBRLCompacto(size)}
          </text>
        </>
      )}
    </g>
  );
}
