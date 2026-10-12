import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, ExternalLink, AlertTriangle } from "lucide-react";
import * as M from "@/data/metricas";
import { obterControles } from "@/data/repository";
import { useFiltros, useMetricas } from "@/hooks/use-dados";
import {
  KpiCard,
  AnimatedTabs,
  SectionCard,
  ChartTooltip,
  EmptyState,
  StatusPill,
  SeloValidacao,
} from "@/components/ui-kit";
import { DataTableV2, baixarCSV, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { abrirDetalhe, LinkCliente } from "@/components/detail-drawer";
import { Button } from "@/components/ui/button";
import {
  formatarBRL,
  formatarBRLCompacto,
  formatarData,
  formatarMes,
  formatarPercentual,
} from "@/lib/format";
import type { Negocio } from "@/data/tipos";

const META = "O que foi vendido, o que está liberado para emissão e o que falta liberar.";
export const Route = createFileRoute("/_authenticated/negocios")({
  head: () => ({
    meta: [
      { title: "Negócios (Pipe) e cards a liberar — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Negócios (Pipe) e cards a liberar — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Negocios,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar os negócios</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

type Aba = "lista" | "liberar" | "semnf" | "cliente";
const linkPipe = (id: string) => `https://predicta2.pipedrive.com/deal/${id}`;
const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };

function Negocios() {
  const { filtros } = useFiltros();
  const { dados: d } = useMetricas(filtros);
  const [aba, setAba] = useState<Aba>("lista");

  const v = useMemo(() => {
    const negs = M.negociosFiltrados(d, filtros);
    const nomes = new Map(d.clientes.map((c) => [c.id, c]));
    const porNeg = M.nfsPorNegocio(d);
    const cards = M.cardsLiberarFiltrados(d, filtros);
    const totalCards = cards.reduce((a, c) => a + c.valor, 0);
    const af22 = M.controleAF22(obterControles());
    const semFiltro =
      !filtros.bu &&
      !filtros.produto &&
      !filtros.plataforma &&
      !filtros.contrato &&
      !filtros.categoria &&
      !filtros.clientes.length;
    return {
      negs,
      nomes,
      porNeg,
      cards,
      totalCards,
      af22,
      semFiltro,
      kpi: M.kpisNegocios(d, filtros),
      semNF: M.negociosSemNF(d, filtros),
      serie: M.seriePipeAutorizado(d, filtros),
      porCat: M.agruparPor(
        negs,
        (n) => nomes.get(n.clienteId)?.categoria ?? "—",
        (n) => n.valor,
      ),
      porPlat: M.agruparPor(
        negs,
        (n) => `${n.plataforma || "—"} · ${n.contrato || "—"}`,
        (n) => n.valor,
      ).slice(0, 12),
      rankCli: M.agruparPor(
        cards,
        (c) => c.cliente,
        (c) => c.valor,
      ),
      rankProd: M.agruparPor(
        cards,
        (c) => c.produto,
        (c) => c.valor,
      ),
      porCliente: Object.values(
        negs.reduce<
          Record<string, { cliente: string; qtd: number; pipe: number; aut: number; nfs: number }>
        >((acc, n) => {
          const o = (acc[n.clienteId] ??= {
            cliente: n.clienteId,
            qtd: 0,
            pipe: 0,
            aut: 0,
            nfs: 0,
          });
          o.qtd++;
          o.pipe += n.valor;
          if (n.autorizada) o.aut += n.valor;
          o.nfs += porNeg.get(n.id)?.length ?? 0;
          return acc;
        }, {}),
      ),
    };
  }, [d, filtros]);

  if (!d.negocios.length)
    return (
      <EmptyState
        title="Nenhum negócio importado"
        description="Importe a planilha para ver o Pipe."
      />
    );

  const k = v.kpi;
  const difAF22 = v.af22 != null && v.semFiltro && Math.abs(v.totalCards - v.af22) > 0.01;

  const colunas: ColunaV2<Negocio>[] = [
    { key: "titulo", header: "Título", value: (r) => r.titulo },
    {
      key: "cliente",
      header: "Cliente",
      value: (r) => r.clienteId,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <LinkCliente id={r.clienteId} nome={r.clienteId} />
        </span>
      ),
    },
    {
      key: "categoria",
      header: "Categoria",
      value: (r) => v.nomes.get(r.clienteId)?.categoria ?? "—",
    },
    {
      key: "ganhoEm",
      header: "Ganho em",
      value: (r) => r.ganhoEm,
      render: (r) => (r.ganhoEm ? formatarData(r.ganhoEm) : "—"),
    },
    { key: "bu", header: "BU", value: (r) => r.bu, oculta: true },
    { key: "produto", header: "Produto", value: (r) => r.produto },
    { key: "plataforma", header: "Plataforma", value: (r) => r.plataforma, oculta: true },
    { key: "contrato", header: "Contrato", value: (r) => r.contrato },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      value: (r) => r.valor,
      render: (r) => formatarBRL(r.valor),
    },
    {
      key: "autorizada",
      header: "Autorizado",
      value: (r) => (r.autorizada ? "Sim" : "Não"),
      render: (r) => (
        <StatusPill tom={r.autorizada ? "success" : "neutral"}>
          {r.autorizada ? "Sim" : "Não"}
        </StatusPill>
      ),
    },
    {
      key: "nfs",
      header: "NF(s)",
      value: (r) => (v.porNeg.get(r.id) ?? []).map((n) => n.numero).join(", ") || "Não localizada",
      render: (r) => {
        const ns = v.porNeg.get(r.id) ?? [];
        return ns.length ? (
          ns.map((n) => n.numero).join(", ")
        ) : (
          <span className="text-muted-foreground">Não localizada</span>
        );
      },
    },
    {
      key: "pipe",
      header: "Pipedrive",
      value: (r) => r.id,
      render: (r) => (
        <a
          href={linkPipe(r.id)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {r.id} <ExternalLink className="size-3" />
        </a>
      ),
    },
  ];

  const expandir = (r: Negocio) => {
    const ns = v.porNeg.get(r.id) ?? [];
    if (!ns.length)
      return (
        <p className="text-body text-muted-foreground">
          Nenhuma NF vinculada (id_pipe nem coluna "NF:").
        </p>
      );
    return (
      <table className="text-body">
        <thead className="text-label text-muted-foreground">
          <tr>
            <th className="pr-6 text-left">NF</th>
            <th className="pr-6 text-left">Emissão</th>
            <th className="pr-6 text-left">Vencimento</th>
            <th className="pr-6 text-left">Pagamento</th>
            <th className="pr-6 text-left">Status</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {ns.map((n) => (
            <tr key={n.id}>
              <td className="pr-6">
                <button
                  className="text-primary hover:underline"
                  onClick={() => abrirDetalhe({ tipo: "nf", id: n.id })}
                >
                  {n.numero}
                </button>
              </td>
              <td className="pr-6">{formatarData(n.emissao)}</td>
              <td className="pr-6">{formatarData(n.vencimento)}</td>
              <td className="pr-6">{n.dataPagamento ? formatarData(n.dataPagamento) : "—"}</td>
              <td className="pr-6">{n.status}</td>
              <td className="text-right tabular-nums">{formatarBRL(n.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline font-medium text-foreground">Negócios (Pipe)</h1>
        <p className="text-body text-muted-foreground">{META}</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Pipe ganho no período" value={formatarBRLCompacto(k.pipe)} />
        <KpiCard label="Pipe autorizado" value={formatarBRLCompacto(k.autorizado)} />
        <KpiCard label="A liberar (Pipe − autorizado)" value={formatarBRLCompacto(k.aLiberar)} />
        <KpiCard label="Nº de cards" value={k.cards.toLocaleString("pt-BR")} />
        <KpiCard label="Ticket médio" value={formatarBRLCompacto(k.ticketMedio)} />
        <KpiCard label="% autorizado" value={formatarPercentual(k.pctAutorizado)} />
      </div>

      <div
        role="alert"
        className="flex items-start gap-3 rounded-[var(--radius-card)] bg-warning/10 p-4 text-body"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            "Total p/ Card" × soma calculada <SeloValidacao className="ml-2" />
          </p>
          <p className="text-muted-foreground">
            A coluna "Total p/ Card" da planilha é conferida contra a soma dos negócios na
            importação; divergências aparecem como aviso na tela de Importação. A regra de rateio
            ainda não foi confirmada.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Pipe por mês" subtitle="Barras = Pipe · linha = autorizado (Parte 2)">
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={v.serie}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="mes" tickFormatter={(m) => formatarMes(`${m}-01`)} tick={eixo} />
                <YAxis tickFormatter={formatarBRLCompacto} tick={eixo} width={64} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="pipe" name="Pipe" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="autorizado"
                  name="Autorizado"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard
          title="Pipe por categoria e plataforma/contrato"
          subtitle="Terceiro × Anunciante (critério necessita validação)"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {v.porCat.map((c) => (
              <span
                key={c.chave}
                className="rounded-full bg-surface-container px-3 py-1 text-label"
              >
                {c.chave}: <b>{formatarBRLCompacto(c.valor)}</b>
              </span>
            ))}
          </div>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={v.porPlat} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" tickFormatter={formatarBRLCompacto} tick={eixo} />
                <YAxis type="category" dataKey="chave" width={150} tick={eixo} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="valor"
                  name="Pipe"
                  fill="var(--color-chart-3)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <AnimatedTabs
        value={aba}
        onChange={setAba}
        tabs={[
          { value: "lista", label: "Lista" },
          { value: "liberar", label: "A liberar" },
          { value: "semnf", label: `Sem NF (${v.semNF.length})` },
          { value: "cliente", label: "Por cliente" },
        ]}
      />

      {aba === "lista" && (
        <DataTableV2
          rows={v.negs}
          columns={colunas}
          rowKey={(r) => r.id}
          expand={expandir}
          onRowClick={(r) => abrirDetalhe({ tipo: "negocio", id: r.id })}
        />
      )}

      {aba === "liberar" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-label text-muted-foreground">
                Total A liberar (Parte 2, "Cards a Liberar")
              </p>
              <p className="text-display-sm font-medium text-foreground">
                {formatarBRL(v.totalCards)}
              </p>
              {v.af22 != null && (
                <p className="text-label text-muted-foreground">
                  AF22 da planilha: {formatarBRL(v.af22)}
                  {!v.semFiltro && " (comparação só sem filtros)"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              disabled={!v.cards.length}
              onClick={() =>
                baixarCSV(
                  "cards-a-liberar.csv",
                  ["Cliente", "Produto", "Plataforma", "Contrato", "Categoria", "Valor"],
                  [...v.cards]
                    .sort((a, b) => b.valor - a.valor)
                    .map((c) => [
                      c.cliente,
                      c.produto,
                      c.plataforma,
                      c.contrato,
                      c.categoria ?? "",
                      c.valor,
                    ]),
                )
              }
            >
              <Download className="size-4" /> Exportar lista para o comercial (CSV)
            </Button>
          </div>
          {difAF22 && (
            <div
              role="alert"
              className="rounded-[var(--radius-card)] bg-danger/10 p-4 text-body text-foreground"
            >
              Diferença entre o total da tela e AF22: {formatarBRL(v.totalCards - (v.af22 ?? 0))}.
              Confira a tela de Qualidade.
            </div>
          )}
          {v.af22 == null && (
            <p className="text-label text-muted-foreground">
              Controle AF22 não encontrado na importação — não foi possível conferir o total.{" "}
              <SeloValidacao />
            </p>
          )}
          {!v.cards.length ? (
            <EmptyState
              title="Nada a liberar"
              description="Nenhum card pendente com os filtros atuais."
            />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Ranking titulo="Ranking por cliente" itens={v.rankCli} total={v.totalCards} />
                <Ranking titulo="Ranking por produto" itens={v.rankProd} total={v.totalCards} />
              </div>
              <DataTableV2
                rows={v.cards}
                rowKey={(c) =>
                  `${c.cliente}|${c.produto}|${c.plataforma}|${c.contrato}|${c.categoria}`
                }
                columns={[
                  { key: "cliente", header: "Cliente", value: (c) => c.cliente },
                  { key: "produto", header: "Produto", value: (c) => c.produto },
                  {
                    key: "plataforma",
                    header: "Plataforma",
                    value: (c) => c.plataforma,
                    oculta: true,
                  },
                  { key: "contrato", header: "Contrato", value: (c) => c.contrato, oculta: true },
                  { key: "categoria", header: "Categoria", value: (c) => c.categoria ?? "—" },
                  {
                    key: "valor",
                    header: "A liberar",
                    align: "right",
                    value: (c) => c.valor,
                    render: (c) => (
                      <span
                        className={
                          c.valor >= (v.rankCli[0]?.valor ?? 0) * 0.5
                            ? "font-semibold text-danger"
                            : ""
                        }
                      >
                        {formatarBRL(c.valor)}
                      </span>
                    ),
                  },
                ]}
              />
            </>
          )}
        </div>
      )}

      {aba === "semnf" && (
        <div className="space-y-3">
          <p className="text-body text-muted-foreground">
            Negócios autorizados sem nenhuma NF — possível atraso de faturamento. Idade desde "ganho
            em" até a data de posição: verde &lt; {M.SEMAFORO_SEM_NF.verde} dias, amarelo &lt;{" "}
            {M.SEMAFORO_SEM_NF.amarelo}, vermelho acima. <SeloValidacao />
          </p>
          <DataTableV2
            rows={v.semNF}
            rowKey={(r) => r.negocio.id}
            onRowClick={(r) => abrirDetalhe({ tipo: "negocio", id: r.negocio.id })}
            vazio="Todos os negócios autorizados têm NF."
            columns={[
              {
                key: "idade",
                header: "Idade",
                value: (r) => r.dias,
                render: (r) => <StatusPill tom={r.tom}>{r.dias} dias</StatusPill>,
              },
              { key: "titulo", header: "Título", value: (r) => r.negocio.titulo },
              { key: "cliente", header: "Cliente", value: (r) => r.negocio.clienteId },
              {
                key: "ganho",
                header: "Ganho em",
                value: (r) => r.negocio.ganhoEm,
                render: (r) => (r.negocio.ganhoEm ? formatarData(r.negocio.ganhoEm) : "—"),
              },
              { key: "produto", header: "Produto", value: (r) => r.negocio.produto },
              {
                key: "valor",
                header: "Valor",
                align: "right",
                value: (r) => r.negocio.valor,
                render: (r) => formatarBRL(r.negocio.valor),
              },
              {
                key: "pipe",
                header: "Pipedrive",
                value: (r) => r.negocio.id,
                render: (r) => (
                  <a
                    href={linkPipe(r.negocio.id)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline"
                  >
                    Abrir ↗
                  </a>
                ),
              },
            ]}
          />
        </div>
      )}

      {aba === "cliente" && (
        <DataTableV2
          rows={v.porCliente}
          rowKey={(r) => r.cliente}
          onRowClick={(r) => abrirDetalhe({ tipo: "cliente", id: r.cliente })}
          columns={[
            { key: "cliente", header: "Cliente", value: (r) => r.cliente },
            { key: "qtd", header: "Cards", align: "right", value: (r) => r.qtd },
            {
              key: "pipe",
              header: "Pipe",
              align: "right",
              value: (r) => r.pipe,
              render: (r) => formatarBRL(r.pipe),
            },
            {
              key: "aut",
              header: "Autorizado",
              align: "right",
              value: (r) => r.aut,
              render: (r) => formatarBRL(r.aut),
            },
            {
              key: "lib",
              header: "A liberar",
              align: "right",
              value: (r) => r.pipe - r.aut,
              render: (r) => formatarBRL(r.pipe - r.aut),
            },
            {
              key: "pct",
              header: "% autorizado",
              align: "right",
              value: (r) => (r.pipe ? r.aut / r.pipe : 0),
              render: (r) => formatarPercentual(r.pipe ? r.aut / r.pipe : 0),
            },
            { key: "nfs", header: "NFs", align: "right", value: (r) => r.nfs },
          ]}
        />
      )}
    </div>
  );
}

function Ranking({ titulo, itens, total }: { titulo: string; itens: M.Item[]; total: number }) {
  const max = itens[0]?.valor || 1;
  return (
    <SectionCard title={titulo} subtitle="Maiores pendências em destaque">
      <ol className="space-y-2">
        {itens.slice(0, 8).map((x, i) => (
          <li key={x.chave} className="space-y-1">
            <div className="flex justify-between gap-2 text-body">
              <span className={i < 3 ? "font-semibold text-foreground" : "text-foreground"}>
                {i + 1}. {x.chave}
              </span>
              <span className="tabular-nums">
                {formatarBRL(x.valor)}{" "}
                <span className="text-muted-foreground">
                  ({formatarPercentual(total ? x.valor / total : 0)})
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container">
              <div
                className={
                  i < 3 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-primary"
                }
                style={{ width: `${Math.max(2, (x.valor / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
