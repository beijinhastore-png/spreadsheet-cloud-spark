// Regras de cálculo CONFIRMADAS (funções puras).
// Regras A VALIDAR (margem, imposto líquido, rateio "Total p/ Card", critério
// Terceiro/Anunciante, significado de "Código") NÃO estão aqui: seguem com selo "Necessita validação".
import type { StatusNF } from "@/data/tipos";

import { hojeISO } from "./periodo";

type NFBase = {
  valor: number;
  competencia: string;
  emissao: string;
  vencimento: string;
  dataPagamento?: string | undefined;
};
const mesDe = (d: string) => d.slice(0, 7);

export const somaValor = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0);

export function statusDerivado(
  nf: Pick<NFBase, "vencimento" | "dataPagamento">,
  base = hojeISO(),
): StatusNF {
  // Fase 13: mesma regra de statusNaData — pago só se o pagamento ocorreu até a data de referência.
  if (nf.dataPagamento && nf.dataPagamento <= base) return "pago";
  return nf.vencimento < base ? "atrasado" : "pendente";
}

export function diasAtraso(
  nf: Pick<NFBase, "vencimento" | "dataPagamento">,
  base = hojeISO(),
): number {
  if (nf.dataPagamento) return 0;
  return Math.max(0, Math.floor((Date.parse(base) - Date.parse(nf.vencimento)) / 86400000));
}

export const faturadoCompetencia = (nfs: NFBase[], mes: string) =>
  somaValor(nfs.filter((n) => n.competencia === mes));
export const faturadoEmissao = (nfs: NFBase[], mes: string) =>
  somaValor(nfs.filter((n) => mesDe(n.emissao) === mes));
export const recebidoNoMes = (nfs: NFBase[], mes: string) =>
  somaValor(nfs.filter((n) => n.dataPagamento && mesDe(n.dataPagamento) === mes));
export const recebidoTotal = (nfs: NFBase[]) => somaValor(nfs.filter((n) => n.dataPagamento));

export function pipeVsFaturado(pipe: number, faturado: number) {
  const diferenca = faturado - pipe;
  return { diferenca, variacao: pipe ? diferenca / pipe : 0 };
}

/** Totais/subtotais por qualquer chave (BU, produto, cliente...). */
export function totaisPor<T extends { valor: number }>(
  xs: T[],
  chave: (x: T) => string,
): Map<string, number> {
  const m = new Map<string, number>();
  xs.forEach((x) => m.set(chave(x), (m.get(chave(x)) ?? 0) + x.valor));
  return m;
}

/**
 * Fase 16 — fórmula OFICIAL de margem. null = ainda não escolhida: a tela mostra as três
 * (a, b, c) com selo "Necessita validação". Defina "a", "b" ou "c" para mostrar só a oficial.
 * (a) Faturado − Custos por emissão · (b) Recebido − Custos por pagamento · (c) (a) − Impostos + Créditos
 */
export const MARGEM_OFICIAL: "a" | "b" | "c" | null = null;
