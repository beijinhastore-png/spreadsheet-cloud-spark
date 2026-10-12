import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import * as M from "@/data/metricas";
import { useFiltros, useMetricas } from "@/hooks/use-dados";
import {
  KpiCard,
  SegmentedControl,
  SectionCard,
  ChartTooltip,
  EmptyState,
  StatusPill,
  SeloValidacao,
  AnimatedTabs,
} from "@/components/ui-kit";
import { DataTableV2, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { LinkCliente } from "@/components/detail-drawer";
import { Button } from "@/components/ui/button";
import {
  Tooltip as Dica,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MARGEM_OFICIAL } from "@/lib/calculos";
import { formatarBRL, formatarBRLCompacto, formatarMes, formatarPercentual } from "@/lib/format";
import { cn } from "@/lib/utils";

const META = "Emissão, custos, impostos, créditos, conciliação e margem por BU, produto e cliente.";
export const Route = createFileRoute("/_authenticated/controladoria")({
  head: () => ({
    meta: [
      { title: "Controladoria operacional — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Controladoria operacional — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Controladoria,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">
        Não foi possível carregar a Controladoria
      </p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

type Aba = "emissao" | "custos" | "impostos" | "conciliacao" | "margem" | "ranking";
const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const brl = (v: number) => <span className="num">{formatarBRL(v)}</span>;
const rotMes = (m: string) => formatarMes(`${m}-01T12:00:00`);
const pct = (v: number) => <span className="num">{formatarPercentual(v, 1)}</span>;
const col = <T,>(
  key: string,
  header: string,
  value: (r: T) => number,
  render?: (r: T) => ReactNode,
): ColunaV2<T> => ({
  key,
  header,
  align: "right",
  value,
  render: render ?? ((r) => brl(value(r))),
});

function Ajuda({ texto }: { texto: string }) {
  return (
    <Dica>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Explicação" className="inline-flex text-muted-foreground">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{texto}</TooltipContent>
    </Dica>
  );
}

function Controladoria() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [aba, setAba] = useState<Aba>("emissao");
  if (!d.fatos.length)
    return (
      <EmptyState
        title="Sem dados da Parte 2"
        description="Importe a planilha para ver a controladoria."
      />
    );
  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <header>
          <h1 className="text-headline font-medium">Controladoria operacional</h1>
          <p className="text-body text-muted-foreground">
            {META} Valores lidos dos blocos da Parte 2 — o sistema não recalcula custos nem
            impostos.
          </p>
        </header>
        <AnimatedTabs
          value={aba}
          onChange={setAba}
          tabs={[
            { value: "emissao", label: "Emissão" },
            { value: "custos", label: "Custos" },
            { value: "impostos", label: "Impostos e créditos" },
            { value: "conciliacao", label: "Conciliação" },
            { value: "margem", label: "Margem" },
            { value: "ranking", label: "Ranking" },
          ]}
        />
        {aba === "emissao" && <Emissao d={d} f={filtros} />}
        {aba === "custos" && <Custos d={d} f={filtros} />}
        {aba === "impostos" && <Impostos d={d} f={filtros} />}
        {aba === "conciliacao" && <Conciliacao d={d} f={filtros} />}
        {aba === "margem" && <Margem d={d} f={filtros} />}
        {aba === "ranking" && <Ranking d={d} f={filtros} />}
      </div>
    </TooltipProvider>
  );
}

type P = { d: M.Dados; f: Parameters<typeof M.fatosFiltrados>[2] };

function Emissao({ d, f }: P) {
  const r = useMemo(() => M.resumoEmissao(d, f), [d, f]);
  type L = M.ResumoEmissao["fila"][number];
  const cols: ColunaV2<L>[] = [
    {
      key: "cliente",
      header: "Cliente",
      value: (x) => x.cliente,
      render: (x) => <LinkCliente id={x.cliente} nome={x.cliente} />,
    },
    { key: "cat", header: "Categoria", value: (x) => x.categoria },
    col<L>("aut", "Autorizado sem NF", (x) => x.autorizadoSemNF),
    col<L>(
      "qtd",
      "Cards sem NF",
      (x) => x.qtdSemNF,
      (x) => <span className="num">{x.qtdSemNF}</span>,
    ),
    col<L>("lib", "A liberar", (x) => x.aLiberar),
    col<L>("tot", "Total na fila", (x) => x.total),
    col<L>(
      "dias",
      "Maior espera (dias)",
      (x) => x.diasMax,
      (x) => <StatusPill tom={M.tomSemaforo(x.diasMax)}>{x.diasMax}</StatusPill>,
    ),
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cards autorizados"
          value={formatarBRL(r.autorizados.valor)}
          variationLabel={`${r.autorizados.qtd} cards`}
        />
        <KpiCard
          label="Cards não autorizados"
          value={formatarBRL(r.naoAutorizados.valor)}
          variationLabel={`${r.naoAutorizados.qtd} cards`}
        />
        <KpiCard
          label="NFs não localizadas"
          value={formatarBRL(r.naoLocalizadas.valor)}
          variationLabel={`${r.naoLocalizadas.qtd} NFs · Parte 2: ${formatarBRLCompacto(r.naoLocalizadas.parte2)}`}
        />
        <KpiCard
          label="A liberar"
          value={formatarBRL(r.aLiberar)}
          variationLabel="Parte 2, coluna E"
        />
      </div>
      <SectionCard
        title="Fila de emissão por cliente"
        subtitle="Cards autorizados sem NF + cards a liberar."
        menu={false}
      >
        <DataTableV2
          rows={r.fila}
          columns={cols}
          rowKey={(x) => x.cliente}
          vazio="Nenhum cliente na fila."
        />
      </SectionCard>
    </div>
  );
}

function Custos({ d, f }: P) {
  const [desl, setDesl] = useState(2);
  const [dim, setDim] = useState<"bu" | "produto">("produto");
  const serie = useMemo(() => M.serieCustos(d, f, desl), [d, f, desl]);
  const teste = useMemo(() => M.testeDefasagemCustos(d, f), [d, f]);
  const melhor = teste.reduce((a, b) => (b.erro < a.erro ? b : a), teste[0]!);
  const porDim = useMemo(() => M.financeiroPor(d, f, dim), [d, f, dim]);
  const cli = useMemo(
    () =>
      [...M.financeiroPor(d, f, "cliente")]
        .sort((a, b) => b.custoEmissao - a.custoEmissao)
        .slice(0, 20),
    [d, f],
  );
  const aPagar = useMemo(() => M.custosAPagar(d, f), [d, f]);
  const totE = serie.reduce((a, x) => a + x.emitido, 0),
    totP = serie.reduce((a, x) => a + x.pago, 0);
  const cols: ColunaV2<M.LinhaFin>[] = [
    { key: "k", header: dim === "bu" ? "BU" : "BU · Produto", value: (x) => x.chave },
    col<M.LinhaFin>("e", "Custo por emissão", (x) => x.custoEmissao),
    col<M.LinhaFin>("p", "Custo por pagamento", (x) => x.custoPagamento),
    col<M.LinhaFin>("d", "Emitido − Pago", (x) => x.custoEmissao - x.custoPagamento),
  ];
  const colsCli: ColunaV2<M.LinhaFin>[] = [
    {
      key: "c",
      header: "Cliente",
      value: (x) => x.cliente,
      render: (x) => <LinkCliente id={x.cliente} nome={x.cliente} />,
    },
    { key: "cat", header: "Categoria", value: (x) => x.categoria },
    col<M.LinhaFin>("e", "Custo por emissão", (x) => x.custoEmissao),
    col<M.LinhaFin>("p", "Custo por pagamento", (x) => x.custoPagamento),
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Custos por emissão (jan–fev seguinte)" value={formatarBRL(totE)} />
        <KpiCard label="Custos por pagamento" value={formatarBRL(totP)} />
        <KpiCard
          label="A pagar após a data de posição"
          value={formatarBRL(aPagar.reduce((a, x) => a + x.pago, 0))}
          variationLabel={`${aPagar.length} meses`}
        />
        <KpiCard
          label="Melhor defasagem"
          value={`${melhor.meses} ${melhor.meses === 1 ? "mês" : "meses"}`}
          variationLabel={`Hipótese 2 meses: erro ${formatarPercentual(teste[2]?.erro ?? 0, 0)} · melhor ${formatarPercentual(melhor.erro, 0)}`}
        />
      </div>
      <SectionCard
        title="Emitido × pago por mês"
        subtitle="Linha: emitido deslocado pela defasagem escolhida."
        menu={false}
        action={
          <div className="flex items-center gap-2">
            <SegmentedControl
              ariaLabel="Defasagem"
              value={String(desl)}
              onChange={(v) => setDesl(Number(v))}
              options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}m` }))}
            />
            <SeloValidacao />
          </div>
        }
      >
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={serie.map((x) => ({ ...x, rot: rotMes(x.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="rot" tick={eixo} />
              <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar
                dataKey="emitido"
                name="Custo por emissão"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="pago"
                name="Custo por pagamento"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                dataKey="emitidoDeslocado"
                name={`Emitido +${desl}m`}
                stroke="var(--color-chart-3)"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard
        title="Custos por emissão × por pagamento"
        menu={false}
        action={
          <SegmentedControl
            ariaLabel="Quebra"
            value={dim}
            onChange={setDim}
            options={[
              { value: "bu", label: "BU" },
              { value: "produto", label: "Produto" },
            ]}
          />
        }
      >
        <DataTableV2 rows={porDim} columns={cols} rowKey={(x) => x.chave} />
      </SectionCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Custo por cliente (top 20)"
          subtitle="Nível cliente da Parte 2."
          menu={false}
        >
          <DataTableV2 rows={cli} columns={colsCli} rowKey={(x) => x.chave} pagina={20} />
        </SectionCard>
        <SectionCard
          title="Custos a pagar nos próximos meses"
          subtitle="Custo por pagamento após a data de posição, até fev do ano seguinte."
          menu={false}
        >
          <DataTableV2
            rows={aPagar}
            rowKey={(x) => x.mes}
            vazio="Nada a pagar após a data de posição."
            columns={[
              { key: "m", header: "Mês", value: (x) => x.mes, render: (x) => rotMes(x.mes) },
              col<M.LinhaCustoMes>("p", "A pagar", (x) => x.pago),
            ]}
          />
        </SectionCard>
      </div>
    </div>
  );
}

function Impostos({ d, f }: P) {
  const [dim, setDim] = useState<"bu" | "produto">("produto");
  const serie = useMemo(() => M.serieImpostos(d, f), [d, f]);
  const linhas = useMemo(() => M.financeiroPor(d, f, dim), [d, f, dim]);
  const reg = useMemo(() => M.faturadoPorRegimeNF(d, f), [d, f]);
  const t = serie.reduce(
    (a, x) => ({ i: a.i + x.impostos, c: a.c + x.creditos, f: a.f + x.faturado }),
    { i: 0, c: 0, f: 0 },
  );
  const cols: ColunaV2<M.LinhaFin>[] = [
    { key: "k", header: dim === "bu" ? "BU" : "BU · Produto", value: (x) => x.chave },
    col<M.LinhaFin>("f", "Faturado", (x) => x.faturado),
    col<M.LinhaFin>("i", "Impostos", (x) => x.impostos),
    col<M.LinhaFin>("c", "Créditos*", (x) => x.creditos),
    col<M.LinhaFin>("l", "Líquido", (x) => x.impostos - x.creditos),
    col<M.LinhaFin>(
      "a",
      "Alíquota efetiva",
      (x) => (x.faturado ? x.impostos / x.faturado : 0),
      (x) => pct(x.faturado ? x.impostos / x.faturado : 0),
    ),
  ];
  type S = (typeof serie)[number];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Impostos" value={formatarBRL(t.i)} />
        <KpiCard label="Créditos*" value={formatarBRL(t.c)} />
        <KpiCard label="Líquido (impostos − créditos)" value={formatarBRL(t.i - t.c)} />
        <KpiCard
          label="Alíquota efetiva"
          value={formatarPercentual(t.f ? t.i / t.f : 0, 2)}
          variationLabel="Impostos ÷ faturado"
        />
      </div>
      <p className="flex items-center gap-2 text-label text-muted-foreground">
        * Créditos, em regra, são de PIS/Cofins não cumulativo (confirmar). <SeloValidacao />
      </p>
      <SectionCard title="Impostos, créditos e líquido por mês" menu={false}>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={serie.map((x) => ({ ...x, rot: rotMes(x.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="rot" tick={eixo} />
              <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar
                dataKey="impostos"
                name="Impostos"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="creditos"
                name="Créditos*"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="liquido"
                name="Líquido"
                fill="var(--color-chart-3)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <DataTableV2
          rows={serie}
          rowKey={(x) => x.mes}
          columns={[
            { key: "m", header: "Mês", value: (x: S) => x.mes, render: (x: S) => rotMes(x.mes) },
            col<S>("f", "Faturado", (x) => x.faturado),
            col<S>("i", "Impostos", (x) => x.impostos),
            col<S>("c", "Créditos*", (x) => x.creditos),
            col<S>("l", "Líquido", (x) => x.liquido),
            col<S>(
              "a",
              "Alíquota efetiva",
              (x) => x.aliquota,
              (x) => pct(x.aliquota),
            ),
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Por BU / produto"
        menu={false}
        action={
          <SegmentedControl
            ariaLabel="Quebra"
            value={dim}
            onChange={setDim}
            options={[
              { value: "bu", label: "BU" },
              { value: "produto", label: "Produto" },
            ]}
          />
        }
      >
        <DataTableV2 rows={linhas} columns={cols} rowKey={(x) => x.chave} />
      </SectionCard>
      <SectionCard
        title="Faturado por regime (NFs)"
        subtitle="Regime pelo código da NF. A Parte 2 não separa impostos por regime."
        menu={false}
      >
        <DataTableV2
          rows={reg}
          rowKey={(x) => x.regime}
          vazio="Sem NFs no período."
          columns={[
            { key: "r", header: "Regime", value: (x) => x.regime },
            { key: "q", header: "NFs", align: "right", value: (x) => x.qtd },
            {
              key: "v",
              header: "Faturado",
              align: "right",
              value: (x) => x.valor,
              render: (x) => brl(x.valor),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}

const DICAS_CONC: Record<string, string> = {
  faturado: "Faturado do mês na Parte 2 (competência ou emissão, conforme o regime dos filtros).",
  recebido: "Bloco Recebimento da Parte 2: dinheiro que entrou no mês.",
  custosPagos: "Bloco Custos por Pagamento da Parte 2: custos efetivamente pagos no mês.",
  recebidoMenosCustos: "Recebido − Custos pagos: caixa operacional do mês.",
  diferenca: "Faturado − (Recebido − Custos pagos), como na planilha.",
  planilha:
    "Valor do bloco de diferenças da Parte 2 (Faturado − Custos − Recebimentos), para conferência.",
};
function Conciliacao({ d, f }: P) {
  const ls = useMemo(() => M.conciliacao(d, f), [d, f]);
  const cab = (k: string, t: string) => (
    <span className="inline-flex items-center gap-1">
      {t}
      <Ajuda texto={DICAS_CONC[k]!} />
    </span>
  );
  const tot = ls.reduce((a, x) => a + x.diferenca, 0),
    totP = ls.reduce((a, x) => a + x.planilha, 0);
  const campos: [keyof M.LinhaConciliacao, string][] = [
    ["faturado", "Faturado"],
    ["recebido", "Recebido"],
    ["custosPagos", "Custos pagos"],
    ["recebidoMenosCustos", "Recebido − Custos"],
    ["diferenca", "Diferença"],
    ["planilha", "Planilha"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Recebido − Custos pagos"
          value={formatarBRL(ls.reduce((a, x) => a + x.recebidoMenosCustos, 0))}
        />
        <KpiCard label="Faturado − (Recebido − Custos)" value={formatarBRL(tot)} />
        <KpiCard
          label="Bloco da planilha"
          value={formatarBRL(totP)}
          variationLabel={`Diferença ${formatarBRL(tot - totP)}`}
        />
      </div>
      <SectionCard title="Conciliação mensal" action={<SeloValidacao />} menu={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-left text-label text-muted-foreground">
                <th className="px-2 py-2">Mês</th>
                {campos.map(([k, t]) => (
                  <th key={k} className="px-2 py-2 text-right">
                    {cab(k, t)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Confere</th>
              </tr>
            </thead>
            <tbody>
              {ls.map((x) => {
                const ok = Math.abs(x.diferenca - x.planilha) < 1;
                return (
                  <tr key={x.mes} className="border-t border-outline-variant">
                    <td className="px-2 py-1.5">{rotMes(x.mes)}</td>
                    {campos.map(([k]) => (
                      <td
                        key={k}
                        className={cn(
                          "num px-2 py-1.5 text-right",
                          k === "diferenca" && "font-medium",
                        )}
                      >
                        {formatarBRL(x[k] as number)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right">
                      {ok ? (
                        <CheckCircle2
                          className="ml-auto size-4 text-success"
                          aria-label="Confere"
                        />
                      ) : (
                        <AlertTriangle
                          className="ml-auto size-4 text-warning"
                          aria-label="Diverge"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function Margem({ d, f }: P) {
  const [dim, setDim] = useState<"bu" | "produto" | "cliente">("bu");
  const formulas = MARGEM_OFICIAL
    ? M.FORMULAS_MARGEM.filter((x) => x.id === MARGEM_OFICIAL)
    : M.FORMULAS_MARGEM;
  const linhas = useMemo(() => M.financeiroPor(d, f, dim), [d, f, dim]);
  const confs = useMemo(
    () => formulas.map((fm) => ({ fm, ...M.conferenciaMargemClientes(d, f, fm.id) })),
    [d, f, formulas],
  );
  const cols: ColunaV2<M.LinhaFin>[] = [
    {
      key: "k",
      header: dim === "bu" ? "BU" : dim === "produto" ? "BU · Produto" : "Cliente",
      value: (x) => x.chave,
      render: (x) =>
        dim === "cliente" ? <LinkCliente id={x.cliente} nome={x.cliente} /> : x.chave,
    },
    ...formulas.flatMap((fm) => [
      col<M.LinhaFin>(
        `m${fm.id}`,
        `Margem (${fm.id})`,
        (x) => M.margemPor(x, fm.id).margem,
        (x) => {
          const v = M.margemPor(x, fm.id).margem;
          return <span className={cn("num", v < 0 && "text-danger")}>{formatarBRL(v)}</span>;
        },
      ),
      col<M.LinhaFin>(
        `p${fm.id}`,
        `% (${fm.id})`,
        (x) => M.margemPor(x, fm.id).pct,
        (x) => pct(M.margemPor(x, fm.id).pct),
      ),
    ]),
  ];
  return (
    <div className="space-y-6">
      <div className={cn("grid gap-4", formulas.length > 1 ? "lg:grid-cols-3" : "")}>
        {confs.map(({ fm, produto, clientes, diferenca }) => (
          <div key={fm.id} className="surface-card space-y-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-body font-medium">{fm.titulo}</p>
              {MARGEM_OFICIAL ? <StatusPill tom="success">Oficial</StatusPill> : <SeloValidacao />}
            </div>
            <p className="num text-headline font-medium">{formatarBRL(produto)}</p>
            <p className="text-label text-muted-foreground">
              Soma por cliente: {formatarBRL(clientes)} · diferença {formatarBRL(diferenca)}
            </p>
          </div>
        ))}
      </div>
      {!MARGEM_OFICIAL && (
        <p className="text-label text-muted-foreground">
          Escolha a fórmula oficial e as outras deixam de aparecer.
        </p>
      )}
      <SectionCard
        title="Margem por dimensão"
        menu={false}
        action={
          <SegmentedControl
            ariaLabel="Dimensão"
            value={dim}
            onChange={setDim}
            options={[
              { value: "bu", label: "BU" },
              { value: "produto", label: "Produto" },
              { value: "cliente", label: "Cliente" },
            ]}
          />
        }
      >
        <DataTableV2 rows={linhas} columns={cols} rowKey={(x) => x.chave} />
      </SectionCard>
    </div>
  );
}

function Ranking({ d, f }: P) {
  const [dim, setDim] = useState<"cliente" | "produto">("cliente");
  const [cat, setCat] = useState<"todas" | "Terceiro" | "Anunciante">("todas");
  const [fm, setFm] = useState<M.FormulaMargem>(MARGEM_OFICIAL ?? "a");
  const ls = useMemo(
    () =>
      M.rankingRentabilidade(d, f, dim, fm).filter(
        (x) => dim !== "cliente" || cat === "todas" || x.categoria === cat,
      ),
    [d, f, dim, fm, cat],
  );
  const cols: ColunaV2<M.LinhaRanking>[] = [
    { key: "pos", header: "#", value: (x) => ls.indexOf(x) + 1 },
    {
      key: "k",
      header: dim === "cliente" ? "Cliente" : "BU · Produto",
      value: (x) => x.chave,
      render: (x) =>
        dim === "cliente" ? <LinkCliente id={x.cliente} nome={x.cliente} /> : x.chave,
    },
    ...(dim === "cliente"
      ? [{ key: "cat", header: "Categoria", value: (x: M.LinhaRanking) => x.categoria }]
      : []),
    col<M.LinhaRanking>("b", "Base", (x) => (fm === "b" ? x.recebido : x.faturado)),
    col<M.LinhaRanking>(
      "m",
      "Margem",
      (x) => x.margem,
      (x) => (
        <span className={cn("num", x.margem < 0 && "text-danger")}>{formatarBRL(x.margem)}</span>
      ),
    ),
    col<M.LinhaRanking>(
      "p",
      "% margem",
      (x) => x.pct,
      (x) => pct(x.pct),
    ),
    {
      key: "al",
      header: "Alerta",
      value: (x) => x.alerta ?? "",
      render: (x) =>
        x.alerta === "negativa" ? (
          <StatusPill tom="danger">Margem negativa</StatusPill>
        ) : x.alerta === "fora_media" ? (
          <StatusPill tom="warning">Fora da média</StatusPill>
        ) : null,
    },
  ];
  return (
    <SectionCard
      title="Ranking de rentabilidade"
      subtitle={`Fora da média = % de margem a mais de ${M.LIMIAR_RANKING_SIGMA} desvios-padrão da média.`}
      menu={false}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Dimensão"
            value={dim}
            onChange={setDim}
            options={[
              { value: "cliente", label: "Clientes" },
              { value: "produto", label: "Produtos" },
            ]}
          />
          {dim === "cliente" && (
            <SegmentedControl
              ariaLabel="Categoria"
              value={cat}
              onChange={setCat}
              options={[
                { value: "todas", label: "Todas" },
                { value: "Terceiro", label: "Terceiro" },
                { value: "Anunciante", label: "Anunciante" },
              ]}
            />
          )}
          {!MARGEM_OFICIAL && (
            <SegmentedControl
              ariaLabel="Fórmula"
              value={fm}
              onChange={setFm}
              options={M.FORMULAS_MARGEM.map((x) => ({ value: x.id, label: `(${x.id})` }))}
            />
          )}
          {!MARGEM_OFICIAL && <SeloValidacao />}
        </div>
      }
    >
      <DataTableV2 rows={ls} columns={cols} rowKey={(x) => x.chave} />
    </SectionCard>
  );
}
