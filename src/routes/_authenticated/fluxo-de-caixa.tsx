import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import * as M from "@/data/metricas";
import { useFiltros, useMetricas } from "@/hooks/use-dados";
import {
  KpiCard,
  SegmentedControl,
  SectionCard,
  ChartTooltip,
  EmptyState,
  SeloValidacao,
  FilterChip,
} from "@/components/ui-kit";
import { baixarCSV } from "@/components/ui-kit/data-table-v2";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatarBRL, formatarBRLCompacto, formatarMes, formatarPercentual } from "@/lib/format";

const META =
  "Fluxo de caixa realizado, previsto e misto com defasagem de custos, cenários de atraso e saldo acumulado.";
export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de caixa — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Fluxo de caixa — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FluxoDeCaixa,
});

const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const rotulo = (m: string) => (m === "anterior" ? "< 2026" : formatarMes(`${m}-01`));
type Serie = "entradas" | "custos" | "impostos" | "creditos";
const SERIES: { key: Serie; label: string; cor: string }[] = [
  { key: "entradas", label: "Entradas", cor: "var(--color-chart-2)" },
  { key: "custos", label: "Custos (pagamento)", cor: "var(--color-chart-1)" },
  { key: "impostos", label: "Impostos", cor: "var(--color-chart-4)" },
  { key: "creditos", label: "Créditos (informativo)", cor: "var(--color-chart-3)" },
];
const VISOES: { value: M.VisaoCaixa; label: string }[] = [
  { value: "realizado", label: "Realizado" },
  { value: "previsto", label: "Previsto" },
  { value: "misto", label: "Misto" },
];
const CENARIOS: { value: M.CenarioCaixa; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "atraso", label: "Atraso" },
  { value: "pior", label: "Pior caso" },
];

function Grafico({
  linhas,
  corte,
  ativas,
  altura = 320,
}: {
  linhas: M.LinhaCaixa[];
  corte: string;
  ativas: Set<Serie>;
  altura?: number;
}) {
  const dados = linhas.map((l) => ({
    ...l,
    rotulo: rotulo(l.mes),
    custos: -l.custos,
    impostos: -l.impostos,
  }));
  const proj = dados.filter((l) => l.projetado);
  const c = corte.slice(0, 7);
  const marcador = [...dados].reverse().find((l) => l.mes !== "anterior" && l.mes <= c);
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="rotulo" tick={eixo} />
          <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={64} />
          <Tooltip content={<ChartTooltip />} />
          {proj.length > 0 && (
            <ReferenceArea
              x1={proj[0]!.rotulo}
              x2={proj.at(-1)!.rotulo}
              fill="var(--color-muted)"
              fillOpacity={0.6}
            />
          )}
          {marcador && (
            <ReferenceLine
              x={marcador.rotulo}
              stroke="var(--color-primary)"
              strokeDasharray="4 4"
              label={{
                value: "posição",
                fill: "var(--color-primary)",
                fontSize: 11,
                position: "top",
              }}
            />
          )}
          {SERIES.filter((s) => s.key !== "creditos" && ativas.has(s.key)).map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.cor}
              stackId="fluxo"
              radius={2}
            />
          ))}
          {ativas.has("creditos") && (
            <Bar dataKey="creditos" name="Créditos (informativo)" fill="var(--color-chart-3)" />
          )}
          <Line
            dataKey="acumulado"
            name="Saldo acumulado"
            stroke="var(--color-foreground)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function FluxoDeCaixa() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [visao, setVisao] = useState<M.VisaoCaixa>("misto");
  const [cenario, setCenario] = useState<M.CenarioCaixa>("base");
  const [pct, setPct] = useState(30);
  const [dias, setDias] = useState(30);
  const [ativas, setAtivas] = useState<Set<Serie>>(new Set(["entradas", "custos", "impostos"]));
  const params: M.ParamsCaixa = { visao, cenario, atrasoPct: pct / 100, atrasoDias: dias };

  const linhas = useMemo(
    () => M.fluxoCaixa(d, filtros, params),
    [d, filtros, visao, cenario, pct, dias],
  );
  const res = useMemo(() => M.resumoCaixa(linhas, filtros.dataReferencia), [linhas, filtros.dataReferencia]);
  const porBU = useMemo(
    () =>
      (["Advertising", "Analytics"] as const).map((bu) => ({
        bu,
        linhas: M.fluxoCaixa(d, { ...filtros, bu }, params),
      })),
    [d, filtros, visao, cenario, pct, dias], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toggle = (s: Serie) =>
    setAtivas((a) => {
      const n = new Set(a);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  if (!linhas.length)
    return (
      <EmptyState
        title="Sem dados de caixa"
        description="Importe a planilha (Parte 2) para ver o fluxo de caixa."
      />
    );

  const tot = (k: keyof M.LinhaCaixa) => linhas.reduce((a, l) => a + (l[k] as number), 0);
  const exportar = () =>
    baixarCSV(
      "fluxo-de-caixa.csv",
      ["Mês", "Entradas", "Custos", "Impostos", "Créditos", "Saldo", "Acumulado"],
      linhas.map((l) => [
        rotulo(l.mes),
        l.entradas,
        l.custos,
        l.impostos,
        l.creditos,
        l.saldo,
        l.acumulado,
      ]),
    );
  const difPlan = tot("difPlanilha");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-headline font-semibold">Fluxo de caixa</h1>
        <p className="text-body text-muted-foreground">
          Custos entram no mês de pagamento (~2 meses após a emissão, até fev/27). Posição em{" "}
          {filtros.dataReferencia.split("-").reverse().join("/")}.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl ariaLabel="Visão" value={visao} onChange={setVisao} options={VISOES} />
        <SegmentedControl
          ariaLabel="Cenário"
          value={cenario}
          onChange={setCenario}
          options={CENARIOS}
        />
        {cenario === "atraso" && (
          <div className="flex flex-wrap items-center gap-4 text-label text-muted-foreground">
            <label className="flex items-center gap-2">
              {pct}% atrasam
              <Slider
                className="w-28"
                min={0}
                max={100}
                step={5}
                value={[pct]}
                onValueChange={([v]) => setPct(v ?? 0)}
              />
            </label>
            <label className="flex items-center gap-2">
              {dias} dias
              <Slider
                className="w-28"
                min={0}
                max={180}
                step={15}
                value={[dias]}
                onValueChange={([v]) => setDias(v ?? 0)}
              />
            </label>
          </div>
        )}
        {cenario === "pior" && (
          <span className="flex items-center gap-2 text-label text-muted-foreground">
            50% atrasam 90 dias e 10% não entram <SeloValidacao />
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Saldo mínimo projetado" value={formatarBRL(res.saldoMinimo)} />
        <KpiCard label="Mês de menor caixa" value={res.mesMinimo ? rotulo(res.mesMinimo) : "—"} />
        <KpiCard
          label="Cobertura de caixa (meses de custos)"
          value={res.mesesCobertos == null ? "—" : res.mesesCobertos.toFixed(1)}
          needsValidation
        />
        <KpiCard
          label="Previsto já realizado"
          value={res.pctRealizado == null ? "—" : formatarPercentual(res.pctRealizado * 100)}
        />
      </div>

      <SectionCard
        title="Entradas × saídas e saldo acumulado"
        subtitle="Área sombreada = meses projetados. Saldo inicial considerado zero (necessita validação)."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {SERIES.map((s) => (
            <FilterChip key={s.key} selected={ativas.has(s.key)} onClick={() => toggle(s.key)}>
              {s.label}
            </FilterChip>
          ))}
        </div>
        <Grafico linhas={linhas} corte={filtros.dataReferencia} ativas={ativas} />
      </SectionCard>

      <SectionCard
        title="Tabela mensal"
        action={
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download /> CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-body tabular-nums">
            <thead>
              <tr className="text-label text-muted-foreground">
                <th className="py-2 text-left">Linha</th>
                {linhas.map((l) => (
                  <th
                    key={l.mes}
                    className={l.projetado ? "bg-muted px-2 text-right" : "px-2 text-right"}
                  >
                    {rotulo(l.mes)}
                  </th>
                ))}
                <th className="px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Entradas", "entradas"],
                  ["Custos", "custos"],
                  ["Impostos", "impostos"],
                  ["Créditos (info)", "creditos"],
                  ["Saldo", "saldo"],
                  ["Acumulado", "acumulado"],
                ] as const
              ).map(([nome, k]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-2 font-medium">{nome}</td>
                  {linhas.map((l) => (
                    <td
                      key={l.mes}
                      className={l.projetado ? "bg-muted px-2 text-right" : "px-2 text-right"}
                    >
                      {formatarBRLCompacto(l[k])}
                    </td>
                  ))}
                  <td className="px-2 text-right font-medium">
                    {k === "acumulado"
                      ? formatarBRLCompacto(linhas.at(-1)!.acumulado)
                      : formatarBRLCompacto(tot(k))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Advertising × Analytics" subtitle="Mesma visão e cenário, por BU.">
        <div className="grid gap-4 lg:grid-cols-2">
          {porBU.map((b) => (
            <div key={b.bu}>
              <p className="mb-1 text-label font-medium">
                {b.bu} — acumulado {formatarBRL(b.linhas.at(-1)?.acumulado ?? 0)}
              </p>
              <Grafico linhas={b.linhas} corte={filtros.dataReferencia} ativas={ativas} altura={200} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Nota: Faturado − (Recebido − Custos pagos)" action={<SeloValidacao />}>
        <p className="text-body text-muted-foreground">
          A Parte 2 traz o bloco "Diferenças (Faturado − Custos − Recebimentos no mês de pagamento
          dos custos)", total {formatarBRL(difPlan)}. Ele compara o faturado com o caixa efetivo no
          mês em que os custos são pagos; como os custos são pagos ~2 meses depois da emissão, a
          diferença não representa perda, e sim defasagem entre competência e caixa. A regra exata
          da planilha ainda precisa ser confirmada.
        </p>
      </SectionCard>
    </div>
  );
}
