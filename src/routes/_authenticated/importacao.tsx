import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { podeEscrever } from "@/data/repository";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { PageHeader } from "@/components/base";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { obterBrutos } from "@/data/repository";
import { useQueryClient } from "@tanstack/react-query";
import { lerPlanilha, comparar, type Leitura, type Contagem, type Etapa } from "@/lib/planilha";
import { Progress } from "@/components/ui/progress";
import { formatarBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({
    meta: [
      { title: "Importação — Controladoria" },
      { name: "description", content: "Carga da planilha de controladoria com pré-visualização." },
      { property: "og:title", content: "Importação — Controladoria" },
      {
        property: "og:description",
        content: "Carga da planilha de controladoria com pré-visualização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Fase 19: só admin/controladoria (o banco também recusa os demais).
  beforeLoad: ({ context }) => {
    if (!podeEscrever(context.perfil?.papel)) throw redirect({ to: "/dashboard" });
  },
  component: Importacao,
});

const mapeamento: [string, [string, string][]][] = [
  [
    "Negócios do Pipe (A–J)",
    [
      ["Título", "título / competência (sufixo)"],
      ["Ganho em", "ganho em"],
      ["Contrato", "contrato"],
      ["Plataforma", "plataforma"],
      ["Valor", "valor"],
      ["Cliente", "cliente"],
      ["Pipe", "ID do Pipe (chave)"],
      ["Autorizada emissão", "autorizada"],
    ],
  ],
  [
    "Notas fiscais (JC–KA + matriz KD)",
    [
      ["Cliente", "cliente"],
      ["Razão Social", "razão social (informativo)"],
      ["Nome do Card", "card / competência"],
      ["Pipe (link)", "ID do Pipe"],
      ["Nota Fiscal", "número (chave)"],
      ["Código", "código + regime"],
      ["Emissão / Vencimento / Pagamento", "datas"],
      ["Matriz KO–LB", "competência + valor"],
    ],
  ],
  [
    "Somente conferência",
    [
      ["KD, LD/MD, NE/OE, PE", "BU (LD/NE) e comparação de conjuntos"],
      ["Status, Total p/ Card", "recalculados (informativo)"],
    ],
  ],
  [
    "Parte2 — história financeira",
    [
      ["Linha 2 (títulos dos 13 blocos)", "bloco"],
      ["Linhas 4–18 (BU × Produto)", "fatos nível produto"],
      ["Seções plataforma × contrato", "fatos nível cliente + Cards a Liberar"],
      ["Totais, Á liberar, Check:", "controles (conferência)"],
    ],
  ],
];

const ETAPAS: [Etapa, string][] = [
  ["parte1", "Lendo Parte1…"],
  ["parte2", "Lendo Parte2…"],
  ["validando", "Validando…"],
  ["pronto", "Pronto"],
];
const NOME_BLOCO: Record<string, string> = {
  pipe: "Resumo Pipe",
  pipe_autorizado: "Pipe — emissão autorizada",
  fat_emissao: "Faturado por emissão (RPS)",
  fat_competencia: "Faturado por competência",
  dif_pipe_fat: "Diferença Pipe autorizado × faturado",
  a_liberar: "A liberar",
  recebimento: "Recebimento",
  vencimento: "Vencimento",
  dif_venc_receb: "Diferença vencimento × recebimento",
  custo_pagamento: "Custos por pagamento",
  dif_custo_receb: "Diferença faturado − custos − recebimentos",
  custo_emissao: "Custos por emissão",
  impostos: "Impostos",
  creditos: "Créditos",
};

type Previa = {
  arquivo: string;
  leitura: Leitura;
  nf: Contagem & { removidosLista: string[] };
  neg: Contagem & { removidosLista: string[] };
};

function Importacao() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<"inicio" | "lendo" | "previa" | "gravando" | "ok" | "erro">(
    "inicio",
  );
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [msg, setMsg] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("parte1");
  const [passo2, setPasso2] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  async function selecionar(file: File) {
    setEstado("lendo");
    setMsg("");
    try {
      const leitura = await lerPlanilha(await file.arrayBuffer(), setEtapa);
      const b = obterBrutos();
      const nf = comparar(
        leitura.notas as unknown as Record<string, unknown>[],
        b.notas,
        "numero_nf",
      );
      const neg = comparar(
        leitura.negocios as unknown as Record<string, unknown>[],
        b.negocios,
        "id_pipe",
      );
      nf.comErro = leitura.erros.filter((e) => e.modulo === "NF").length;
      neg.comErro = leitura.erros.filter((e) => e.modulo === "Negócio").length;
      setPrevia({ arquivo: file.name, leitura, nf, neg });
      setEstado("previa");
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m);
      setEstado("erro");
      toast.error("Não foi possível ler a planilha.", { description: m });
    }
  }

  async function confirmar() {
    if (!previa || confirmacao.trim() !== "SUBSTITUIR") return;
    setEstado("gravando");
    setPasso2(false);
    setConfirmacao("");
    const { negocios, notas, parte2, hash, avisos, erros } = previa.leitura;
    const { error } = await supabase.rpc("substituir_planilha_v2", {
      p_negocios: negocios,
      p_notas: notas,
      p_fatos: parte2.fatos,
      p_cards: parte2.cards,
      p_controles: parte2.controles,
      p_clientes: parte2.clientes,
      p_meta: {
        nome_arquivo: previa.arquivo,
        hash_sha256: hash,
        avisos,
        erros: [...erros, ...parte2.problemas],
      },
    } as never);
    if (error) {
      setMsg(`Nada foi gravado; os dados anteriores permanecem. Detalhe: ${error.message}`);
      setEstado("erro");
      toast.error("Importação falhou. Nada foi gravado.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["dados"] });
    await queryClient.invalidateQueries({ queryKey: ["avisos-importacao"] });
    await router.invalidate();
    setEstado("ok");
    toast.success("Planilha importada com sucesso.");
  }
  const cancelar = () => {
    setPrevia(null);
    setPasso2(false);
    setConfirmacao("");
    setEstado("inicio");
    setMsg("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importação"
        description="Planilha de controladoria — leitura no navegador, pré-visualização e substituição confirmada."
      />

      {(estado === "inicio" || estado === "erro") && (
        <div className="space-y-4">
          <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-6 py-16 text-center hover:bg-muted/40">
            <p className="font-medium">Selecione a planilha (.xlsx)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nada é gravado antes da sua confirmação
            </p>
            <input
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void selecionar(f);
                e.target.value = "";
              }}
            />
          </label>
          {estado === "erro" && (
            <p className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger">
              {msg}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {mapeamento.map(([bloco, cols]) => (
              <div key={bloco} className="rounded-md border bg-card p-4">
                <p className="mb-2 font-medium">{bloco}</p>
                {cols.map(([col, campo]) => (
                  <div key={col} className="flex justify-between gap-4 border-b py-1.5 text-sm">
                    <span>{col}</span>
                    <span className="text-right text-muted-foreground">→ {campo}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {(estado === "lendo" || estado === "gravando") && (
        <div className="rounded-lg border bg-card p-6">
          <p className="font-medium">
            {estado === "lendo"
              ? ETAPAS.find(([e]) => e === etapa)![1]
              : "Gravando (substituição tudo-ou-nada)…"}
          </p>
          {estado === "lendo" && (
            <div className="mt-4 space-y-2">
              <Progress
                value={((ETAPAS.findIndex(([e]) => e === etapa) + 1) / ETAPAS.length) * 100}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {ETAPAS.map(([e, l]) => (
                  <span key={e} className={e === etapa ? "font-medium text-foreground" : ""}>
                    {l.replace("…", "")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {estado === "ok" && (
        <div className="space-y-3 rounded-lg border bg-card p-6">
          <p className="font-semibold text-success">
            Importação concluída — as telas já mostram os dados da planilha.
          </p>
          <Button variant="outline" onClick={cancelar}>
            Nova importação
          </Button>
        </div>
      )}

      {estado === "previa" && previa && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <span className="font-medium">{previa.arquivo}</span>
            <span className="text-muted-foreground">
              {" "}
              · {previa.leitura.notas.length} NFs · {previa.leitura.negocios.length} negócios ·{" "}
              {previa.leitura.parte2.fatos.length} fatos mensais · total das NFs (matriz KD){" "}
              {formatarBRL(previa.leitura.totalKD)}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Parte2 — história financeira</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["Seções", previa.leitura.parte2.resumo.secoes],
                  ["Clientes", previa.leitura.parte2.resumo.clientes],
                  ["Cards a liberar", previa.leitura.parte2.cards.length],
                  ["Controles", previa.leitura.parte2.resumo.controles],
                  ["Conferências OK", previa.leitura.parte2.resumo.conciliados],
                  ["Com diferença", previa.leitura.parte2.resumo.divergentes],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-md border bg-card p-4">
                  <p className="text-xs uppercase text-muted-foreground">{l}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <details className="rounded-md border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Fatos por bloco ({Object.keys(previa.leitura.parte2.resumo.fatosPorBloco).length})
              </summary>
              <div className="grid gap-x-6 border-t px-3 py-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(previa.leitura.parte2.resumo.fatosPorBloco).map(([b, q]) => (
                  <div key={b} className="flex justify-between border-b py-1.5">
                    <span>{NOME_BLOCO[b] ?? b}</span>
                    <span className="tabular-nums text-muted-foreground">{q}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
          {(
            [
              ["Notas fiscais", previa.nf],
              ["Negócios", previa.neg],
            ] as const
          ).map(([t, c]) => (
            <div key={t} className="space-y-2">
              <h2 className="text-sm font-semibold">{t}</h2>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    ["Novos", c.novos],
                    ["Alterados", c.alterados],
                    ["Inalterados", c.inalterados],
                    ["Removidos", c.removidos],
                    ["Com erro", c.comErro],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l} className="rounded-md border bg-card p-4">
                    <p className="text-xs uppercase text-muted-foreground">{l}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              {c.removidosLista.length > 0 && (
                <Lista
                  titulo={`${t} removidos (existem no sistema e não na planilha) (${c.removidosLista.length})`}
                  itens={c.removidosLista}
                />
              )}
            </div>
          ))}
          {previa.leitura.parte2.problemas.length > 0 && (
            <Lista
              titulo={`Parte2 — problemas por célula (${previa.leitura.parte2.problemas.length})`}
              itens={previa.leitura.parte2.problemas.map(
                (e) => `${e.bloco} · linha ${e.linha}, coluna ${e.coluna}: ${e.msg}`,
              )}
              perigo
            />
          )}
          {previa.leitura.erros.length > 0 && (
            <Lista
              titulo={`Erros por linha e coluna — não serão importados (${previa.leitura.erros.length})`}
              itens={previa.leitura.erros.map(
                (e) => `${e.modulo} · linha ${e.linha}, coluna ${e.coluna}: ${e.msg}`,
              )}
              perigo
            />
          )}
          {(
            [
              [
                "Avisos e conferências — Parte1",
                previa.leitura.avisos.filter((a) => !a.titulo.startsWith("Parte2 · ")),
              ],
              [
                "Avisos e conferências — Parte2",
                previa.leitura.avisos
                  .filter((a) => a.titulo.startsWith("Parte2 · "))
                  .map((a) => ({ ...a, titulo: a.titulo.slice(9) })),
              ],
            ] as const
          ).map(([g, lista]) => (
            <details key={g} className="space-y-2 rounded-lg border p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">
                {g} ({lista.length})
              </summary>
              <div className="mt-2 space-y-2">
                {lista.map((a) => (
                  <Lista key={a.titulo} titulo={a.titulo} itens={a.itens} />
                ))}
              </div>
            </details>
          ))}
          <p className="text-sm text-muted-foreground">
            Ao confirmar, os dados atuais de negócios, notas fiscais e da história financeira
            (Parte2) serão <strong>substituídos</strong> por esta planilha. Se algo falhar, nada
            muda.
          </p>
          {!passo2 ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelar}>
                Cancelar
              </Button>
              <Button onClick={() => setPasso2(true)}>Continuar para confirmação</Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm font-medium">
                Etapa 2 de 2 — esta ação substitui toda a base e fica registrada na auditoria.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="confirmacao">Digite SUBSTITUIR para confirmar</Label>
                <Input
                  id="confirmacao"
                  value={confirmacao}
                  autoComplete="off"
                  onChange={(e) => setConfirmacao(e.target.value)}
                  placeholder="SUBSTITUIR"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasso2(false);
                    setConfirmacao("");
                  }}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmacao.trim() !== "SUBSTITUIR"}
                  onClick={() => void confirmar()}
                >
                  Substituir base
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Lista({ titulo, itens, perigo }: { titulo: string; itens: string[]; perigo?: boolean }) {
  return (
    <details className="rounded-md border bg-card">
      <summary
        className={`cursor-pointer px-3 py-2 text-sm font-medium ${perigo ? "text-danger" : ""}`}
      >
        {titulo}
      </summary>
      <ul className="max-h-64 divide-y overflow-auto border-t text-sm">
        {itens.slice(0, 300).map((i, k) => (
          <li key={k} className="px-3 py-1.5">
            {i}
          </li>
        ))}
        {itens.length > 300 && (
          <li className="px-3 py-1.5 text-muted-foreground">… e mais {itens.length - 300}</li>
        )}
      </ul>
    </details>
  );
}
