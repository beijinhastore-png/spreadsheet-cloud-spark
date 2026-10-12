// Tipos do domínio (sem dados fictícios).
export type BU = "Advertising" | "Analytics";
export type Produto = string; // Fase 15: produtos vêm da planilha
export type TipoContrato = string;
export type Plataforma = string;
export type Categoria = string; // "Terceiro" | "Anunciante" | "—"
export type StatusNF = "pago" | "pendente" | "atrasado";

export interface Cliente {
  id: string;
  nome: string;
  categoria: Categoria;
}
export interface Negocio {
  id: string;
  clienteId: string;
  bu: BU;
  produto: Produto;
  contrato: TipoContrato;
  plataforma: Plataforma;
  competencia: string;
  valor: number;
  temNF: boolean;
  titulo: string;
  ganhoEm: string;
  autorizada: boolean;
}
export interface NotaFiscal {
  id: string;
  numero: string;
  negocioId: string;
  clienteId: string;
  bu: BU;
  contrato: TipoContrato;
  competencia: string;
  valor: number;
  status: StatusNF;
  emissao: string;
  card: Produto;
  vencimento: string;
  dataPagamento?: string | undefined;
  razaoSocial?: string;
  nomeCard?: string;
  codigo?: string;
  regime?: string;
  linkPipe?: string | undefined;
  linkNF?: string | undefined;
  clienteInferido?: boolean;
}
export interface CustoMensal {
  competencia: string;
  bu: BU;
  custos: number;
  impostos: number;
  creditos: number;
}
// Fase 8 — agregados por BU/produto/mês (como na origem; sem lançamentos individuais)
export interface CustoProdutoMensal {
  competencia: string;
  bu: BU;
  produto: Produto;
  custoPagamento: number;
  custoEmissao: number;
  impostos: number;
  creditos: number;
}
