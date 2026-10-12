import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { PageHeader } from "@/components/base";
import {
  SectionCard,
  StatusPill,
  SeloValidacao,
  SegmentedControl,
  type StatusTom,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { abrirDetalhe } from "@/components/detail-drawer";
import {
  obterChecagens,
  obterNotaConfianca,
  obterImportacoes,
  obterAvisosUltimaImportacao,
} from "@/data/repository";
import { classificarAvisos, ROTULO_CLASSE, type ClasseAviso, type GrupoClassificado } from "@/lib/conciliacao";
import { compararCargas, divergenciasCSV, type Checagem, type Severidade } from "@/lib/qualidade";
import { formatarBRL, formatarData } from "@/lib/format";
import { pageMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/qualidade")({
  head: () =>
    pageMeta(
      "Qualidade dos dados",
      "Conferência cruzada entre o detalhe e o consolidado da planilha.",
    ),
  component: Qualidade,
});

const tom: Record<Severidade, StatusTom> = { ok: "success", aviso: "warning", erro: "danger" };
const rotulo: Record<Severidade, string> = { ok: "OK", aviso: "Aviso", erro: "Erro" };
type Filtro = "todas" | Severidade;

function baixarCSV(cs: Checagem[]) {
  const blob = new Blob(["\uFEFF" + divergenciasCSV(cs)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "divergencias.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

const fmt = (c: Checagem, v: number) =>
  c.grupo === "Pendências de dados" || c.id === "totais_clientes" ? String(v) : formatarBRL(v);

function Item({ c }: { c: Checagem }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        className="flex w-full flex-wrap items-center gap-3 px-2 py-3 text-left hover:bg-muted/50"
      >
        <StatusPill tom={c.informativo ? "info" : tom[c.severidade]}>
          {c.informativo ? "Informativo" : rotulo[c.severidade]}
        </StatusPill>
        <span className="min-w-0 flex-1 font-medium text-foreground">
          {c.titulo} {c.validar && <SeloValidacao className="ml-2" />}
        </span>
        <span className="text-sm text-muted-foreground">
          Esperado {fmt(c, c.esperado)} · Encontrado {fmt(c, c.encontrado)} ·{" "}
          <span className={cn(c.diferenca !== 0 && "font-medium text-foreground")}>
            Dif. {fmt(c, c.diferenca)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>
      {aberto && (
        <div className="space-y-2 px-2 pb-4">
          {c.nota && <p className="text-sm text-muted-foreground">{c.nota}</p>}
          {c.detalhes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma linha divergente.</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Encontrado</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.detalhes.slice(0, 500).map((d) => (
                    <TableRow key={d.chave}>
                      <TableCell>{d.descricao}</TableCell>
                      <TableCell className="text-right">
                        {d.esperado == null ? "—" : fmt(c, d.esperado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.encontrado == null ? "—" : formatarBRL(d.encontrado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.diferenca == null ? "—" : fmt(c, d.diferenca)}
                      </TableCell>
                      <TableCell>
                        {d.ref ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => abrirDetalhe(d.ref!)}
                          >
                            Abrir {d.ref.tipo === "nf" ? "NF" : d.ref.tipo}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {c.detalhes.length > 500 && (
                <p className="p-2 text-xs text-muted-foreground">
                  Mostrando 500 de {c.detalhes.length}. Exporte o CSV para ver todas.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const tomClasse: Record<ClasseAviso, StatusTom> = {
  app: "danger",
  planilha: "warning",
  esperado: "info",
};

function GrupoAviso({ g }: { g: GrupoClassificado }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        className="flex w-full flex-wrap items-center gap-3 px-2 py-3 text-left hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 font-medium text-foreground">{g.titulo.replace(/^Parte2 · /, "Parte2 · ")}</span>
        <span className="text-sm text-muted-foreground">
          Impacto {g.impacto == null ? "—" : formatarBRL(g.impacto)} · decide: {g.quemDecide}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      <p className="px-2 pb-2 text-sm text-muted-foreground">O que significa: {g.significado}</p>
      {aberto && (
        <ul className="mx-2 mb-4 max-h-72 list-disc space-y-1 overflow-auto rounded-md border p-3 pl-7 text-sm">
          {g.itens.map((i, k) => (
            <li key={k}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AvisosImportacao() {
  const q = useQuery({ queryKey: ["avisos-importacao"], queryFn: obterAvisosUltimaImportacao });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando avisos…</p>;
  if (q.error) return <p className="text-sm text-destructive">Não foi possível ler os avisos.</p>;
  const gs = classificarAvisos(q.data ?? []);
  if (!gs.length) return <p className="text-sm text-muted-foreground">Nenhum aviso na última importação.</p>;
  return (
    <div className="space-y-4">
      {(["app", "planilha", "esperado"] as ClasseAviso[]).map((c) => {
        const xs = gs.filter((g) => g.classe === c);
        if (!xs.length) return null;
        return (
          <SectionCard
            key={c}
            title={`${ROTULO_CLASSE[c]} (${xs.length})`}
            menu={false}
          >
            <div className="px-2 pb-2">
              <StatusPill tom={tomClasse[c]}>{ROTULO_CLASSE[c]}</StatusPill>
            </div>
            {xs.map((g) => (
              <GrupoAviso key={g.titulo} g={g} />
            ))}
          </SectionCard>
        );
      })}
    </div>
  );
}

function Historico() {
  const q = useQuery({ queryKey: ["importacoes"], queryFn: obterImportacoes });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (q.error) return <p className="text-sm text-destructive">Não foi possível ler o histórico.</p>;
  const xs = q.data ?? [];
  if (!xs.length)
    return <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>;
  const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead className="text-right">Total faturado</TableHead>
            <TableHead className="text-right">Avisos</TableHead>
            <TableHead>Esta carga × anterior</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {xs.map((x, i) => {
            const d = compararCargas(x, xs[i + 1]);
            return (
              <TableRow key={x.id}>
                <TableCell>{formatarData(x.criadoEm)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {x.usuarioId?.slice(0, 8) ?? "—"}
                </TableCell>
                <TableCell>{x.arquivo}</TableCell>
                <TableCell className="text-right">{formatarBRL(x.totalFaturado)}</TableCell>
                <TableCell className="text-right">{x.avisos}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d
                    ? `Negócios ${sinal(d.negocios)} · NFs ${sinal(d.nfs)} · Fatos ${sinal(d.fatos)} · Faturado ${formatarBRL(d.totalFaturado)}`
                    : "Primeira carga"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="p-2 text-xs text-muted-foreground">
        Novos/removidos são estimados pela diferença de contagens; "alterados" registro a registro
        exige guardar a carga anterior. <SeloValidacao className="ml-1" />
      </p>
    </div>
  );
}

function Qualidade() {
  const cs = obterChecagens();
  const nota = obterNotaConfianca();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const vis = cs.filter((c) => filtro === "todas" || c.severidade === filtro);
  const grupos = [...new Set(vis.map((c) => c.grupo))];
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        title="Qualidade dos dados"
        description="Posso confiar nos números? Detalhe (Parte1) × consolidado (Parte2). Nada é corrigido automaticamente."
        actions={
          <Button variant="outline" onClick={() => baixarCSV(cs)}>
            <Download /> Exportar divergências (CSV)
          </Button>
        }
      />
      <section className="surface-card flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Nota de confiança</p>
          <p className="text-display font-normal text-foreground">
            {nota.ok}/{nota.total}
          </p>
          <p className="text-sm text-muted-foreground">checagens OK</p>
        </div>
        <div className="flex gap-2">
          <StatusPill tom="danger">{nota.erros} erros</StatusPill>
          <StatusPill tom="warning">{nota.avisos} avisos</StatusPill>
        </div>
      </section>
      <Tabs defaultValue="checagens">
        <TabsList>
          <TabsTrigger value="checagens">Checagens</TabsTrigger>
          <TabsTrigger value="avisos">Avisos da importação</TabsTrigger>
          <TabsTrigger value="historico">Histórico de importações</TabsTrigger>
        </TabsList>
        <TabsContent value="checagens" className="space-y-4">
          <SegmentedControl<Filtro>
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "todas", label: "Todas" },
              { value: "erro", label: "Erros" },
              { value: "aviso", label: "Avisos" },
              { value: "ok", label: "OK" },
            ]}
          />
          {grupos.map((g) => (
            <SectionCard key={g} title={g} menu={false}>
              {vis
                .filter((c) => c.grupo === g)
                .map((c) => (
                  <Item key={c.id} c={c} />
                ))}
            </SectionCard>
          ))}
          {!vis.length && (
            <p className="text-sm text-muted-foreground">Nenhuma checagem com esse status.</p>
          )}
        </TabsContent>
        <TabsContent value="avisos">
          <AvisosImportacao />
        </TabsContent>
        <TabsContent value="historico">
          <Historico />
        </TabsContent>
      </Tabs>
    </main>
  );
}
