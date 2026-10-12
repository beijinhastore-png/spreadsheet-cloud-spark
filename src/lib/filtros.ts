// Fase 8 — filtros globais, persistidos na URL (search params tipados do TanStack Router).
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { dataReferencia, intervaloDoPeriodo, periodoDeMeses, type Periodo, type TipoPeriodo } from "./periodo";

export type Regime = "competencia" | "emissao" | "vencimento" | "recebimento";
export const REGIMES: { value: Regime; label: string }[] = [
  { value: "competencia", label: "Competência" },
  { value: "emissao", label: "Emissão" },
  { value: "vencimento", label: "Vencimento" },
  { value: "recebimento", label: "Recebimento" },
];
export const TIPOS_PERIODO: { value: TipoPeriodo; label: string }[] = [
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "intervalo", label: "Intervalo" },
];

// Sem enums fechados/limites: valores inválidos são normalizados em normalizarFiltros().
export const filtrosSchema = z.object({
  periodo: fallback(z.string(), "mes").default("mes"),
  mes: fallback(z.string(), "").default(""),
  tri: fallback(z.number(), 1).default(1),
  de: fallback(z.string(), "").default(""),
  ate: fallback(z.string(), "").default(""),
  regime: fallback(z.string(), "competencia").default("competencia"),
  bu: fallback(z.string(), "").default(""),
  produto: fallback(z.string(), "").default(""),
  plataforma: fallback(z.string(), "").default(""),
  contrato: fallback(z.string(), "").default(""),
  categoria: fallback(z.string(), "").default(""),
  clientes: fallback(z.array(z.string()), []).default([]),
});
export type FiltrosURL = z.infer<typeof filtrosSchema>;
export const FILTROS_PADRAO: FiltrosURL = filtrosSchema.parse({});

/** Filtros normalizados, prontos para as métricas. */
export interface FiltrosGlobais {
  de: string; // AAAA-MM
  ate: string; // AAAA-MM
  regime: Regime;
  bu: string;
  produto: string;
  plataforma: string;
  contrato: string;
  categoria: string;
  clientes: string[];
  periodo: Periodo; // datas do filtro (filtra valores)
  dataReferencia: string; // AAAA-MM-DD, derivada: fim do período limitado a hoje
}

export function normalizarFiltros(f: FiltrosURL, hoje: string, ano?: number): FiltrosGlobais {
  const tipo = (
    TIPOS_PERIODO.some((t) => t.value === f.periodo) ? f.periodo : "mes"
  ) as TipoPeriodo;
  const { de, ate } = intervaloDoPeriodo({
    tipo,
    mes: f.mes,
    trimestre: f.tri,
    de: f.de,
    ate: f.ate,
    ano,
  });
  const regime = (REGIMES.some((r) => r.value === f.regime) ? f.regime : "competencia") as Regime;
  return {
    de,
    ate,
    regime,
    bu: f.bu,
    produto: f.produto,
    plataforma: f.plataforma,
    contrato: f.contrato,
    categoria: f.categoria,
    clientes: f.clientes,
    periodo: periodoDeMeses(de, ate),
    dataReferencia: dataReferencia(periodoDeMeses(de, ate), hoje),
  };
}

// "Salvar visão": combinações nomeadas no localStorage (por ora).
const CHAVE_VISOES = "controladoria.visoes";
export type Visao = { nome: string; filtros: FiltrosURL };
export function listarVisoes(): Visao[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_VISOES) ?? "[]") as Visao[];
  } catch {
    return [];
  }
}
export function salvarVisao(v: Visao) {
  const xs = listarVisoes().filter((x) => x.nome !== v.nome);
  window.localStorage.setItem(CHAVE_VISOES, JSON.stringify([...xs, v]));
}
export function removerVisao(nome: string) {
  window.localStorage.setItem(
    CHAVE_VISOES,
    JSON.stringify(listarVisoes().filter((x) => x.nome !== nome)),
  );
}
