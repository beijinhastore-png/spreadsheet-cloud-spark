// Fase 8 — ÚNICO lugar com mês/ano de referência. Nada de "mês fixo" fora daqui.
// - anoBase: configuração (padrão 2026), editável e guardada no localStorage.
// - periodo { inicio, fim }: vem SÓ do filtro de período (mês/trimestre/ano/intervalo); filtra os valores.
// - dataReferencia: derivada, nunca editável = fim do período, limitado a HOJE.
//   Serve apenas para status da NF, dias de atraso, aging, "a vencer" e realizado × previsto.

export const ANO_BASE_PADRAO = 2026;
const CHAVE_ANO = "controladoria.anoBase";

const pad = (n: number) => String(n).padStart(2, "0");

/** Hoje em AAAA-MM-DD (fuso local). */
export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function obterAnoBase(): number {
  if (typeof window === "undefined") return ANO_BASE_PADRAO;
  const v = Number(window.localStorage.getItem(CHAVE_ANO));
  return Number.isInteger(v) && v > 1900 ? v : ANO_BASE_PADRAO;
}
export function definirAnoBase(ano: number) {
  if (typeof window === "undefined") return;
  const anterior = obterAnoBase();
  window.localStorage.setItem(CHAVE_ANO, String(ano));
  if (anterior !== ano)
    void import("@/data/acesso").then((m) =>
      m.registrarAuditoria("parametro", { parametro: "anoBase", de: anterior, para: ano }),
    );
}

/** Lista dos 12 meses (AAAA-MM) do ano-base — base de todas as séries mensais. */
export function mesesDoAno(ano: number = obterAnoBase()): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${pad(i + 1)}`);
}

/** Bucket "anterior" (tudo até 31/12 do ano anterior), representado por dez do ano anterior. */
export const mesAnterior = (ano: number = obterAnoBase()) => `${ano - 1}-12`;
export const fimAnoAnteriorISO = (ano: number = obterAnoBase()) => `${ano - 1}-12-31`;

/** Último dia (AAAA-MM-DD) de um mês AAAA-MM. */
export function fimDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return `${mes}-${pad(new Date(a, m, 0).getDate())}`;
}

export type Periodo = { inicio: string; fim: string }; // AAAA-MM-DD

/** Período em datas a partir do intervalo de meses do filtro. */
export const periodoDeMeses = (de: string, ate: string): Periodo => ({
  inicio: `${de}-01`,
  fim: fimDoMes(ate),
});

/** Data de referência = fim do período; se o fim for posterior a hoje, usa hoje. */
export const dataReferencia = (periodo: Periodo, hoje: string = hojeISO()): string =>
  periodo.fim > hoje ? hoje : periodo.fim;

/** Mês de referência: mês da data informada, limitado a [jan, dez] do ano-base. */
export function mesReferencia(data: string = hojeISO(), ano: number = obterAnoBase()): string {
  const m = data.slice(0, 7);
  if (m < `${ano}-01`) return `${ano}-01`;
  if (m > `${ano}-12`) return `${ano}-12`;
  return m;
}

/** Converte um período (mês/trimestre/ano/intervalo) em [de, ate] AAAA-MM. */
export type TipoPeriodo = "mes" | "trimestre" | "ano" | "intervalo";
export function intervaloDoPeriodo(p: {
  tipo: TipoPeriodo;
  mes?: string;
  trimestre?: number;
  de?: string;
  ate?: string;
  ano?: number | undefined;
}): { de: string; ate: string } {
  const ano = p.ano ?? obterAnoBase();
  if (p.tipo === "mes") {
    const m = p.mes || mesReferencia(undefined, ano);
    return { de: m, ate: m };
  }
  if (p.tipo === "trimestre") {
    const t = Math.min(4, Math.max(1, p.trimestre ?? 1));
    return { de: `${ano}-${pad(t * 3 - 2)}`, ate: `${ano}-${pad(t * 3)}` };
  }
  if (p.tipo === "intervalo") {
    const de = p.de || `${ano}-01`;
    const ate = p.ate || `${ano}-12`;
    return de <= ate ? { de, ate } : { de: ate, ate: de };
  }
  return { de: `${ano}-01`, ate: `${ano}-12` };
}

export const diasEntre = (de: string, ate: string) =>
  Math.floor((Date.parse(ate) - Date.parse(de)) / 86400000);
