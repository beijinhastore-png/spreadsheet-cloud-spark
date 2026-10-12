// Fase 10 — Dicionário das etapas da Jornada do Dinheiro (texto dos tooltips).
// Constantes editáveis; definições seguem docs/CONTEXTO_DADOS.md (Parte2).
export type EtapaJornada =
  | "pipe"
  | "pipe_autorizado"
  | "a_liberar"
  | "fat_emissao"
  | "fat_competencia"
  | "vencimento"
  | "recebimento"
  | "custo_pagamento"
  | "custo_emissao"
  | "impostos"
  | "creditos"
  | "margem";

export const GLOSSARIO: Record<EtapaJornada, { nome: string; curto: string; definicao: string }> = {
  pipe: {
    nome: "Pipe",
    curto: "Pipe",
    definicao: "Valor dos negócios ganhos no Pipedrive (Resumo Pipe da Parte 2).",
  },
  pipe_autorizado: {
    nome: "Pipe autorizado",
    curto: "Autorizado",
    definicao: "Parte do Pipe com emissão de NF autorizada.",
  },
  a_liberar: {
    nome: "A liberar",
    curto: "A liberar",
    definicao: "Cards autorizados que ainda aguardam liberação para faturar.",
  },
  fat_emissao: {
    nome: "Faturado por emissão",
    curto: "Fat. emissão",
    definicao: "NFs (RPS) somadas pelo mês em que foram emitidas.",
  },
  fat_competencia: {
    nome: "Faturado por competência",
    curto: "Fat. compet.",
    definicao: "NFs somadas pelo mês de competência do serviço.",
  },
  vencimento: {
    nome: "Vencimento (previsto)",
    curto: "Vencimento",
    definicao: "Valores com vencimento no mês — o que se espera receber.",
  },
  recebimento: {
    nome: "Recebimento (realizado)",
    curto: "Recebido",
    definicao: "Valores efetivamente recebidos no mês.",
  },
  custo_pagamento: {
    nome: "Custos por pagamento",
    curto: "Custos (pag.)",
    definicao: "Custos pelo mês em que foram pagos (vão até fev/27, dia 3).",
  },
  custo_emissao: {
    nome: "Custos por emissão",
    curto: "Custos (emis.)",
    definicao:
      "Os mesmos custos pelo mês de emissão do documento. Informativo: não é descontado de novo na cascata.",
  },
  impostos: {
    nome: "Impostos",
    curto: "Impostos",
    definicao: "Impostos lidos da Parte 2 (o sistema não calcula).",
  },
  creditos: {
    nome: "Créditos",
    curto: "Créditos",
    definicao: "Créditos tributários lidos da Parte 2; somam à margem.",
  },
  margem: {
    nome: "Margem",
    curto: "Margem",
    definicao:
      "Faturado por competência − Custos por pagamento − Impostos + Créditos. Necessita validação.",
  },
};
