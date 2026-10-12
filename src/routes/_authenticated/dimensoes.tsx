import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import * as M from "@/data/metricas";
import { obterControles } from "@/data/repository";
import { useDados, useFiltros } from "@/hooks/use-dados";
import { SectionCard, SegmentedControl, StatusPill, SeloValidacao } from "@/components/ui-kit";
import { DataTableV2, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { Button } from "@/components/ui/button";
import { formatarBRL, formatarBRLCompacto, formatarPercentual } from "@/lib/format";

const META =
  "Produtos e plataformas: comparação por BU, plataforma, contrato e item de cobrança, com a cadeia do dinheiro e Terceiro × Anunciante.";
export const Route = createFileRoute("/_authenticated/dimensoes")({
  head: () => ({
    meta: [
      { title: "Produtos e plataformas — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Produtos e plataformas — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Produtos,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">
        Não foi possível carregar Produtos e plataformas
      </p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

const DIMS: { value: M.DimProduto; label: string }[] = [
  { value: "bu", label: "BU" },
  { value: "plataforma", label: "Plataforma" },
  { value: "contrato", label: "Contrato" },
  { value: "produto", label: "Produto" },
  { value: "itemCobranca", label: "Item de cobrança" },
];
const ETAPAS = [
  { k: "pipe", nome: "Pipe", cor: "bg-chart-3" },
  { k: "faturado", nome: "Faturado", cor: "bg-chart-1" },
  { k: "recebido", nome: "Recebido", cor: "bg-chart-2" },
  { k: "custo", nome: "Custo", cor: "bg-chart-5" },
  { k: "margem", nome: "Margem", cor: "bg-chart-4" },
] as const;
const brl = (v: number) => <span className="num">{formatarBRL(v)}</span>;

function MiniCadeia({ l }: { l: M.LinhaProduto }) {
  const max = Math.max(l.pipe, l.faturado, l.recebido, l.custo, Math.abs(l.margem), 1);
  return (
    <div className="flex h-8 w-40 items-end gap-1" aria-label="Cadeia do dinheiro">
      {ETAPAS.map((e) => (
        <div
          key={e.k}
          title={`${e.nome}: ${formatarBRL(l[e.k])}`}
          className={`${e.cor} w-full rounded-sm ${l[e.k] < 0 ? "opacity-40" : ""}`}
          style={{ height: `${Math.max(4, (Math.abs(l[e.k]) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Produtos() {
  const d = useDados();
  const { filtros } = useFiltros();
  const [dim, setDim] = useState<M.DimProduto>("plataforma");
  const linhas = M.produtosPor(d, filtros, dim);
  const cats = M.terceiroXAnunciante(d, filtros);
  const secoes = M.totaisClientesSecao(obterControles());
  const comResumo = dim === "bu" || dim === "produto";
  const divergentes = comResumo
    ? linhas.filter((l) => Math.abs(l.faturado - (l.faturadoResumo ?? 0)) > 1).length
    : 0;

  const colunas: ColunaV2<M.LinhaProduto>[] = [
    { key: "chave", header: DIMS.find((x) => x.value === dim)!.label, value: (l) => l.chave },
    {
      key: "cad",
      header: "Pipe → Margem",
      value: (l) => l.faturado,
      render: (l) => <MiniCadeia l={l} />,
    },
    {
      key: "pipe",
      header: "Pipe",
      align: "right",
      value: (l) => l.pipe,
      render: (l) => brl(l.pipe),
    },
    {
      key: "fat",
      header: "Faturado",
      align: "right",
      value: (l) => l.faturado,
      render: (l) => brl(l.faturado),
    },
    {
      key: "rec",
      header: "Recebido",
      align: "right",
      value: (l) => l.recebido,
      render: (l) => brl(l.recebido),
    },
    {
      key: "cus",
      header: "Custo",
      align: "right",
      value: (l) => l.custo,
      render: (l) => brl(l.custo),
    },
    {
      key: "mg",
      header: "Margem",
      align: "right",
      value: (l) => l.margem,
      render: (l) => (
        <span className={l.margem < 0 ? "num text-danger" : "num"}>{formatarBRL(l.margem)}</span>
      ),
    },
    { key: "ncl", header: "Clientes", align: "right", value: (l) => l.nClientes },
    ...(comResumo
      ? [
          {
            key: "conf",
            header: "Soma clientes × total",
            value: (l: M.LinhaProduto) => l.faturado - (l.faturadoResumo ?? 0),
            render: (l: M.LinhaProduto) => {
              const dif = l.faturado - (l.faturadoResumo ?? 0);
              return Math.abs(dif) <= 1 ? (
                <StatusPill tom="success">Bate</StatusPill>
              ) : (
                <StatusPill tom="danger">Dif. {formatarBRL(dif)}</StatusPill>
              );
            },
          } satisfies ColunaV2<M.LinhaProduto>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline font-medium text-foreground">Produtos e plataformas</h1>
        <p className="text-body text-muted-foreground">
          Cadeia do dinheiro por produto, somando as linhas de cliente da Parte 2.
        </p>
      </header>

      <SectionCard
        title="Comparação"
        subtitle="Cada barrinha: Pipe, Faturado, Recebido, Custo e Margem"
        action={
          <SegmentedControl value={dim} onChange={setDim} options={DIMS} ariaLabel="Dimensão" />
        }
        menu={false}
      >
        {comResumo && (
          <p className="mb-3 text-label text-muted-foreground">
            Conferência: soma dos clientes × resumo BU×Produto da Parte 2 —{" "}
            {divergentes ? (
              <span className="text-danger">{divergentes} divergência(s)</span>
            ) : (
              <span className="text-success">todos batem</span>
            )}
            .
          </p>
        )}
        <DataTableV2
          rows={linhas}
          columns={colunas}
          rowKey={(l) => l.chave}
          vazio="Sem valores com esses filtros."
        />
      </SectionCard>

      <SectionCard
        title="Terceiro × Anunciante"
        subtitle="Inadimplência = atrasado (NFs) ÷ faturado (Parte 2); concentração = participação dos 5 maiores"
        action={<SeloValidacao />}
        menu={false}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {cats.map((c) => (
            <div key={c.categoria} className="rounded-xl border p-4">
              <p className="text-title font-medium">
                {c.categoria === "—" ? "Sem categoria" : c.categoria}
              </p>
              <p className="text-label text-muted-foreground">{c.clientes} cliente(s)</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-body">
                <dt className="text-muted-foreground">Faturado</dt>
                <dd className="num text-right">{formatarBRLCompacto(c.faturado)}</dd>
                <dt className="text-muted-foreground">Margem</dt>
                <dd className="num text-right">
                  {formatarBRLCompacto(c.margem)} ({formatarPercentual(c.margemPct, 1)})
                </dd>
                <dt className="text-muted-foreground">Atrasado</dt>
                <dd className="num text-right text-danger">{formatarBRLCompacto(c.atrasado)}</dd>
                <dt className="text-muted-foreground">Inadimplência</dt>
                <dd className="num text-right">{formatarPercentual(c.inadimplencia, 1)}</dd>
                <dt className="text-muted-foreground">Top 5</dt>
                <dd className="num text-right">{formatarPercentual(c.top5, 0)}</dd>
              </dl>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={'Clientes por seção ("Totais: N Clientes")'}
        subtitle="Contagem lida da planilha, sem filtros"
        menu={false}
      >
        {secoes.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {secoes.map((s) => (
              <li
                key={s.secao}
                className="flex justify-between rounded-lg border px-3 py-2 text-body"
              >
                <span>{s.secao}</span>
                <span className="num">{s.clientes}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">
            Importe a planilha para ver as contagens.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
