import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet, Printer, Save, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import * as M from "@/data/metricas";
import {
  listarVisoesSalvas,
  obterNotaConfianca,
  removerVisaoRelatorio,
  salvarVisaoRelatorio,
  type VisaoSalva,
} from "@/data/repository";
import { useDados, useFiltros } from "@/hooks/use-dados";
import {
  SectionCard,
  SegmentedControl,
  SeloValidacao,
  ChartTooltip,
  EmptyState,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatarBRLCompacto, formatarData, formatarMes } from "@/lib/format";
import { REGIMES } from "@/lib/filtros";
import { exportarCSV, exportarXLSX, formatarCelula, imprimir, type Contexto } from "@/lib/exportar";

const META =
  "Relatórios por BU, produto, plataforma, cliente e período, com modelos prontos, visões salvas e exportação.";
export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Controladoria" },
      { name: "description", content: META },
      { property: "og:title", content: "Relatórios — Controladoria" },
      { property: "og:description", content: META },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Relatorios,
  errorComponent: Erro,
});

function Erro({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="surface-card space-y-3 p-6">
      <p className="text-title font-medium text-danger">Não foi possível carregar Relatórios</p>
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <Button onClick={() => router.invalidate()}>Tentar novamente</Button>
    </div>
  );
}

type Fonte = "construtor" | M.ModeloRelatorio;
type DimAging = "bu" | "categoria" | "cliente";
const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const CONFIG_PADRAO: M.ConfigRelatorio = {
  dimensao: "bu",
  metricas: ["pipe", "faturado_regime", "recebimento", "margem"],
  regimeFaturado: "fat_competencia",
};

function Relatorios() {
  const d = useDados();
  const { filtros, bruto, definir } = useFiltros();
  const [fonte, setFonte] = useState<Fonte>("construtor");
  const [cfg, setCfg] = useState<M.ConfigRelatorio>(CONFIG_PADRAO);
  const [dimAging, setDimAging] = useState<DimAging>("bu");
  const [visoes, setVisoes] = useState<VisaoSalva[]>([]);
  const [local, setLocal] = useState(false);
  const [nome, setNome] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);
  const [geradoEm, setGeradoEm] = useState("");
  useEffect(() => setGeradoEm(new Date().toLocaleString("pt-BR")), [fonte, cfg, filtros]);

  const recarregar = () =>
    listarVisoesSalvas().then((r) => {
      setVisoes(r.visoes);
      setLocal(r.local);
    });
  useEffect(() => {
    recarregar();
  }, []);

  const modelo = M.MODELOS_RELATORIO.find((m) => m.value === fonte);
  const tabela = useMemo<M.TabelaRelatorio>(() => {
    if (fonte === "aging") return M.relatorioAging(d, filtros, dimAging);
    if (fonte === "cards") return M.relatorioCards(d, filtros);
    const c =
      fonte === "construtor" ? cfg : { ...modelo!.config!, regimeFaturado: cfg.regimeFaturado };
    const t = M.relatorioDinamico(d, filtros, c);
    return { ...t, titulo: fonte === "construtor" ? t.titulo : modelo!.label };
  }, [d, filtros, fonte, cfg, dimAging, modelo]);

  const nota = obterNotaConfianca();
  const filtrosTexto = useMemo(() => {
    const xs: string[] = [`Regime: ${REGIMES.find((r) => r.value === filtros.regime)?.label}`];
    if (filtros.bu) xs.push(`BU: ${filtros.bu}`);
    if (filtros.produto) xs.push(`Produto: ${filtros.produto}`);
    if (filtros.plataforma) xs.push(`Plataforma: ${filtros.plataforma}`);
    if (filtros.contrato) xs.push(`Contrato: ${filtros.contrato}`);
    if (filtros.categoria) xs.push(`Categoria: ${filtros.categoria}`);
    if (filtros.clientes.length) xs.push(`Clientes: ${filtros.clientes.join(", ")}`);
    if (fonte !== "aging" && fonte !== "cards")
      xs.push(`Faturado por ${cfg.regimeFaturado === "fat_emissao" ? "emissão" : "competência"}`);
    if (fonte === "aging") xs.push(`Agrupado por ${dimAging}`);
    return xs;
  }, [filtros, fonte, cfg.regimeFaturado, dimAging]);
  const ctx: Contexto = {
    filtros: filtrosTexto,
    geradoEm,
    periodo: `${formatarMes(`${filtros.de}-01`)} a ${formatarMes(`${filtros.ate}-01`)}`,
    dataReferencia: formatarData(filtros.dataReferencia),
  };

  const colGrafico = tabela.colunas.find((c) => c.tipo === "brl");
  const dadosGrafico = colGrafico
    ? tabela.linhas.slice(0, 20).map((l) => ({
        nome: String(l[tabela.colunas[0]!.chave]),
        valor: Number(l[colGrafico.chave] ?? 0),
      }))
    : [];

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Dê um nome à visão.");
      return;
    }
    await salvarVisaoRelatorio({
      nome: nome.trim(),
      filtros: bruto,
      configuracao: { fonte, cfg, dimAging },
      compartilhada: compartilhar,
    });
    setNome("");
    toast.success("Visão salva.");
    recarregar();
  }
  function aplicar(v: VisaoSalva) {
    const c = v.configuracao as { fonte?: Fonte; cfg?: M.ConfigRelatorio; dimAging?: DimAging };
    if (c.fonte) setFonte(c.fonte);
    if (c.cfg) setCfg(c.cfg);
    if (c.dimAging) setDimAging(c.dimAging);
    definir(v.filtros as never);
    toast.success(`Visão "${v.nome}" aplicada.`);
  }
  const alternarMetrica = (m: M.MetricaRelatorio) =>
    setCfg((c) => ({
      ...c,
      metricas: c.metricas.includes(m) ? c.metricas.filter((x) => x !== m) : [...c.metricas, m],
    }));

  return (
    <main className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-headline font-normal text-foreground">Relatórios</h1>
          <p className="text-body text-muted-foreground">
            Monte, salve e exporte. Os filtros da barra superior valem para todos os relatórios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportarCSV(tabela, ctx)}
            disabled={!tabela.linhas.length}
          >
            <Download /> CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportarXLSX(tabela, ctx)}
            disabled={!tabela.linhas.length}
          >
            <FileSpreadsheet /> Excel
          </Button>
          <Button onClick={() => imprimir(tabela.titulo)} disabled={!tabela.linhas.length}>
            <Printer /> PDF / imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr] print:block">
        <aside className="space-y-4 print:hidden">
          <SectionCard title="Modelos" menu={false}>
            <div className="flex flex-col gap-1">
              {[
                {
                  value: "construtor" as Fonte,
                  label: "Construtor livre",
                  descricao: "Escolha dimensão e métricas.",
                },
                ...M.MODELOS_RELATORIO,
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setFonte(m.value)}
                  className={`rounded-lg px-3 py-2 text-left transition-colors ${fonte === m.value ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"}`}
                >
                  <span className="block text-body font-medium">{m.label}</span>
                  <span className="block text-label text-muted-foreground">{m.descricao}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Visões salvas"
            {...(local ? { subtitle: "Salvas neste navegador até a tabela ser criada." } : {})}
            menu={false}
          >
            <div className="space-y-2">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da visão"
              />
              <label className="flex items-center gap-2 text-body">
                <Switch checked={compartilhar} onCheckedChange={setCompartilhar} /> Compartilhar com
                todos
              </label>
              <Button size="sm" className="w-full" onClick={salvar}>
                <Save /> Salvar visão atual
              </Button>
              <ul className="space-y-1 pt-2">
                {visoes.length === 0 && (
                  <li className="text-label text-muted-foreground">Nenhuma visão salva.</li>
                )}
                {visoes.map((v) => (
                  <li key={v.id} className="flex items-center gap-1">
                    <button
                      onClick={() => aplicar(v)}
                      className="flex-1 truncate rounded px-2 py-1 text-left text-body hover:bg-muted"
                    >
                      {v.compartilhada && (
                        <Share2 className="mr-1 inline size-3 text-muted-foreground" />
                      )}
                      {v.nome}
                    </button>
                    {v.minha && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover visão"
                        onClick={() => removerVisaoRelatorio(v.id).then(recarregar)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>
        </aside>

        <div className="space-y-4">
          <div className="space-y-3 surface-card p-4 print:hidden">
            {fonte === "aging" ? (
              <SegmentedControl<DimAging>
                ariaLabel="Agrupar por"
                value={dimAging}
                onChange={setDimAging}
                options={[
                  { value: "bu", label: "BU" },
                  { value: "categoria", label: "Categoria" },
                  { value: "cliente", label: "Cliente" },
                ]}
              />
            ) : fonte === "cards" ? (
              <p className="text-body text-muted-foreground">
                Usa os filtros de produto, plataforma, contrato, categoria e clientes.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {fonte === "construtor" && (
                    <label className="flex items-center gap-2 text-body">
                      Dimensão
                      <select
                        className="rounded-md border bg-background px-2 py-1"
                        value={cfg.dimensao}
                        onChange={(e) =>
                          setCfg({ ...cfg, dimensao: e.target.value as M.DimRelatorio })
                        }
                      >
                        {M.DIMENSOES_RELATORIO.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <span className="text-body">Faturado por</span>
                  <SegmentedControl<M.ConfigRelatorio["regimeFaturado"]>
                    ariaLabel="Regime do faturado"
                    value={cfg.regimeFaturado}
                    onChange={(r) => setCfg({ ...cfg, regimeFaturado: r })}
                    options={[
                      { value: "fat_competencia", label: "Competência" },
                      { value: "fat_emissao", label: "Emissão" },
                    ]}
                  />
                </div>
                {fonte === "construtor" && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {M.METRICAS_RELATORIO.map((x) => (
                      <label key={x.value} className="flex items-center gap-1.5 text-body">
                        <Checkbox
                          checked={cfg.metricas.includes(x.value)}
                          onCheckedChange={() => alternarMetrica(x.value)}
                        />
                        {x.label}
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <section id="area-impressao" className="surface-card space-y-4 p-5">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  C
                </div>
                <div>
                  <h2 className="text-title font-medium">{tabela.titulo}</h2>
                  <p className="text-label text-muted-foreground">
                    Controladoria · {ctx.periodo} · posição em {ctx.dataReferencia}
                  </p>
                </div>
              </div>
              <div className="text-right text-label text-muted-foreground">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 font-medium ${nota.erros === 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
                >
                  Confiança {nota.ok}/{nota.total}
                </span>
                <p className="mt-1">Gerado em {geradoEm}</p>
              </div>
            </header>
            <p className="text-label text-muted-foreground">Filtros: {filtrosTexto.join(" · ")}</p>

            {!tabela.linhas.length ? (
              <EmptyState
                title="Sem resultados"
                description={
                  fonte === "construtor" && !cfg.metricas.length
                    ? "Escolha ao menos uma métrica."
                    : "Ajuste ou limpe os filtros."
                }
              />
            ) : (
              <>
                {dadosGrafico.length > 1 && colGrafico && (
                  <div className="h-56 print:hidden">
                    <ResponsiveContainer>
                      <BarChart data={dadosGrafico}>
                        <CartesianGrid vertical={false} stroke="var(--color-border)" />
                        <XAxis
                          dataKey="nome"
                          tick={eixo}
                          tickFormatter={(v: string) =>
                            /^\d{4}-\d{2}$/.test(v) ? formatarMes(`${v}-01`) : v.slice(0, 14)
                          }
                        />
                        <YAxis
                          tick={eixo}
                          tickFormatter={(v: number) => formatarBRLCompacto(v)}
                          width={70}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="valor"
                          name={colGrafico.rotulo}
                          fill="var(--color-chart-1)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-body">
                    <thead>
                      <tr className="border-b text-left text-label text-muted-foreground">
                        {tabela.colunas.map((c) => (
                          <th
                            key={c.chave}
                            className={`px-2 py-2 font-medium ${c.tipo === "texto" ? "" : "text-right"}`}
                          >
                            {c.rotulo}{" "}
                            {c.validar && <SeloValidacao className="ml-1 print:hidden" />}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.linhas.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {tabela.colunas.map((c) => (
                            <td
                              key={c.chave}
                              className={`px-2 py-1.5 ${c.tipo === "texto" ? "" : "num text-right"}`}
                            >
                              {formatarCelula(l[c.chave], c.tipo)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {tabela.total && (
                      <tfoot>
                        <tr className="border-t-2 font-medium">
                          {tabela.colunas.map((c) => (
                            <td
                              key={c.chave}
                              className={`px-2 py-2 ${c.tipo === "texto" ? "" : "num text-right"}`}
                            >
                              {formatarCelula(tabela.total![c.chave], c.tipo)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
            <ul className="space-y-0.5 text-label text-muted-foreground">
              {tabela.notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
