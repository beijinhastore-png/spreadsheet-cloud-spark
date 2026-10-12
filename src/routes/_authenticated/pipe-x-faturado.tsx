import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
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
} from "@/components/ui-kit";
import { DataTableV2, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { abrirDetalhe, LinkCliente } from "@/components/detail-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarBRL, formatarBRLCompacto, formatarMes, formatarPercentual } from "@/lib/format";
import { cn } from "@/lib/utils";

const META =
  "Onde o vendido não virou faturamento: Pipe autorizado × Faturado por competência, com semáforo e causas.";
export const Route = createFileRoute("/_authenticated/pipe-x-faturado")({
  head: () => ({
    meta: [
      { title: "Pipe × Faturado — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Pipe × Faturado — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipeXFaturado,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">
        Não foi possível carregar Pipe × Faturado
      </p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

type Visao = "absoluto" | "diferenca" | "percentual";
type Sel = { bu: string; produto: string; mes: string } | null;
const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const TOM_CLASSE: Record<M.TomPxF, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};
const CAUSAS: { id: M.CausaPxF; titulo: string }[] = [
  { id: "sem_card", titulo: "Faturado sem card (Não Localizado)" },
  { id: "autorizado_sem_nf", titulo: "Card autorizado sem NF" },
  { id: "competencia_diferente", titulo: "NF de competência diferente do sufixo do card" },
  { id: "valor_diferente", titulo: "Valor da NF ≠ valor do card" },
];

function PipeXFaturado() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [tolPct, setTolPct] = useState(M.TOLERANCIA_PXF_PADRAO * 100);
  const [regime, setRegime] = useState<M.RegimePxF>("autorizado");
  const [visao, setVisao] = useState<Visao>("diferenca");
  const [sel, setSel] = useState<Sel>(null);
  const [causa, setCausa] = useState<M.CausaPxF>("sem_card");
  const tol = tolPct / 100;

  const v = useMemo(() => {
    const linhas = M.matrizPxF(d, filtros, regime);
    const bus = [...new Set(linhas.map((l) => l.bu))];
    const grupos = bus.map((bu) => {
      const prods = linhas.filter((l) => l.bu === bu);
      return { bu, prods, total: M.totalLinhasPxF(prods, bu) };
    });
    const causas = M.causasPxF(d, filtros);
    const divergentes = linhas.filter((l) => M.conferePxF(l.total) === "divergente").length;
    return {
      linhas,
      grupos,
      geral: M.totalLinhasPxF(linhas, "Total"),
      kpi: M.kpisPxF(linhas),
      serie: M.seriePxF(linhas, filtros),
      causas,
      divergentes,
    };
  }, [d, filtros, regime]);

  const meses = v.serie.map((s) => s.mes);
  const rotuloBase = regime === "total" ? "Pipe" : "Pipe autorizado";
  const drill = useMemo(
    () => (sel ? M.drillPxF(d, filtros, regime, sel.bu, sel.produto, sel.mes) : []),
    [d, filtros, regime, sel],
  );

  if (!v.linhas.length)
    return (
      <EmptyState
        title="Sem dados da Parte 2"
        description="Importe a planilha para ver Pipe × Faturado."
      />
    );

  const celula = (c: M.CelulaPxF, bu: string, produto: string, mes: string, forte = false) => {
    const tom = M.tomPxF(c.base, c.fat, tol);
    const ativo = sel && sel.bu === bu && sel.produto === produto && sel.mes === mes;
    return (
      <td key={mes} className="p-0.5">
        <button
          type="button"
          onClick={() => setSel({ bu, produto, mes })}
          className={cn(
            "num w-full rounded-md px-1.5 py-1 text-right text-label transition-shadow hover:ring-2 hover:ring-ring",
            TOM_CLASSE[tom],
            forte && "font-semibold",
            ativo && "ring-2 ring-primary",
          )}
          title={`${rotuloBase} ${formatarBRL(c.base)} · Faturado ${formatarBRL(c.fat)} · Dif ${formatarBRL(c.dif)}`}
        >
          {visao === "absoluto" ? (
            <>
              <div>{formatarBRLCompacto(c.base)}</div>
              <div className="opacity-75">{formatarBRLCompacto(c.fat)}</div>
            </>
          ) : visao === "diferenca" ? (
            formatarBRLCompacto(c.dif)
          ) : (
            formatarPercentual(c.base ? c.dif / c.base : c.fat ? -1 : 0, 0)
          )}
        </button>
      </td>
    );
  };

  const conf = (c: M.CelulaPxF) => {
    const r = M.conferePxF(c);
    return (
      <td className="num px-2 text-right text-label">
        <span className="inline-flex items-center gap-1">
          {formatarBRLCompacto(c.planilha)}
          {r === "ok" ? (
            <CheckCircle2 className="size-3.5 text-success" aria-label="Confere" />
          ) : (
            <AlertTriangle
              className={cn("size-3.5", r === "sinal" ? "text-warning" : "text-danger")}
              aria-label={r === "sinal" ? "Sinal oposto" : "Divergente"}
            />
          )}
        </span>
      </td>
    );
  };

  const linha = (l: M.LinhaPxF, forte: boolean, rotulo: string, produto: string) => (
    <tr
      key={`${l.bu}|${rotulo}`}
      className={cn("border-t border-outline-variant", forte && "bg-surface-container")}
    >
      <td
        className={cn(
          "sticky left-0 whitespace-nowrap bg-card px-2 py-1 text-body",
          forte ? "font-medium" : "pl-5 text-muted-foreground",
        )}
      >
        {rotulo}
      </td>
      {celula(l.anterior, l.bu, produto, "anterior", forte)}
      {l.meses.map((c, i) => celula(c, l.bu, produto, meses[i]!, forte))}
      {celula(l.total, l.bu, produto, "total", true)}
      {conf(l.total)}
      <td className="num px-2 text-right text-label text-muted-foreground">
        {formatarBRLCompacto(l.aLiberar)}
      </td>
    </tr>
  );

  const colsDrill: ColunaV2<(typeof drill)[number]>[] = [
    {
      key: "cliente",
      header: "Cliente",
      value: (r) => r.cliente,
      render: (r) => <LinkCliente id={r.cliente} nome={r.cliente} />,
    },
    {
      key: "base",
      header: rotuloBase,
      align: "right",
      value: (r) => r.base,
      render: (r) => <span className="num">{formatarBRL(r.base)}</span>,
    },
    {
      key: "fat",
      header: "Faturado",
      align: "right",
      value: (r) => r.fat,
      render: (r) => <span className="num">{formatarBRL(r.fat)}</span>,
    },
    {
      key: "dif",
      header: "Diferença",
      align: "right",
      value: (r) => r.dif,
      render: (r) => (
        <StatusPill tom={M.tomPxF(r.base, r.fat, tol)}>{formatarBRL(r.dif)}</StatusPill>
      ),
    },
    { key: "neg", header: "Negócios", align: "right", value: (r) => r.negocios.length },
    { key: "nfs", header: "NFs", align: "right", value: (r) => r.nfs.length },
  ];
  const regsCausa = v.causas.filter((c) => c.causa === causa);
  const colsCausa: ColunaV2<M.RegistroCausa>[] = [
    { key: "cliente", header: "Cliente", value: (r) => r.cliente },
    { key: "produto", header: "Produto", value: (r) => r.produto },
    { key: "comp", header: "Competência", value: (r) => r.competencia },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      value: (r) => r.valor,
      render: (r) => <span className="num">{formatarBRL(r.valor)}</span>,
    },
    { key: "det", header: "Detalhe", value: (r) => r.detalhe },
    {
      key: "abrir",
      header: "",
      value: () => "",
      render: (r) =>
        r.tipo === "fato" ? null : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              abrirDetalhe({ tipo: r.tipo as "negocio" | "nf", id: r.id.replace(/^[a-z]+-/, "") })
            }
          >
            Abrir
          </Button>
        ),
    },
  ];
  const rotMes = (m: string) =>
    m === "anterior" ? "anterior a 2026" : m === "total" ? "ano" : formatarMes(`${m}-01`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline font-medium">Pipe × Faturado</h1>
          <p className="text-body text-muted-foreground">
            Diferença = {rotuloBase} − Faturado por competência (só 2026) + A liberar.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            ariaLabel="Regime de comparação"
            value={regime}
            onChange={setRegime}
            options={[
              { value: "total", label: "Pipe total" },
              { value: "autorizado", label: "Pipe autorizado" },
            ]}
          />
          <label className="flex items-center gap-2 text-body text-muted-foreground">
            Tolerância
            <Input
              type="number"
              min={0}
              step={1}
              value={tolPct}
              aria-label="Tolerância (%)"
              onChange={(e) => setTolPct(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 w-20"
            />
            %
          </label>
          <SeloValidacao />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Pipe"
          value={formatarBRL(
            regime === "total" ? v.kpi.base : M.kpisPxF(M.matrizPxF(d, filtros, "total")).base,
          )}
        />
        <KpiCard
          label="Pipe autorizado"
          value={formatarBRL(
            regime === "autorizado"
              ? v.kpi.base
              : M.kpisPxF(M.matrizPxF(d, filtros, "autorizado")).base,
          )}
        />
        <KpiCard label="Faturado (competência)" value={formatarBRL(v.kpi.fat)} />
        <KpiCard
          label="Diferença"
          value={formatarBRL(v.kpi.dif)}
          variationLabel={`Planilha: ${formatarBRL(v.geral.total.planilha)}`}
        />
        <KpiCard label="% de aderência" value={formatarPercentual(v.kpi.aderencia, 1)} />
        <KpiCard label="A liberar" value={formatarBRL(v.kpi.aLiberar)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={`${rotuloBase} × Faturado`}
          subtitle="Por mês de competência"
          menu={false}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={v.serie.map((s) => ({ ...s, rot: formatarMes(`${s.mes}-01`) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="rot" tick={eixo} />
                <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={64} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar
                  dataKey="base"
                  name={rotuloBase}
                  fill="var(--color-chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="fat"
                  name="Faturado"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard
          title="Diferença acumulada"
          subtitle="Barras = diferença do mês · linha = acumulado"
          menu={false}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={v.serie.map((s) => ({ ...s, rot: formatarMes(`${s.mes}-01`) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="rot" tick={eixo} />
                <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={64} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="dif" name="Diferença">
                  {v.serie.map((s) => (
                    <Cell
                      key={s.mes}
                      fill={s.dif >= 0 ? "var(--color-chart-3)" : "var(--color-destructive)"}
                    />
                  ))}
                </Bar>
                <Line
                  dataKey="acumulada"
                  name="Acumulada"
                  stroke="var(--color-chart-4)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Matriz BU × Produto × Mês"
        subtitle={`Verde ≤ ${tolPct}% · amarelo ≤ ${tolPct * 2}% · vermelho acima. Clique numa célula para ver os clientes.${v.divergentes ? ` ${v.divergentes} linha(s) divergem da planilha.` : ""}`}
        menu={false}
        action={
          <SegmentedControl
            ariaLabel="Visão"
            value={visao}
            onChange={setVisao}
            options={[
              { value: "absoluto", label: "Valores" },
              { value: "diferenca", label: "Diferença" },
              { value: "percentual", label: "%" },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-label text-muted-foreground">
                <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">
                  BU › Produto
                </th>
                <th className="px-1 py-2 text-right font-medium">&lt;2026</th>
                {meses.map((m) => (
                  <th key={m} className="px-1 py-2 text-right font-medium">
                    {formatarMes(`${m}-01`)}
                  </th>
                ))}
                <th className="px-1 py-2 text-right font-medium">Total 2026</th>
                <th className="px-2 py-2 text-right font-medium">Parte 2 (BM:BY)</th>
                <th className="px-2 py-2 text-right font-medium">A liberar</th>
              </tr>
            </thead>
            <tbody>
              {v.grupos.map((g) => (
                <Fragment key={g.bu}>
                  {g.prods.map((l) => linha(l, false, l.produto, l.produto))}
                  {linha(g.total, true, `Total ${g.bu}`, "Total")}
                </Fragment>
              ))}
              {linha(v.geral, true, "Total geral", "Total")}
            </tbody>
          </table>
        </div>
        {visao === "absoluto" && (
          <p className="mt-2 text-label text-muted-foreground">
            Em cada célula: {rotuloBase} (em cima) e Faturado (embaixo).
          </p>
        )}
      </SectionCard>

      {sel && (
        <SectionCard
          title={`Clientes · ${sel.bu === "Total" ? "Todas as BUs" : sel.bu} › ${sel.produto === "Total" ? "todos os produtos" : sel.produto} · ${rotMes(sel.mes)}`}
          subtitle="Nível cliente da Parte 2; expanda a linha para ver negócios e NFs relacionados."
          menu={false}
          action={
            <Button size="icon" variant="ghost" aria-label="Fechar" onClick={() => setSel(null)}>
              <X />
            </Button>
          }
        >
          <DataTableV2
            rows={drill}
            columns={colsDrill}
            rowKey={(r) => r.cliente}
            vazio="Nenhum cliente nesta célula."
            expand={(r) => (
              <div className="grid gap-3 p-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-label font-medium text-muted-foreground">Negócios</p>
                  {r.negocios.length ? (
                    r.negocios.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="block text-left text-body text-primary hover:underline"
                        onClick={() => abrirDetalhe({ tipo: "negocio", id: n.id })}
                      >
                        {n.titulo || n.id} · {formatarBRL(n.valor)}
                      </button>
                    ))
                  ) : (
                    <p className="text-body text-muted-foreground">Nenhum.</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-label font-medium text-muted-foreground">NFs</p>
                  {r.nfs.length ? (
                    r.nfs.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="block text-left text-body text-primary hover:underline"
                        onClick={() => abrirDetalhe({ tipo: "nf", id: n.id })}
                      >
                        NF {n.numero} · {formatarBRL(n.valor)}
                      </button>
                    ))
                  ) : (
                    <p className="text-body text-muted-foreground">Nenhuma.</p>
                  )}
                </div>
              </div>
            )}
          />
        </SectionCard>
      )}

      <SectionCard
        title="Causas prováveis"
        subtitle="Regras sobre negócios e NFs (Parte 1) e nível cliente (Parte 2)."
        menu={false}
        action={<SeloValidacao />}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {CAUSAS.map((c) => {
            const regs = v.causas.filter((x) => x.causa === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCausa(c.id)}
                className={cn(
                  "rounded-xl border border-outline px-3 py-2 text-left transition-colors",
                  causa === c.id
                    ? "bg-primary-container text-on-primary-container"
                    : "hover:bg-foreground/5",
                )}
              >
                <p className="text-body font-medium">{c.titulo}</p>
                <p className="num text-label opacity-80">
                  {regs.length} registro(s) · {formatarBRL(regs.reduce((a, x) => a + x.valor, 0))}
                </p>
              </button>
            );
          })}
        </div>
        <DataTableV2
          rows={regsCausa}
          columns={colsCausa}
          rowKey={(r) => r.id}
          vazio="Nenhum registro para esta causa."
        />
      </SectionCard>
    </div>
  );
}
