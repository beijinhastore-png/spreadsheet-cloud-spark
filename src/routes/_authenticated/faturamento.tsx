import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AlertTriangle, Download, ExternalLink, X } from "lucide-react";
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
import { DataTableV2, baixarCSV, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { abrirDetalhe, LinkCliente } from "@/components/detail-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatarBRL, formatarBRLCompacto, formatarData, formatarMes } from "@/lib/format";
import type { NotaFiscal } from "@/data/tipos";

const META =
  "Faturamento por competência e por emissão, com leitura executiva e lista operacional de NFs.";
export const Route = createFileRoute("/_authenticated/faturamento")({
  head: () => ({
    meta: [
      { title: "Faturamento (NFs) — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Faturamento (NFs) — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Faturamento,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar o faturamento</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const CORES = Array.from({ length: 8 }, (_, i) => `var(--color-chart-${i + 1})`);
const TOM: Record<string, "success" | "warning" | "danger"> = {
  pago: "success",
  pendente: "warning",
  atrasado: "danger",
};
const MOTIVO: Record<M.MotivoPendenciaNF, string> = {
  sem_negocio: "Sem negócio",
  sem_cliente: "Sem cliente",
  cliente_inferido: "Cliente inferido",
};
type Drill = { dim: "produto" | "cliente"; chave: string; mes?: string } | null;

function Faturamento() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [regime, setRegime] = useState<M.RegimeFat>(M.regimeFatPadrao(filtros.regime));
  const [empilhar, setEmpilhar] = useState<"bu" | "produto">("bu");
  const [matrizDim, setMatrizDim] = useState<"produto" | "cliente">("produto");
  const [drill, setDrill] = useState<Drill>(null);
  const [fRegime, setFRegime] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fBU, setFBU] = useState("todas");
  const [fFaixa, setFFaixa] = useState<string>("todas");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const v = useMemo(() => {
    const kpi = M.kpisFaturamento(d, filtros, regime);
    const serie = M.serieFaturadoEmpilhada(d, filtros, regime, empilhar);
    const matriz = M.matrizFaturado(d, filtros, regime, matrizDim);
    const conf = M.conferenciaFaturado(d, filtros, regime);
    const pend = M.nfsComPendencia(d, filtros);
    const negs = new Map(d.negocios.map((n) => [n.id, n]));
    const notas = M.notasFaturamento(d, filtros, regime).map((n) => ({
      ...n,
      status: M.statusNaData(n, filtros.dataReferencia),
    }));
    return { kpi, serie, matriz, conf, pend, negs, notas };
  }, [d, filtros, regime, empilhar, matrizDim]);

  const faixa = M.FAIXAS_VALOR_NF.find((x) => x.value === fFaixa) ?? M.FAIXAS_VALOR_NF[0];
  const lista = v.notas.filter((n) => {
    const mes = regime === "emissao" ? n.emissao?.slice(0, 7) : n.competencia;
    if (drill) {
      if (drill.dim === "produto" && n.card !== drill.chave) return false;
      if (drill.dim === "cliente" && drill.chave !== "Outros" && n.clienteId !== drill.chave)
        return false;
      if (drill.mes && mes !== drill.mes) return false;
    }
    return (
      (fRegime === "todos" || n.regime === fRegime) &&
      (fStatus === "todos" || n.status === fStatus) &&
      (fBU === "todas" || n.bu === fBU) &&
      n.valor >= faixa.min &&
      n.valor < faixa.max
    );
  });

  if (!d.notas.length)
    return (
      <EmptyState
        title="Nenhuma NF importada"
        description="Importe a planilha para ver o faturamento."
      />
    );

  const k = v.kpi;
  const maxCel = Math.max(1, ...v.matriz.flatMap((l) => l.valores.map((x) => x.valor)));
  const meses = v.matriz[0]?.valores.map((x) => x.chave) ?? [];

  const exportar = () => {
    const xs = lista.filter((n) => sel.has(n.id));
    baixarCSV(
      "nfs-selecionadas.csv",
      [
        "NF",
        "Cliente",
        "Card",
        "Regime",
        "Código",
        "Competência",
        "Emissão",
        "Vencimento",
        "Pagamento",
        "Valor",
        "Status",
      ],
      xs.map((n) => [
        n.numero,
        n.clienteId,
        n.nomeCard || n.card,
        n.regime ?? "",
        n.codigo ?? "",
        n.competencia,
        n.emissao,
        n.vencimento,
        n.dataPagamento ?? "",
        n.valor,
        n.status,
      ]),
    );
  };
  const alternar = (id: string) =>
    setSel((s) => {
      const o = new Set(s);
      if (o.has(id)) o.delete(id);
      else o.add(id);
      return o;
    });
  const todosMarcados = lista.length > 0 && lista.every((n) => sel.has(n.id));

  const colunas: ColunaV2<NotaFiscal>[] = [
    {
      key: "sel",
      header: "",
      value: () => "",
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={sel.has(r.id)}
            onCheckedChange={() => alternar(r.id)}
            aria-label={`Selecionar NF ${r.numero}`}
          />
        </span>
      ),
    },
    { key: "numero", header: "NF", value: (r) => r.numero },
    {
      key: "cliente",
      header: "Cliente",
      value: (r) => r.clienteId,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <LinkCliente id={r.clienteId} nome={r.clienteId || "—"} />
        </span>
      ),
    },
    { key: "card", header: "Card", value: (r) => r.nomeCard || r.card },
    { key: "regime", header: "Regime", value: (r) => r.regime ?? "—" },
    { key: "codigo", header: "Código", value: (r) => r.codigo ?? "—", oculta: true },
    {
      key: "competencia",
      header: "Competência",
      value: (r) => r.competencia,
      render: (r) => (r.competencia ? formatarMes(`${r.competencia}-01`) : "—"),
    },
    {
      key: "emissao",
      header: "Emissão",
      value: (r) => r.emissao,
      render: (r) => (r.emissao ? formatarData(r.emissao) : "—"),
    },
    {
      key: "vencimento",
      header: "Vencimento",
      value: (r) => r.vencimento,
      render: (r) => (r.vencimento ? formatarData(r.vencimento) : "—"),
    },
    {
      key: "pagamento",
      header: "Pagamento",
      value: (r) => r.dataPagamento ?? "",
      render: (r) => (r.dataPagamento ? formatarData(r.dataPagamento) : "—"),
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      value: (r) => r.valor,
      render: (r) => formatarBRL(r.valor),
    },
    {
      key: "status",
      header: "Status",
      value: (r) => r.status,
      render: (r) => <StatusPill tom={TOM[r.status] ?? "neutral"}>{r.status}</StatusPill>,
    },
    { key: "bu", header: "BU", value: (r) => r.bu, oculta: true },
  ];

  const sel_ = (val: string, set: (s: string) => void, opts: [string, string][], label: string) => (
    <label className="flex items-center gap-2 text-label text-muted-foreground">
      {label}
      <select
        value={val}
        onChange={(e) => set(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-body text-foreground"
      >
        {opts.map(([a, b]) => (
          <option key={a} value={a}>
            {b}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline font-medium text-foreground">Faturamento (NFs)</h1>
          <p className="text-body text-muted-foreground">{META}</p>
        </div>
        <SegmentedControl
          ariaLabel="Regime"
          value={regime}
          onChange={setRegime}
          options={[
            { value: "competencia", label: "Competência" },
            { value: "emissao", label: "Emissão (RPS)" },
          ]}
        />
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={`Faturado no período (${regime === "emissao" ? "emissão" : "competência"})`}
          value={formatarBRLCompacto(k.faturado)}
        />
        <KpiCard label="Nº de NFs" value={k.qtd.toLocaleString("pt-BR")} />
        <KpiCard label="Ticket médio" value={formatarBRLCompacto(k.ticketMedio)} />
        <KpiCard label="Maior NF" value={formatarBRLCompacto(k.maior)} />
        <KpiCard label="Faturado acumulado no ano" value={formatarBRLCompacto(k.acumuladoAno)} />
        <KpiCard
          label={`Anterior a ${filtros.ate.slice(0, 4)} (à parte)`}
          value={formatarBRLCompacto(k.anterior.valor)}
          variationLabel={`${k.anterior.qtd} NFs · fora das médias`}
        />
      </div>

      {v.conf.diverge ? (
        <Link
          to="/qualidade"
          role="alert"
          className="flex items-start gap-3 rounded-[var(--radius-card)] bg-warning/10 p-4 text-body hover:bg-warning/15"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <span className="font-medium text-foreground">
              Divergência NFs × Parte 2: {formatarBRL(v.conf.diferenca)}
            </span>
            <span className="block text-muted-foreground">
              Soma das NFs {formatarBRL(v.conf.nfs)} × bloco "
              {regime === "emissao" ? "Faturado por Emissão (RPS)" : "Faturado por Competência"}"{" "}
              {formatarBRL(v.conf.parte2)}. Clique para ver em Qualidade.
            </span>
          </span>
        </Link>
      ) : (
        <p className="text-label text-success">
          Soma das NFs confere com a Parte 2 ({formatarBRL(v.conf.parte2)}).
        </p>
      )}

      <SectionCard
        title="Faturado mensal"
        subtitle="Parte 2 · linha = Pipe autorizado (referência)"
        action={
          <SegmentedControl
            ariaLabel="Empilhar por"
            value={empilhar}
            onChange={setEmpilhar}
            options={[
              { value: "bu", label: "Por BU" },
              { value: "produto", label: "Por produto" },
            ]}
          />
        }
      >
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={v.serie.linhas}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="mes" tickFormatter={(m) => formatarMes(`${m}-01`)} tick={eixo} />
              <YAxis tickFormatter={formatarBRLCompacto} tick={eixo} width={64} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {v.serie.grupos.map((g, i) => (
                <Bar key={g} dataKey={g} name={g} stackId="a" fill={CORES[i % CORES.length]} />
              ))}
              <Line
                dataKey="autorizado"
                name="Pipe autorizado"
                stroke="var(--color-foreground)"
                strokeDasharray="4 4"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title={matrizDim === "produto" ? "Produto × mês" : "Cliente × mês (top 20 + outros)"}
        subtitle="Clique numa célula ou linha para filtrar a lista de NFs"
        action={
          <AnimatedTabs
            value={matrizDim}
            onChange={(x) => {
              setMatrizDim(x);
              setDrill(null);
            }}
            tabs={[
              { value: "produto", label: "Produto" },
              { value: "cliente", label: "Cliente" },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-label">
            <thead className="text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-card p-2 text-left">
                  {matrizDim === "produto" ? "Produto" : "Cliente"}
                </th>
                {meses.map((m) => (
                  <th key={m} className="p-2 text-right">
                    {formatarMes(`${m}-01`)}
                  </th>
                ))}
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {v.matriz.map((l) => (
                <tr key={l.chave} className="border-t">
                  <td className="sticky left-0 bg-card p-2">
                    <button
                      className="text-left text-primary hover:underline"
                      onClick={() => setDrill({ dim: matrizDim, chave: l.chave })}
                    >
                      {l.chave}
                    </button>
                  </td>
                  {l.valores.map((c) => (
                    <td key={c.chave} className="p-0.5">
                      <button
                        onClick={() => setDrill({ dim: matrizDim, chave: l.chave, mes: c.chave })}
                        className="w-full rounded p-1.5 text-right tabular-nums text-foreground"
                        style={{
                          background: `color-mix(in oklch, var(--color-primary) ${Math.round((c.valor / maxCel) * 70)}%, transparent)`,
                        }}
                        title={formatarBRL(c.valor)}
                      >
                        {c.valor ? formatarBRLCompacto(c.valor) : "—"}
                      </button>
                    </td>
                  ))}
                  <td className="p-2 text-right font-medium tabular-nums">
                    {formatarBRLCompacto(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!v.matriz.length && (
            <p className="p-4 text-body text-muted-foreground">
              Sem dados da Parte 2 para o período.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Lista de NFs"
        subtitle={`${lista.length} NF(s) · ${formatarBRL(lista.reduce((a, n) => a + n.valor, 0))}`}
        action={
          <Button size="sm" variant="outline" disabled={!sel.size} onClick={exportar}>
            <Download className="mr-1 size-4" /> Exportar seleção ({sel.size})
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {sel_(
            fRegime,
            setFRegime,
            [
              ["todos", "Todos"],
              ["Cumulativo", "Cumulativo"],
              ["Não cumulativo", "Não cumulativo"],
            ],
            "Regime",
          )}
          {sel_(
            fStatus,
            setFStatus,
            [
              ["todos", "Todos"],
              ["pago", "Pago"],
              ["pendente", "Pendente"],
              ["atrasado", "Atrasado"],
            ],
            "Status",
          )}
          {sel_(
            fBU,
            setFBU,
            [
              ["todas", "Todas"],
              ["Advertising", "Advertising"],
              ["Analytics", "Analytics"],
            ],
            "BU",
          )}
          {sel_(
            fFaixa,
            setFFaixa,
            M.FAIXAS_VALOR_NF.map((x) => [x.value, x.label]),
            "Valor",
          )}
          <label className="flex items-center gap-2 text-label text-muted-foreground">
            <Checkbox
              checked={todosMarcados}
              onCheckedChange={() =>
                setSel(todosMarcados ? new Set() : new Set(lista.map((n) => n.id)))
              }
            />
            Selecionar todas
          </label>
          {drill && (
            <button
              onClick={() => setDrill(null)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-label text-primary"
            >
              {drill.chave}
              {drill.mes ? ` · ${formatarMes(`${drill.mes}-01`)}` : ""} <X className="size-3" />
            </button>
          )}
        </div>
        <DataTableV2
          rows={lista}
          columns={colunas}
          rowKey={(r) => r.id}
          onRowClick={(r) => abrirDetalhe({ tipo: "nf", id: r.id })}
          vazio="Nenhuma NF com esses filtros."
        />
      </SectionCard>

      <SectionCard
        title="NFs sem negócio / sem cliente / cliente inferido"
        subtitle="Alimenta a tela de Qualidade · clique para abrir a NF"
      >
        {v.pend.length ? (
          <ul className="divide-y">
            {v.pend.slice(0, 100).map(({ nota: n, motivo }) => (
              <li
                key={`${n.id}-${motivo}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-body"
              >
                <span className="flex items-center gap-3">
                  <StatusPill tom={motivo === "cliente_inferido" ? "info" : "warning"}>
                    {MOTIVO[motivo]}
                  </StatusPill>
                  NF {n.numero} · {n.clienteId || n.razaoSocial || "—"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatarBRL(n.valor)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => abrirDetalhe({ tipo: "nf", id: n.id })}
                  >
                    Abrir NF <ExternalLink className="ml-1 size-3" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Nenhuma pendência encontrada.</p>
        )}
        {v.pend.length > 100 && (
          <p className="mt-2 text-label text-muted-foreground">
            Mostrando 100 de {v.pend.length}. Veja todas em{" "}
            <Link to="/qualidade" className="text-primary hover:underline">
              Qualidade
            </Link>
            .
          </p>
        )}
        <p className="mt-3 flex items-center gap-2 text-label text-muted-foreground">
          Regra "cliente inferido pela razão social" <SeloValidacao />
        </p>
      </SectionCard>
    </div>
  );
}
