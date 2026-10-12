import { formatarMes } from "@/lib/format";
import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import * as M from "@/data/metricas";
import { obterChecagens, obterImportacoes } from "@/data/repository";
import { useFiltros, useMetricas } from "@/hooks/use-dados";
import { SeloConfianca } from "@/components/app-shell";
import { mesReferencia } from "@/lib/periodo";
import { REGIMES } from "@/lib/filtros";
import {
  Saudacao,
  LinhaKpis,
  GraficoPrincipal,
  JornadaResumida,
  FaturadoPorBU,
  ListaBarras,
  Aging,
  TopClientes,
  Alertas,
  ComoLer,
  DashboardVazio,
  DashboardSkeleton,
  type Kpi,
  type Ponto,
} from "@/components/dashboard/blocos";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard executivo — Controladoria" },
      { name: "description", content: "Pipe, faturado, recebido, aging e alertas de relance." },
      { property: "og:title", content: "Dashboard executivo — Controladoria" },
      {
        property: "og:description",
        content: "Pipe, faturado, recebido, aging e alertas de relance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
  pendingComponent: DashboardSkeleton,
  errorComponent: ErroDashboard,
});

function ErroDashboard({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar o dashboard</p>
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

function Dashboard() {
  const { filtros } = useFiltros();
  const m = useMetricas(filtros);
  const d = m.dados;
  const importacoes = useQuery({ queryKey: ["importacoes"], queryFn: obterImportacoes });

  const v = useMemo(() => {
    const ref = mesReferencia(filtros.ate);
    const bFat = M.blocoFaturado(filtros.regime);
    const c = m.cadeia;
    const faturado = filtros.regime === "emissao" ? c.faturadoEmissao : c.faturadoCompetencia;
    const sPipe = m.serieMensal("pipe");
    const sFat = m.serieMensal(bFat);
    const sRec = m.serieMensal("recebimento");
    const ab = M.serieAbertas(d, filtros);
    const sMar = M.serieMargem(d, filtros);
    const regimeLbl = REGIMES.find((r) => r.value === filtros.regime)?.label ?? "";
    const kpi = (
      label: string,
      valor: number,
      s: M.Item[],
      destino: Kpi["destino"],
      extra: Partial<Kpi> = {},
    ): Kpi => ({
      label,
      valor,
      serie: s.map((x) => x.valor),
      variacao: M.variacaoMensal(s, ref),
      destino,
      ...extra,
    });
    const kpis: Kpi[] = [
      kpi("Pipe ganho", c.pipe, sPipe, "/negocios"),
      kpi(`Faturado (${regimeLbl.toLowerCase()})`, faturado, sFat, "/faturamento"),
      kpi("Recebido", c.recebido, sRec, "/recebiveis"),
      kpi("A receber", c.aVencer, ab.aVencer, "/recebiveis"),
      kpi("Em atraso", c.vencido, ab.vencido, "/recebiveis", { inverter: true }),
      kpi("Margem estimada", c.margem, sMar, "/controladoria", { validar: true }),
    ];

    const serieBU = (bu: string) => {
      const f = { ...filtros, bu };
      const p = M.serieMensal(d, "pipe", f),
        fa = M.serieMensal(d, bFat, f),
        r = M.serieMensal(d, "recebimento", f);
      const junta = (a: M.Item[], b: M.Item[], cc: M.Item[]): Ponto[] =>
        a.map((x, i) => ({
          chave: x.chave,
          pipe: x.valor,
          faturado: b[i]!.valor,
          recebido: cc[i]!.valor,
        }));
      return {
        mensal: junta(p, fa, r),
        acumulado: junta(M.acumular(p), M.acumular(fa), M.acumular(r)),
      };
    };
    const series = {
      Ambas: serieBU(""),
      Advertising: serieBU("Advertising"),
      Analytics: serieBU("Analytics"),
    };

    const buProd = M.porBUProduto(d, bFat, filtros);
    const totProd = new Map<string, number>();
    buProd.forEach((b) =>
      Object.entries(b.produtos).forEach(([p, x]) => totProd.set(p, (totProd.get(p) ?? 0) + x)),
    );
    const produtos = [...totProd].sort((a, b) => b[1] - a[1]).map(([p]) => p);
    const dadosBU = buProd.map((b) => ({ bu: b.bu, ...b.produtos }));

    return {
      ref,
      kpis,
      series,
      produtos,
      dadosBU,
      etapas: M.etapasJornada(c, faturado),
      categorias: M.porCategoria(d, bFat, filtros).map((x) => ({ nome: x.chave, valor: x.valor })),
      topClientes: M.curvaABC(m.porCliente(bFat)).slice(0, 10),
      topProdutos: M.topN(m.porProduto(bFat), 5).map((x) => ({ nome: x.chave, valor: x.valor })),
      alertas: M.alertas(d, filtros, obterChecagens()),
    };
  }, [m, d, filtros]);

  const saud = (
    <Saudacao
      titulo={
        filtros.de === filtros.ate
          ? formatarMes(`${filtros.de}-01`)
          : `${formatarMes(`${filtros.de}-01`)} a ${formatarMes(`${filtros.ate}-01`)}`
      }
      corte={filtros.dataReferencia}
      ultimaImportacao={
        importacoes.isLoading ? undefined : (importacoes.data?.[0]?.criadoEm ?? null)
      }
      selo={<SeloConfianca />}
    />
  );
  if (!d.fatos.length && !d.notas.length)
    return (
      <div className="space-y-6">
        {saud}
        <DashboardVazio />
      </div>
    );

  return (
    <div className="space-y-6">
      {saud}
      <LinhaKpis kpis={v.kpis} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        <div className="md:col-span-2 lg:col-span-8 grid">
          <GraficoPrincipal
            key={filtros.bu}
            series={v.series}
            mesRef={v.ref}
            buInicial={filtros.bu}
          />
        </div>
        <div className="md:col-span-2 lg:col-span-4 grid">
          <JornadaResumida etapas={v.etapas} />
        </div>
        <FaturadoPorBU dados={v.dadosBU} produtos={v.produtos} />
        <ListaBarras
          titulo="Faturado por categoria"
          subtitulo="Terceiro × Anunciante"
          itens={v.categorias}
          destino="/clientes"
          className="lg:col-span-4"
        />
        <Aging faixas={m.aging} />
        <div className="md:col-span-2 lg:col-span-7 grid">
          <TopClientes itens={v.topClientes} />
        </div>
        <div className="md:col-span-2 lg:col-span-5 grid">
          <ListaBarras titulo="Top 5 produtos" itens={v.topProdutos} destino="/faturamento" />
        </div>
        <div className="md:col-span-2 lg:col-span-12 grid">
          <Alertas itens={v.alertas} />
        </div>
      </div>
      <ComoLer />
    </div>
  );
}
