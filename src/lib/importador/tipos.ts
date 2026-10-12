// Tipos do importador v2 (Fase 5).
export type Cel = { v?: unknown; t?: string; w?: string; l?: { Target?: string } } | undefined;
export interface Problema {
  modulo: "NF" | "Negócio";
  linha: number;
  coluna: string;
  msg: string;
}
export interface NegocioRow {
  id_pipe: string;
  cliente: string;
  titulo: string;
  ganho_em: string | null;
  bu: string;
  plataforma: string;
  tipo_contrato: string;
  autorizada: boolean;
  valor: number;
  data_competencia: string | null;
}
export interface NotaRow {
  numero_nf: string;
  id_pipe: string | null;
  cliente: string;
  cliente_inferido: boolean;
  razao_social: string;
  card: string;
  link_pipe: string | null;
  link_nf: string | null;
  codigo: string;
  regime: string;
  bu: string;
  valor: number;
  data_competencia: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
}
export interface AgregadoRow {
  tipo: string;
  bu: string | null;
  produto: string | null;
  categoria: string | null;
  mes: string | null;
  valor: number;
}

export interface VinculoNegocioNF {
  id_pipe: string;
  numero_nf: string;
}

export interface Leitura {
  aba: string;
  hash: string; // SHA-256 do arquivo (hex)
  vinculos: VinculoNegocioNF[]; // negócio ↔ NF pela coluna "NF:" dos negócios
  negocios: NegocioRow[];
  notas: NotaRow[];
  agregados: AgregadoRow[];
  erros: Problema[]; // linhas não importadas
  avisos: { titulo: string; itens: string[] }[]; // informativos
  totalKD: number;
  parte2: import("./parte2").Parte2;
}
