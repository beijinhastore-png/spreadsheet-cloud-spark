import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Sparkles } from "lucide-react";
import * as M from "@/data/metricas";
import { obterBUs, obterProdutos } from "@/data/repository";
import { useFiltros, useMetricas } from "@/hooks/use-dados";
import { EmptyState, SectionCard, SegmentedControl, SeloValidacao } from "@/components/ui-kit";
import { abrirDetalhe } from "@/components/detail-drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GLOSSARIO, type EtapaJornada } from "@/lib/glossario";
import { formatarBRL, formatarBRLCompacto, formatarMes, formatarPercentual } from "@/lib/format";
import { obterAnoBase } from "@/lib/periodo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jornada")({
  head: () => ({
    meta: [
      { title: "Jornada do Dinheiro — Controladoria" },
      {
        name: "description",
        content: "Do negócio ganho até a margem: cascata, mapa de calor e defasagens.",
      },
      { property: "og:title", content: "Jornada do Dinheiro — Controladoria" },
      {
        property: "og:description",
        content: "Do negócio ganho até a margem: cascata, mapa de calor e defasagens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Jornada,
  errorComponent: ErroJornada,
});

function ErroJornada({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar a jornada</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        className="rounded-full bg-primary px-4 py-2 text-primary-foreground"
        onClick={() => router.invalidate()}
      >
        Tentar novamente
      </button>
    </div>
  );
}

const fmt = (v: number) => (v === 0 ? "—" : formatarBRLCompacto(v));
const mesCurto = (m: string) => formatarMes(`${m}-01`);
const ESCOPOS: { value: M.TipoEscopo; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "bu", label: "BU" },
  { value: "produto", label: "Produto" },
  { value: "cliente", label: "Cliente" },
];
type Drill = { bloco: M.Bloco; mes?: string | undefined; bu?: string; produto?: string } | null;

function Jornada() {
  const { filtros } = useFiltros();
  const base = useMetricas(filtros);
  const d = base.dados;
  const ano = obterAnoBase();
  const [tipo, setTipo] = useState<M.TipoEscopo>("total");
  const [valor, setValor] = useState("");
  const [drill, setDrill] = useState<Drill>(null);
  const [texto, setTexto] = useState<string | null>(null);

  const opcoes = useMemo(() => {
    if (tipo === "bu") return obterBUs() as string[];
    if (tipo === "produto") return obterProdutos() as string[];
    if (tipo === "cliente") return d.clientes.map((c) => c.nome).sort((a, b) => a.localeCompare(b));
    return [];
  }, [tipo, d]);

  const f = useMemo(() => M.aplicarEscopo(filtros, tipo, valor), [filtros, tipo, valor]);
  const v = useMemo(
    () => ({
      cascata: M.cascata(d, f),
      calor: M.mapaCalor(d, f, ano),
      defas: M.defasagens(d, f),
      difs: M.diferencasJornada(d, f, ano),
    }),
    [d, f, ano],
  );
  const rotulo =
    filtros.de === filtros.ate
      ? mesCurto(filtros.de)
      : `${mesCurto(filtros.de)}–${mesCurto(filtros.ate)}`;

  if (!d.fatos.length)
    return (
      <EmptyState
        title="Jornada do Dinheiro"
        description="Importe a planilha para ver a história do dinheiro."
      />
    );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-headline font-medium text-foreground">Jornada do Dinheiro</h1>
            <p className="text-body text-muted-foreground">
              Do negócio ganho até a margem · {rotulo}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={tipo}
              onChange={(t: M.TipoEscopo) => {
                setTipo(t);
                setValor("");
                setTexto(null);
              }}
              options={ESCOPOS}
            />
            {tipo !== "total" && (
              <select
                aria-label="Valor do escopo"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value);
                  setTexto(null);
                }}
                className="h-10 max-w-64 rounded-xl border border-input bg-card px-3 text-body text-foreground"
              >
                <option value="">Todos</option>
                {opcoes.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setTexto(M.explicarJornada(d, f, ano, rotulo, formatarBRLCompacto))}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-body font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="size-4" /> Explicar com palavras
            </button>
          </div>
        </header>

        {texto && (
          <div className="surface-card animate-fade-in border-l-4 border-primary p-4 text-body text-foreground">
            {texto}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            <Cascata
              barras={v.cascata}
              onClick={(e) => e !== "margem" && setDrill({ bloco: e as M.Bloco })}
            />
            <MapaCalor linhas={v.calor} onClick={(bloco, mes) => setDrill({ bloco, mes })} />
            <LinhaTempo defas={v.defas} />
          </div>
          <div className="lg:col-span-4">
            <PainelDiferencas difs={v.difs} ano={ano} />
          </div>
        </div>
      </div>
      <DrillSheet drill={drill} setDrill={setDrill} d={d} f={f} />
    </TooltipProvider>
  );
}

function Cascata({
  barras,
  onClick,
}: {
  barras: M.BarraCascata[];
  onClick: (e: EtapaJornada) => void;
}) {
  const max = Math.max(1, ...barras.map((b) => Math.max(Math.abs(b.ate), Math.abs(b.de))));
  const min = Math.min(0, ...barras.map((b) => b.de));
  const escala = max - min || 1;
  const H = 220;
  const y = (n: number) => ((max - n) / escala) * H;
  const cor: Record<M.TipoBarra, string> = {
    nivel: "bg-primary",
    negativa: "bg-danger",
    positiva: "bg-success",
    info: "bg-muted-foreground/30 border border-dashed border-muted-foreground",
    total: "bg-chart-2",
  };
  return (
    <SectionCard
      title="Cascata do período"
      subtitle="Clique numa etapa para ver BU × produto e clientes"
      menu={false}
    >
      <div className="overflow-x-auto">
        <div className="flex min-w-[720px] items-start gap-1.5">
          {barras.map((b) => {
            const g = GLOSSARIO[b.etapa];
            const top = y(b.ate),
              alt = Math.max(2, y(b.de) - y(b.ate));
            return (
              <Tooltip key={b.etapa}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onClick(b.etapa)}
                    className="group flex flex-1 flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-foreground/5"
                  >
                    <span className="num text-label font-medium text-foreground">
                      {fmt(b.valor)}
                    </span>
                    <div className="relative w-full" style={{ height: H }}>
                      <div
                        className={cn(
                          "absolute inset-x-1 rounded-md transition-opacity group-hover:opacity-80",
                          b.valor === 0 ? "bg-muted" : cor[b.tipo],
                        )}
                        style={{ top, height: alt }}
                      />
                    </div>
                    <span className="text-center text-label leading-tight text-muted-foreground">
                      {g.curto}
                    </span>
                    <span className="num text-label text-muted-foreground">
                      {b.conversao == null ? " " : formatarPercentual(b.conversao, 0)}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  <p className="font-medium">
                    {g.nome}: {b.valor === 0 ? "—" : formatarBRL(b.valor)}
                  </p>
                  <p className="opacity-80">{g.definicao}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-label text-muted-foreground">
        % = conversão vs etapa anterior (fluxo) ou peso sobre o faturado por competência (custos,
        impostos, créditos, margem). Custos por emissão são informativos.{" "}
        <SeloValidacao className="ml-1" />
      </p>
    </SectionCard>
  );
}

function MapaCalor({
  linhas,
  onClick,
}: {
  linhas: M.LinhaCalor[];
  onClick: (b: M.Bloco, mes: string) => void;
}) {
  const max = Math.max(1, ...linhas.flatMap((l) => l.valores.map((x) => Math.abs(x.valor))));
  return (
    <SectionCard
      title="Mapa de calor · Mês × Etapa"
      subtitle={`Contorno = diferença acima de ${formatarPercentual(M.TOLERANCIA_JORNADA.percentual, 0)} (Fat. compet. × Autorizado; Recebido × Vencimento)`}
      menu={false}
      action={<SeloValidacao />}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0.5 text-label">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground">Etapa</th>
              {linhas[0]?.valores.map((x) => (
                <th key={x.chave} className="font-medium text-muted-foreground">
                  {mesCurto(x.chave).slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.etapa}>
                <td className="whitespace-nowrap pr-2 text-foreground">
                  {GLOSSARIO[l.etapa as EtapaJornada].curto}
                </td>
                {l.valores.map((x, i) => {
                  const intens = Math.abs(x.valor) / max;
                  return (
                    <td key={x.chave} className="p-0">
                      <button
                        type="button"
                        disabled={x.valor === 0}
                        onClick={() => onClick(l.etapa, x.chave)}
                        title={`${GLOSSARIO[l.etapa as EtapaJornada].nome} · ${mesCurto(x.chave)}: ${x.valor === 0 ? "—" : formatarBRL(x.valor)}`}
                        className={cn(
                          "num relative h-8 w-full overflow-hidden rounded-md text-foreground",
                          l.alerta[i] && "ring-2 ring-warning",
                        )}
                      >
                        <span
                          className="absolute inset-0 bg-primary"
                          style={{ opacity: x.valor === 0 ? 0.04 : 0.08 + intens * 0.6 }}
                        />
                        <span className="relative">
                          {x.valor === 0 ? "—" : formatarBRLCompacto(x.valor).replace("R$ ", "")}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function LinhaTempo({ defas }: { defas: M.Defasagens }) {
  const dias = (n: number | null) => (n == null ? "—" : `${Math.round(n)} dias`);
  const marcos = [
    { nome: "Emissão", depois: dias(defas.emissaoVencimento) },
    { nome: "Vencimento", depois: dias(defas.vencimentoRecebimento) },
    { nome: "Recebimento", depois: null },
  ];
  const hip = 2;
  return (
    <SectionCard
      title="Linha do tempo de defasagens"
      subtitle={`Tempo médio calculado em ${defas.qtdNFs} NFs (${defas.qtdPagas} pagas)`}
      menu={false}
    >
      <div className="flex items-center">
        {marcos.map((m, i) => (
          <div key={m.nome} className={cn("flex items-center", i < marcos.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span className="size-4 rounded-full bg-primary" />
              <span className="text-label text-foreground">{m.nome}</span>
            </div>
            {m.depois && (
              <div className="mx-2 flex flex-1 flex-col items-center">
                <span className="num text-body font-medium text-foreground">{m.depois}</span>
                <span className="h-0.5 w-full bg-outline-variant" />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-label text-muted-foreground">
        Emissão → recebimento: {dias(defas.emissaoRecebimento)} em média.
      </p>
      <div className="mt-4 rounded-xl bg-surface-container p-3 text-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-foreground">
            Custo por emissão → custo por pagamento:{" "}
            <strong className="num">
              {defas.custoMeses == null
                ? "—"
                : `${defas.custoMeses} ${defas.custoMeses === 1 ? "mês" : "meses"}`}
            </strong>
          </span>
          <SeloValidacao />
        </div>
        <p className="mt-1 text-label text-muted-foreground">
          Hipótese da planilha: ~{hip} meses.{" "}
          {defas.custoMeses == null
            ? "Sem dados suficientes para validar."
            : defas.custoMeses === hip
              ? "Os dados confirmam a hipótese"
              : `Os dados sugerem ${defas.custoMeses} ${defas.custoMeses === 1 ? "mês" : "meses"}`}
          {defas.custoErro != null &&
            ` (desvio residual ${formatarPercentual(defas.custoErro, 0)}).`}
        </p>
      </div>
    </SectionCard>
  );
}

function PainelDiferencas({ difs, ano }: { difs: M.DiferencasJornada; ano: number }) {
  const itens = [
    {
      t: "Pipe autorizado × Faturado por competência",
      s: `Somente ${ano}, sem bucket anterior`,
      v: difs.pipeXFaturado,
      val: false,
    },
    {
      t: "Vencimento × Recebimento",
      s: "Negativo = ainda não recebido",
      v: difs.vencXReceb,
      val: false,
    },
    {
      t: "Recebido − Custos pagos",
      s: "Hipótese da planilha",
      v: difs.recebidoMenosCustos,
      val: true,
    },
  ];
  return (
    <SectionCard title="Diferenças que merecem atenção" menu={false} className="lg:sticky lg:top-4">
      <ul className="space-y-3">
        {itens.map((x) => (
          <li key={x.t} className="rounded-xl bg-surface-container-low p-4">
            <p className="text-body font-medium text-foreground">{x.t}</p>
            <p className="text-label text-muted-foreground">{x.s}</p>
            <p
              className={cn(
                "num mt-2 text-title font-medium",
                x.v < 0 ? "text-danger" : x.v > 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {x.v === 0 ? "—" : formatarBRL(x.v)}
            </p>
            {x.val && <SeloValidacao className="mt-2" />}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function DrillSheet({
  drill,
  setDrill,
  d,
  f,
}: {
  drill: Drill;
  setDrill: (x: Drill) => void;
  d: M.Dados;
  f: ReturnType<typeof M.aplicarEscopo>;
}) {
  const g = drill ? GLOSSARIO[drill.bloco as EtapaJornada] : null;
  const nivel2 = !!drill?.bu;
  const linhas = useMemo(() => {
    if (!drill) return [];
    if (drill.bu)
      return M.drillClientes(d, drill.bloco, f, drill.bu, drill.produto ?? "—", drill.mes);
    return [];
  }, [drill, d, f]);
  const bp = useMemo(
    () => (drill && !drill.bu ? M.drillBUProduto(d, drill.bloco, f, drill.mes) : []),
    [drill, d, f],
  );
  return (
    <Sheet open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {g?.nome}
            {drill?.mes ? ` · ${mesCurto(drill.mes)}` : ""}
          </SheetTitle>
          <SheetDescription>
            {nivel2 ? `${drill?.bu} · ${drill?.produto} — clientes` : "Por BU × produto"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-1 px-4">
          {nivel2 && (
            <button
              type="button"
              onClick={() => setDrill({ bloco: drill!.bloco, mes: drill!.mes })}
              className="mb-2 inline-flex items-center gap-1 text-body text-primary"
            >
              <ChevronLeft className="size-4" /> Voltar para BU × produto
            </button>
          )}
          {!nivel2 && bp.length === 0 && (
            <p className="text-body text-muted-foreground">Sem valores.</p>
          )}
          {!nivel2 &&
            bp.map((x) => (
              <button
                key={`${x.bu}|${x.produto}`}
                type="button"
                onClick={() => setDrill({ ...drill!, bu: x.bu, produto: x.produto })}
                className="flex w-full justify-between gap-3 rounded-lg px-2 py-2 text-left text-body hover:bg-foreground/5"
              >
                <span>
                  <span className="text-muted-foreground">{x.bu} · </span>
                  {x.produto}
                </span>
                <span className="num font-medium">{fmt(x.valor)}</span>
              </button>
            ))}
          {nivel2 && linhas.length === 0 && (
            <p className="text-body text-muted-foreground">Sem clientes com valor.</p>
          )}
          {nivel2 &&
            linhas.map((x) => (
              <button
                key={x.chave}
                type="button"
                onClick={() => x.chave !== "—" && abrirDetalhe({ tipo: "cliente", id: x.chave })}
                className="flex w-full justify-between gap-3 rounded-lg px-2 py-2 text-left text-body hover:bg-foreground/5"
              >
                <span className="text-primary">{x.chave}</span>
                <span className="num font-medium">{fmt(x.valor)}</span>
              </button>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
