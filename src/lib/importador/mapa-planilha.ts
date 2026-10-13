// Importador v3 — ÚNICO arquivo de configuração do layout da planilha.
// Títulos, nomes internos dos blocos, obrigatoriedade, coluna "anterior" e cabeçalhos esperados.
// parte1.ts e parte2.ts leem daqui; nenhum título fica espalhado no código.

/** Normalização usada para comparar títulos/abas: sem acentos, sem espaços, maiúsculas. */
export const compacto = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

/** Nomes das abas (comparados por `compacto`). */
export const ABAS = { parte1: "PARTE1", parte2: "PARTE2" } as const;

// ===================== PARTE 1 =====================
// Blocos pelo TÍTULO da linha 1 (igualdade normalizada), cabeçalhos na linha 2, dados da linha 3.

/** Negócios do Pipe (colunas A:J, cabeçalhos na linha 1). */
export const P1_NEGOCIOS = {
  cabecalhos: {
    titulo: "PIPE: Negócio - Título",
    ganhoEm: "Negócio - Ganho em",
    contrato: "Contrato",
    plataforma: "Plataforma", // vem como " Plataforma" (trim)
    valor: "Negócio - Valor",
    totalCard: "Total p/ Card",
    cliente: "Cliente:",
    idPipe: "Pipe:",
    autorizada: "Autorizada emissão",
    nf: "NF:",
  },
  ultimaColuna: 12,
} as const;

export type IdBlocoNF = "adv_comp" | "adv_emis" | "ana_comp" | "ana_emis" | "mestra";
export interface BlocoNF {
  id: IdBlocoNF;
  titulo: string;
  bu: "Advertising" | "Analytics" | null;
  matriz: "competencia" | "emissao";
  obrigatorio: boolean;
  cabecalhos: string[];
}
const CAB_BU = [
  "Cliente:",
  "Razão Social",
  "Nome do Card no Pipe",
  "Pipe",
  "Nota Fiscal",
  "NF",
  "Código",
  "Emissão:",
  "Vencimento:",
  "Data Pagamento:",
  "Status:",
];
export const P1_BLOCOS_NF: BlocoNF[] = [
  {
    id: "adv_comp",
    titulo: "ADVERTISING - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF",
    bu: "Advertising",
    matriz: "competencia",
    obrigatorio: true,
    cabecalhos: CAB_BU,
  },
  {
    id: "adv_emis",
    titulo: "ADVERTISING - FATURADO POR CLIENTE - POR EMISSÃO - POR NF",
    bu: "Advertising",
    matriz: "emissao",
    obrigatorio: true,
    cabecalhos: CAB_BU,
  },
  {
    id: "ana_comp",
    titulo: "Analytics - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF",
    bu: "Analytics",
    matriz: "competencia",
    obrigatorio: true,
    cabecalhos: CAB_BU,
  },
  {
    id: "ana_emis",
    titulo: "Analytics - FATURADO POR CLIENTE - POR EMISSÃO - POR NF",
    bu: "Analytics",
    matriz: "emissao",
    obrigatorio: true,
    cabecalhos: CAB_BU,
  },
  {
    // LISTA MESTRA de NFs. Não tem Data Pagamento nem Código NFS-e.
    id: "mestra",
    titulo: "FATURADO POR EMISSÃO - POR NF",
    bu: null,
    matriz: "emissao",
    obrigatorio: true,
    cabecalhos: [
      "Cliente:",
      "Razão Social",
      "Nome do Card no Pipe",
      "Pipe",
      "Nota Fiscal",
      "Cód Verificação",
      "Emissão:",
      "Competência:",
      "NF",
      "Vencimento:",
      "Status:",
    ],
  },
];
/** Coluna da matriz com data ≤ 31/12 do ano anterior = saldo anterior (anterior=true). */
export const P1_COLUNA_ANTERIOR = "31/12 do ano anterior";

// ===================== PARTE 2 =====================
// Blocos pelo INÍCIO do título normalizado (linha 2), cabeçalhos na linha 3;
// cada bloco termina na coluna "Total:". Vence o início mais longo que casar.

export type Bloco =
  | "pipe"
  | "pipe_autorizado"
  | "fat_emissao"
  | "fat_competencia"
  | "dif_pipe_fat"
  | "a_liberar"
  | "recebimento"
  | "vencimento"
  | "dif_venc_receb"
  | "custo_pagamento"
  | "dif_custo_receb"
  | "custo_emissao"
  | "impostos"
  | "iss"
  | "iss_cumulativo"
  | "iss_nao_cumulativo"
  | "pis_cofins_cumulativo"
  | "creditos";

export interface BlocoP2 {
  bloco: Exclude<Bloco, "a_liberar">;
  inicio: string; // início do título (será comparado por `compacto`)
  obrigatorio: boolean;
  anterior: boolean; // tem coluna 31/12 do ano anterior (saldo anterior)
  conferencia?: boolean; // só conferência (não alimenta telas)
}
export const P2_BLOCOS: BlocoP2[] = [
  { bloco: "pipe", inicio: "Resumo Pipe", obrigatorio: true, anterior: false },
  {
    bloco: "pipe_autorizado",
    inicio: "Resumo Pipe - Emissão autorizada",
    obrigatorio: true,
    anterior: false,
  },
  {
    bloco: "fat_emissao",
    inicio: "Resumo Faturado - Por Emissão",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "fat_competencia",
    inicio: "Resumo Faturado - Por Competência",
    obrigatorio: true,
    anterior: true,
  },
  {
    // + coluna "A liberar" (bloco interno a_liberar)
    bloco: "dif_pipe_fat",
    inicio: "Diferenças - Entre Resumo Pipe",
    obrigatorio: true,
    anterior: false,
  },
  {
    bloco: "recebimento",
    inicio: "Resumo Faturado - Por Recebimento",
    obrigatorio: true,
    anterior: true,
  },
  {
    // O título aparece duas vezes; a 2ª ocorrência é a coluna única "<31/12/AAAA".
    bloco: "vencimento",
    inicio: "Resumo Faturado - Por Vencimento",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "dif_venc_receb",
    inicio: "Diferenças - Entre Faturado por vencimento",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "custo_pagamento",
    inicio: "Custos por Data de Pagamento",
    obrigatorio: true,
    anterior: false,
  },
  {
    bloco: "dif_custo_receb",
    inicio: "Diferenças - Entre Resumo Faturado - Custos",
    obrigatorio: true,
    anterior: false,
    conferencia: true,
  },
  { bloco: "custo_emissao", inicio: "Custos por Emissão", obrigatorio: true, anterior: false },
  {
    bloco: "impostos",
    inicio: "Total Impostos P/ Competência",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "iss",
    inicio: "ISS P/ Competência (Notas emitidas sob todos",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "iss_cumulativo",
    inicio: "ISS P/ Competência (Notas emitidas sob códigos cumulativos",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "iss_nao_cumulativo",
    inicio: "ISS P/ Competência (Notas emitidas sob códigos Não cumulativos",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "pis_cofins_cumulativo",
    inicio: "Pis e Cofins P/ Competência",
    obrigatorio: true,
    anterior: true,
  },
  {
    bloco: "creditos",
    inicio: "Créditos Pis e Cofins",
    obrigatorio: true,
    anterior: true,
  },
];

/** Cabeçalhos especiais da linha 3 da Parte 2. */
export const P2_CABECALHOS = {
  bu: "BU",
  produto: "Produto",
  total: "Total", // início
  aLiberar: "A liberar",
  cliente: "Cliente",
  cardsLiberar: "Cards a Liberar",
} as const;

/**
 * Rótulos de linhas de controle antes da 1ª seção.
 * "Total Razão:" (FP21/GF21): linha reservada para os valores do razão contábil; hoje só
 * tem o total do bloco de impostos, e a linha "Diferenças:" logo abaixo = total − razão
 * (como o razão está vazio, repete os totais mensais). Lido apenas como conferência.
 */
export const P2_ROTULOS_CONTROLE = {
  totalRazao: "Total Razão:",
  diferencas: "Diferenças:",
  aLiberar: "Á liberar",
  check: "Check:",
  totalFaturas: "Total Faturas:",
} as const;

/** Tolerância das conferências (R$). */
export const TOLERANCIA = 0.05;

/** Relações entre blocos de impostos usadas na tela de qualidade. */
export const RELACOES_IMPOSTOS: { nome: string; total: Bloco; partes: Bloco[] }[] = [
  { nome: "ISS = ISS cumulativo + ISS não cumulativo", total: "iss", partes: ["iss_cumulativo", "iss_nao_cumulativo"] },
  {
    nome: "Impostos = ISS + PIS/COFINS cumulativo + créditos (Necessita validação)",
    total: "impostos",
    partes: ["iss", "pis_cofins_cumulativo", "creditos"],
  },
];

/** Escolhe o bloco cujo início (normalizado) casa com o título; vence o mais longo. */
export function blocoP2DoTitulo(titulo: unknown): BlocoP2 | undefined {
  const t = compacto(titulo);
  if (!t) return undefined;
  return P2_BLOCOS.filter((b) => t.startsWith(compacto(b.inicio))).sort(
    (a, b) => compacto(b.inicio).length - compacto(a.inicio).length,
  )[0];
}

/** Títulos achados mais parecidos com o esperado (para a mensagem de erro). */
export function parecidos(esperado: string, achados: string[], n = 3): string[] {
  const e = compacto(esperado);
  const pontua = (x: string) => {
    const c = compacto(x);
    let i = 0;
    while (i < c.length && i < e.length && c[i] === e[i]) i++;
    const comuns = new Set([...e].filter((ch) => c.includes(ch))).size;
    return i * 3 + comuns;
  };
  return [...new Set(achados.filter(Boolean))]
    .sort((a, b) => pontua(b) - pontua(a))
    .slice(0, n);
}
