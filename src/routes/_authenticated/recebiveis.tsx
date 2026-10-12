import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, Copy, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  formatarBRL,
  formatarBRLCompacto,
  formatarData,
  formatarMes,
  formatarPercentual,
} from "@/lib/format";
import { mesReferencia, obterAnoBase } from "@/lib/periodo";
import { cn } from "@/lib/utils";

const META =
  "Contas a receber: a vencer, vencido, aging, previsto × realizado, cobrança e calendário de vencimentos.";
export const Route = createFileRoute("/_authenticated/recebiveis")({
  head: () => ({
    meta: [
      { title: "Recebíveis — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Recebíveis — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recebiveis,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar os recebíveis</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const COR_FAIXA: Record<(typeof M.FAIXAS_AGING)[number], string> = {
  "A vencer": "var(--color-chart-3)",
  "1–30": "var(--color-chart-2)",
  "31–60": "var(--color-chart-5)",
  "61–90": "var(--color-chart-4)",
  ">90": "var(--color-danger)",
};
const TOM_STATUS = { pago: "success", pendente: "warning", atrasado: "danger" } as const;
const ROTULO_TOM = {
  success: "Em dia",
  warning: "Até 30 dias",
  danger: "Acima de 30 dias",
} as const;
const CHAVE_MODELO = "controladoria.modeloCobranca";
const CHAVE_ACOMP = "controladoria.acompanhar";
const rotuloMes = (m: string) => (m === "anterior" ? "< 2026" : formatarMes(`${m}-01`));

function useLocal<T>(chave: string, inicial: T) {
  const [v, setV] = useState<T>(inicial);
  useEffect(() => {
    const s = window.localStorage.getItem(chave);
    if (s)
      try {
        setV(JSON.parse(s) as T);
      } catch {
        /* ignora */
      }
  }, [chave]);
  const definir = (x: T) => {
    setV(x);
    window.localStorage.setItem(chave, JSON.stringify(x));
  };
  return [v, definir] as const;
}

function Recebiveis() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [agingDim, setAgingDim] = useState<"bu" | "categoria">("bu");
  const [modelo, setModelo] = useLocal(CHAVE_MODELO, M.MODELO_COBRANCA_PADRAO);
  const [acomp, setAcomp] = useLocal<string[]>(CHAVE_ACOMP, []);
  const [soAcomp, setSoAcomp] = useState(false);

  const v = useMemo(
    () => ({
      kpi: M.kpisRecebiveis(d, filtros),
      agingGrupo: M.agingPor(d, filtros, agingDim),
      agingCli: M.agingPor(d, filtros, "cliente"),
      prev: M.previstoRealizado(d, filtros),
      cobranca: M.listaCobranca(d, filtros),
      risco: M.concentracaoRisco(d, filtros),
    }),
    [d, filtros, agingDim],
  );

  const divergentes = v.prev.filter((x) => x.diverge);
  const acompSet = new Set(acomp);
  const cobrancaRows = soAcomp ? v.cobranca.filter((x) => acompSet.has(x.nota.id)) : v.cobranca;

  const copiar = async (x: M.ItemCobranca) => {
    const t = M.textoCobranca(modelo, {
      cliente: x.nota.clienteId || x.nota.razaoSocial || "cliente",
      nf: x.nota.numero,
      valor: formatarBRL(x.nota.valor),
      vencimento: formatarData(x.nota.vencimento),
      dias: x.dias,
    });
    await navigator.clipboard.writeText(t);
    toast.success("Texto de cobrança copiado");
  };
  const alternar = (id: string) =>
    setAcomp(acompSet.has(id) ? acomp.filter((x) => x !== id) : [...acomp, id]);

  const colCobranca: ColunaV2<M.ItemCobranca>[] = [
    {
      key: "nf",
      header: "NF",
      value: (r) => r.nota.numero,
      render: (r) => (
        <button
          className="font-medium text-primary hover:underline"
          onClick={() => abrirDetalhe({ tipo: "nf", id: r.nota.id })}
        >
          {r.nota.numero}
        </button>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      value: (r) => r.nota.clienteId,
      render: (r) => <LinkCliente id={r.nota.clienteId} nome={r.nota.clienteId || "—"} />,
    },
    { key: "bu", header: "BU", value: (r) => r.nota.bu },
    {
      key: "venc",
      header: "Vencimento",
      value: (r) => r.nota.vencimento,
      render: (r) => formatarData(r.nota.vencimento),
    },
    { key: "dias", header: "Dias de atraso", value: (r) => r.dias, align: "right" },
    {
      key: "valor",
      header: "Valor",
      value: (r) => r.nota.valor,
      align: "right",
      render: (r) => <span className="num">{formatarBRL(r.nota.valor)}</span>,
    },
    {
      key: "prio",
      header: "Prioridade (valor × dias)",
      value: (r) => r.prioridade,
      align: "right",
      render: (r) => <span className="num">{formatarBRLCompacto(r.prioridade)}</span>,
    },
    {
      key: "acoes",
      header: "Ações",
      value: () => "",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copiar(r)}
            aria-label="Copiar texto de cobrança"
          >
            <Copy /> Copiar
          </Button>
          <Button
            size="sm"
            variant={acompSet.has(r.nota.id) ? "secondary" : "ghost"}
            onClick={() => alternar(r.nota.id)}
            aria-label={acompSet.has(r.nota.id) ? "Deixar de acompanhar" : "Marcar para acompanhar"}
          >
            {acompSet.has(r.nota.id) ? <PinOff /> : <Pin />}
          </Button>
        </div>
      ),
    },
  ];

  const colClientes: ColunaV2<M.LinhaAging>[] = [
    {
      key: "sem",
      header: "Semáforo",
      value: (r) => M.tomAgingCliente(r),
      render: (r) => {
        const t = M.tomAgingCliente(r);
        return <StatusPill tom={t}>{ROTULO_TOM[t]}</StatusPill>;
      },
    },
    {
      key: "cliente",
      header: "Cliente",
      value: (r) => r.grupo,
      render: (r) => <LinkCliente id={r.grupo} nome={r.grupo} />,
    },
    ...M.FAIXAS_AGING.map((fx) => ({
      key: fx,
      header: fx,
      value: (r: M.LinhaAging) => r[fx],
      align: "right" as const,
      render: (r: M.LinhaAging) => <span className="num">{r[fx] ? formatarBRL(r[fx]) : "—"}</span>,
    })),
    {
      key: "total",
      header: "Total em aberto",
      value: (r) => r.total,
      align: "right",
      render: (r) => <span className="num font-medium">{formatarBRL(r.total)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-headline font-medium text-foreground">Recebíveis</h1>
        <p className="text-body text-muted-foreground">
          Situação na posição de {formatarData(filtros.dataReferencia)}. Pago, pendente e atrasado
          são recalculados por essa data.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="A vencer — 7 dias"
          value={formatarBRL(v.kpi.aVencer7)}
          variationLabel={`30 dias: ${formatarBRLCompacto(v.kpi.aVencer30)} · 60 dias: ${formatarBRLCompacto(v.kpi.aVencer60)}`}
        />
        <KpiCard
          label="Vencido"
          value={formatarBRL(v.kpi.vencido)}
          variationLabel={`${v.kpi.qtdVencidas} NFs`}
        />
        <KpiCard
          label={`Recebido em ${formatarMes(`${v.kpi.mes}-01`)}`}
          value={formatarBRL(v.kpi.recebidoMes)}
          variationLabel={`Vencendo no mês: ${formatarBRLCompacto(v.kpi.vencidoMes)}`}
        />
        <KpiCard
          label="Taxa de recebimento do mês"
          value={v.kpi.taxaRecebimento == null ? "—" : formatarPercentual(v.kpi.taxaRecebimento)}
          variationLabel="recebido ÷ vencido no mês"
          needsValidation
        />
        <KpiCard
          label="Prazo médio de recebimento"
          value={v.kpi.prazoMedio == null ? "—" : `${Math.round(v.kpi.prazoMedio)} dias`}
          variationLabel="emissão → pagamento"
        />
        <KpiCard
          label="Atraso médio"
          value={v.kpi.atrasoMedio == null ? "—" : `${Math.round(v.kpi.atrasoMedio)} dias`}
          variationLabel="NFs vencidas em aberto"
          needsValidation
        />
        <KpiCard
          label="Concentração top 10"
          value={formatarPercentual(v.risco.participacaoTop)}
          variationLabel="do vencido total"
        />
        <KpiCard
          label="Acompanhando"
          value={String(acomp.length)}
          variationLabel="NFs marcadas neste navegador"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Aging"
          subtitle="NFs em aberto por faixa de atraso"
          action={
            <SegmentedControl
              value={agingDim}
              onChange={setAgingDim}
              ariaLabel="Agrupar aging por"
              options={[
                { value: "bu", label: "Por BU" },
                { value: "categoria", label: "Por categoria" },
              ]}
            />
          }
        >
          {v.agingGrupo.length === 0 ? (
            <EmptyState title="Nada em aberto" description="Não há NFs abertas na data de posição." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={v.agingGrupo} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    horizontal={false}
                  />
                  <XAxis type="number" tick={eixo} tickFormatter={formatarBRLCompacto} />
                  <YAxis type="category" dataKey="grupo" tick={eixo} width={96} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {M.FAIXAS_AGING.map((fx) => (
                    <Bar key={fx} dataKey={fx} stackId="a" fill={COR_FAIXA[fx]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {agingDim === "categoria" && <SeloValidacao className="mt-3" />}
        </SectionCard>

        <SectionCard
          title="Concentração de risco"
          subtitle={`Top 10 clientes em atraso · vencido total ${formatarBRL(v.risco.total)}`}
        >
          {v.risco.top.length === 0 ? (
            <EmptyState title="Sem atrasos" description="Nenhuma NF vencida na data de posição." />
          ) : (
            <ul className="space-y-2">
              {v.risco.top.map((x) => (
                <li key={x.chave} className="space-y-1">
                  <div className="flex justify-between gap-3 text-body">
                    <LinkCliente id={x.chave} nome={x.chave} />
                    <span className="num text-muted-foreground">
                      {formatarBRL(x.valor)} · {formatarPercentual(x.participacao)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-danger"
                      style={{ width: `${Math.max(2, x.participacao * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Previsto × Realizado"
        subtitle="Vencimento × recebimento por mês (Parte 2). Diferença = Recebimento − Vencimento; negativo = pendente."
      >
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={v.prev.map((x) => ({ ...x, rotulo: rotuloMes(x.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="rotulo" tick={eixo} />
              <YAxis tick={eixo} tickFormatter={formatarBRLCompacto} width={72} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="vencimento"
                name="Previsto (vencimento)"
                fill="var(--color-chart-5)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="recebimento"
                name="Realizado (recebimento)"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                dataKey="diferenca"
                name="Diferença"
                stroke="var(--color-danger)"
                strokeWidth={2}
                dot
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-label">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 text-left font-medium">Linha</th>
                {v.prev.map((x) => (
                  <th key={x.mes} className="px-2 py-2 text-right font-medium">
                    {rotuloMes(x.mes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {(
                [
                  ["Vencimento (P2)", "vencimento"],
                  ["Recebimento (P2)", "recebimento"],
                  ["Diferença", "diferenca"],
                  ["Vencimento (NFs)", "vencimentoNF"],
                  ["Recebimento (NFs)", "recebimentoNF"],
                ] as const
              ).map(([rot, campo]) => (
                <tr key={campo} className="border-t border-border">
                  <td className="py-2 font-medium text-foreground">{rot}</td>
                  {v.prev.map((x) => (
                    <td
                      key={x.mes}
                      className={cn(
                        "px-2 py-2 text-right",
                        campo === "diferenca" && x.diferenca < 0 && "text-danger",
                        campo.endsWith("NF") && x.diverge && "bg-warning-soft text-warning",
                      )}
                    >
                      {x[campo] ? formatarBRLCompacto(x[campo]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={cn("mt-3 text-body", divergentes.length ? "text-warning" : "text-success")}>
          {divergentes.length
            ? `Divergência NFs × Parte 2 em ${divergentes.length} mês(es): ${divergentes.map((x) => rotuloMes(x.mes)).join(", ")}.`
            : "Totais das NFs batem com a Parte 2 em todos os meses."}
        </p>
      </SectionCard>

      <SectionCard
        title="Aging por cliente"
        subtitle="Semáforo: verde sem atraso, amarelo até 30 dias, vermelho acima de 30 dias"
        action={<SeloValidacao />}
      >
        <DataTableV2
          rows={v.agingCli}
          columns={colClientes}
          rowKey={(r) => r.grupo}
          vazio="Nenhum cliente com NF em aberto."
        />
      </SectionCard>

      <SectionCard
        title="Lista de cobrança"
        subtitle={`${v.cobranca.length} NFs vencidas, ordenadas por valor × dias de atraso`}
        action={
          <SegmentedControl
            value={soAcomp ? "acomp" : "todas"}
            onChange={(x) => setSoAcomp(x === "acomp")}
            ariaLabel="Mostrar"
            options={[
              { value: "todas", label: "Todas" },
              { value: "acomp", label: `Acompanhando (${acomp.length})` },
            ]}
          />
        }
      >
        <ModeloCobranca modelo={modelo} setModelo={setModelo} />
        <DataTableV2
          rows={cobrancaRows}
          columns={colCobranca}
          rowKey={(r) => r.nota.id}
          vazio="Nenhuma NF vencida."
        />
      </SectionCard>

      <Calendario />
    </div>
  );
}

function ModeloCobranca({ modelo, setModelo }: { modelo: string; setModelo: (s: string) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details
      className="mb-4 rounded-xl border border-border p-3"
      open={aberto}
      onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-body font-medium text-foreground">
        Modelo do texto de cobrança
      </summary>
      <div className="mt-3 space-y-2">
        <Textarea
          rows={3}
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          aria-label="Modelo do texto de cobrança"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-label text-muted-foreground">
            Use {"{cliente}"}, {"{nf}"}, {"{valor}"}, {"{vencimento}"} e {"{dias}"}. Guardado neste
            navegador.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setModelo(M.MODELO_COBRANCA_PADRAO)}>
            Restaurar padrão
          </Button>
        </div>
      </div>
    </details>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");

function Calendario() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const ano = obterAnoBase();
  const [mes, setMes] = useState(() => mesReferencia(filtros.dataReferencia, ano));
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const mapa = useMemo(() => M.calendarioVencimentos(d, filtros, mes), [d, filtros, mes]);
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const primeiro = new Date(a, m - 1, 1).getDay();
  const nDias = new Date(a, m, 0).getDate();
  const celulas: (string | null)[] = [
    ...Array.from({ length: primeiro }, () => null),
    ...Array.from({ length: nDias }, (_, i) => `${mes}-${pad(i + 1)}`),
  ];
  while (celulas.length % 7) celulas.push(null);
  const totalMes = [...mapa.values()].reduce((s, x) => s + x.total, 0);
  const mover = (delta: number) => {
    const nm = m + delta;
    if (nm < 1 || nm > 12) return;
    setMes(`${ano}-${pad(nm)}`);
  };
  const sel = diaSel ? mapa.get(diaSel) : undefined;

  return (
    <SectionCard
      title="Calendário de vencimentos"
      subtitle={`Total no mês: ${formatarBRL(totalMes)}`}
      action={
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => mover(-1)}
            disabled={m <= 1}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center text-body font-medium capitalize">
            {formatarMes(`${mes}-01`)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => mover(1)}
            disabled={m >= 12}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {DIAS_SEMANA.map((x) => (
          <div
            key={x}
            className="bg-muted px-2 py-1.5 text-center text-label font-medium text-muted-foreground"
          >
            {x}
          </div>
        ))}
        {celulas.map((dia, i) => {
          const info = dia ? mapa.get(dia) : undefined;
          const temAtraso = info?.notas.some((n) => n.statusCorte === "atrasado");
          const hoje = dia === filtros.dataReferencia;
          return (
            <button
              key={dia ?? `v${i}`}
              disabled={!info}
              onClick={() => dia && setDiaSel(dia)}
              className={cn(
                "flex min-h-20 flex-col items-start gap-1 bg-card p-2 text-left transition-colors",
                info && "hover:bg-accent",
                !dia && "bg-muted/40",
              )}
            >
              {dia && (
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-label",
                    hoje ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {Number(dia.slice(8))}
                </span>
              )}
              {info && (
                <span
                  className={cn(
                    "num w-full truncate rounded-md px-1.5 py-0.5 text-label font-medium",
                    temAtraso ? "bg-danger-soft text-danger" : "bg-info-soft text-info",
                  )}
                >
                  {formatarBRLCompacto(info.total)} · {info.notas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setDiaSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vencimentos em {diaSel ? formatarData(diaSel) : ""}</DialogTitle>
            <DialogDescription>
              {sel ? `${sel.notas.length} NFs · ${formatarBRL(sel.total)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {sel?.notas.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                <button
                  className="min-w-0 text-left"
                  onClick={() => {
                    setDiaSel(null);
                    abrirDetalhe({ tipo: "nf", id: n.id });
                  }}
                >
                  <p className="truncate font-medium text-primary">NF {n.numero}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {n.clienteId || n.razaoSocial || "—"} · {n.bu}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tom={TOM_STATUS[n.statusCorte]}>{n.statusCorte}</StatusPill>
                  <span className="num">{formatarBRL(n.valor)}</span>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
