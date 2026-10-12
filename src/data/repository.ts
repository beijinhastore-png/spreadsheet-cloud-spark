// Única porta de acesso aos dados — Fase 15: dados importados da planilha (Lovable Cloud).
// Carregados uma vez após o login (carregarDados) e servidos de forma síncrona às telas.
import { supabase } from "@/integrations/supabase/client";
import { statusDerivado } from "@/lib/calculos";
import type { BU, Cliente, Negocio, NotaFiscal, CustoMensal, CustoProdutoMensal } from "./tipos";

type Campo =
  | "id_pipe"
  | "cliente"
  | "titulo"
  | "ganho_em"
  | "bu"
  | "plataforma"
  | "tipo_contrato"
  | "autorizada"
  | "valor"
  | "data_competencia"
  | "numero_nf"
  | "cliente_inferido"
  | "razao_social"
  | "card"
  | "link_pipe"
  | "link_nf"
  | "codigo"
  | "regime"
  | "data_emissao"
  | "data_vencimento"
  | "data_pagamento"
  | "tipo"
  | "produto"
  | "categoria"
  | "mes"
  | "nome"
  | "bloco"
  | "nivel"
  | "contrato"
  | "item_cobranca"
  | "anterior"
  | "valor_planilha"
  | "descricao";
type Linha = Partial<Record<Campo, unknown>> & Record<string, unknown>;
const s = (x: unknown) => (x == null ? "" : String(x));
const n = (x: unknown) => Number(x ?? 0);

type Tabela =
  | "negocios"
  | "notas_fiscais"
  | "fato_mensal"
  | "cards_liberar"
  | "clientes_dim"
  | "controles_planilha";
async function todos(tabela: Tabela): Promise<Linha[]> {
  const out: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .range(de, de + 999);
    if (error) throw error;
    out.push(...(data as Linha[]));
    if (data.length < 1000) break;
  }
  return out;
}

export { produtoDe } from "@/lib/produto";
import { produtoDe } from "@/lib/produto";

export interface Fato {
  bloco: string;
  nivel: "produto" | "cliente";
  bu: string | null;
  plataforma: string | null;
  contrato: string | null;
  produto: string | null;
  itemCobranca: string | null;
  cliente: string | null;
  categoria: string | null;
  mes: string; // AAAA-MM-01
  anterior: boolean;
  valor: number;
}
export interface CardLiberar {
  cliente: string;
  produto: string;
  plataforma: string;
  contrato: string;
  categoria: string | null;
  valor: number;
}
export interface Controle {
  bloco: string;
  mes: string | null;
  valorPlanilha: number;
  descricao: string;
}
let fatos: Fato[] = [],
  cardsLiberar: CardLiberar[] = [],
  controles: Controle[] = [];
const v2 = {
  fatos: [] as Linha[],
  cards: [] as Linha[],
  clientesDim: [] as Linha[],
  controles: [] as Linha[],
};

let brutos = { negocios: [] as Linha[], notas: [] as Linha[] };

// valores_agregados: tabela LEGADA/removível — não é mais lida (Fase 8).
/** Agregados no formato antigo, derivados do modelo novo (fato_mensal + clientes_dim). */
function agregadosDerivados(): Linha[] {
  const tipos = new Set(["custo_pagamento", "custo_emissao", "impostos", "creditos"]);
  const out: Linha[] = fatos
    .filter((f) => f.nivel === "produto" && !f.anterior && tipos.has(f.bloco))
    .map((f) => ({
      tipo: f.bloco,
      bu: f.bu,
      produto: f.produto,
      categoria: null,
      mes: f.mes.slice(0, 7),
      valor: f.valor,
    }));
  for (const c of v2.clientesDim)
    out.push({
      tipo: "categoria_cliente",
      bu: null,
      produto: s(c.nome),
      categoria: c.categoria ?? null,
      mes: null,
      valor: 0,
    });
  return out;
}
let clientes: Cliente[] = [],
  negocios: Negocio[] = [],
  notas: NotaFiscal[] = [];
let custosProduto: CustoProdutoMensal[] = [],
  custos: CustoMensal[] = [];
let carregado: Promise<void> | null = null;

function montar() {
  fatos = v2.fatos.map((x) => ({
    bloco: s(x.bloco),
    nivel: s(x.nivel) as Fato["nivel"],
    bu: x.bu == null ? null : s(x.bu),
    plataforma: x.plataforma == null ? null : s(x.plataforma),
    contrato: x.contrato == null ? null : s(x.contrato),
    produto: x.produto == null ? null : s(x.produto),
    itemCobranca: x.item_cobranca == null ? null : s(x.item_cobranca),
    cliente: x.cliente == null ? null : s(x.cliente),
    categoria: x.categoria == null ? null : s(x.categoria),
    mes: s(x.mes).slice(0, 10),
    anterior: !!x.anterior,
    valor: n(x.valor),
  }));
  cardsLiberar = v2.cards.map((x) => ({
    cliente: s(x.cliente),
    produto: s(x.produto),
    plataforma: s(x.plataforma),
    contrato: s(x.contrato),
    categoria: x.categoria == null ? null : s(x.categoria),
    valor: n(x.valor),
  }));
  controles = v2.controles.map((x) => ({
    bloco: s(x.bloco),
    mes: x.mes == null ? null : s(x.mes),
    valorPlanilha: n(x.valor_planilha),
    descricao: s(x.descricao),
  }));
  // Getters antigos: derivados do modelo novo quando ele já tem dados.
  const ag = agregadosDerivados();
  dadosSnapshot = null;
  const catCliente = new Map(
    ag
      .filter((a) => a.tipo === "categoria_cliente")
      .map((a) => [s(a.produto).toLowerCase(), s(a.categoria)]),
  );
  const nomes = new Set<string>();
  const comNF = new Set(brutos.notas.map((x) => s(x.id_pipe)).filter(Boolean));
  negocios = brutos.negocios.map((x) => {
    nomes.add(s(x.cliente));
    return {
      id: s(x.id_pipe),
      clienteId: s(x.cliente),
      bu: s(x.bu) as BU,
      produto: produtoDe(s(x.plataforma), s(x.tipo_contrato)),
      contrato: s(x.tipo_contrato),
      plataforma: s(x.plataforma),
      competencia: s(x.data_competencia).slice(0, 7),
      valor: n(x.valor),
      temNF: comNF.has(s(x.id_pipe)),
      titulo: s(x.titulo),
      ganhoEm: s(x.ganho_em),
      autorizada: !!x.autorizada,
    };
  });
  const negPorId = new Map(negocios.map((g) => [g.id, g]));
  notas = brutos.notas.map((x) => {
    nomes.add(s(x.cliente));
    const g = negPorId.get(s(x.id_pipe));
    const nf = {
      id: s(x.numero_nf),
      numero: s(x.numero_nf),
      negocioId: s(x.id_pipe),
      clienteId: s(x.cliente),
      bu: s(x.bu) as BU,
      contrato: g?.contrato ?? "",
      competencia: s(x.data_competencia).slice(0, 7),
      valor: n(x.valor),
      emissao: s(x.data_emissao),
      card: g?.produto ?? (s(x.bu) === "Analytics" ? "GA4" : "Não localizado"),
      vencimento: s(x.data_vencimento),
      dataPagamento: x.data_pagamento ? s(x.data_pagamento) : undefined,
      razaoSocial: s(x.razao_social),
      nomeCard: s(x.card),
      codigo: s(x.codigo),
      regime: s(x.regime),
      linkPipe: x.link_pipe ? s(x.link_pipe) : undefined,
      linkNF: x.link_nf ? s(x.link_nf) : undefined,
      clienteInferido: !!x.cliente_inferido,
    };
    return { ...nf, status: statusDerivado(nf) };
  });
  clientes = [...nomes]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => ({ id: nome, nome, categoria: catCliente.get(nome.toLowerCase()) ?? "—" }));

  const cp = new Map<string, CustoProdutoMensal>();
  for (const a of ag) {
    const campo = (
      {
        custo_pagamento: "custoPagamento",
        custo_emissao: "custoEmissao",
        impostos: "impostos",
        creditos: "creditos",
      } as const
    )[s(a.tipo) as "impostos"];
    if (!campo) continue;
    const k = `${s(a.mes)}|${s(a.bu)}|${s(a.produto)}`;
    const o = cp.get(k) ?? {
      competencia: s(a.mes),
      bu: s(a.bu) as BU,
      produto: s(a.produto),
      custoPagamento: 0,
      custoEmissao: 0,
      impostos: 0,
      creditos: 0,
    };
    o[campo] += n(a.valor);
    cp.set(k, o);
  }
  custosProduto = [...cp.values()];
  const cm = new Map<string, CustoMensal>();
  for (const c of custosProduto) {
    const k = `${c.competencia}|${c.bu}`;
    const o = cm.get(k) ?? {
      competencia: c.competencia,
      bu: c.bu,
      custos: 0,
      impostos: 0,
      creditos: 0,
    };
    o.custos += c.custoPagamento;
    o.impostos += c.impostos;
    o.creditos += c.creditos;
    cm.set(k, o);
  }
  custos = [...cm.values()];
}

/** Carrega (ou recarrega, com forcar=true) os dados importados. */
export function carregarDados(forcar = false) {
  if (!carregado || forcar) {
    carregado = Promise.all([
      todos("negocios"),
      todos("notas_fiscais"),
      todos("fato_mensal"),
      todos("cards_liberar"),
      todos("clientes_dim"),
      todos("controles_planilha"),
    ])
      .then(([negocios, notas, f, c, cd, ct]) => {
        brutos = { negocios, notas };
        v2.fatos = f;
        v2.cards = c;
        v2.clientesDim = cd;
        v2.controles = ct;
        montar();
      })
      .catch((e) => {
        carregado = null;
        throw e;
      });
  }
  return carregado;
}

/** Limpa o cache em memória (usado no logout). */
export function limparDados() {
  // Fase 19: logout também apaga visões e preferências guardadas no navegador.
  if (typeof window !== "undefined")
    for (const k of Object.keys(window.localStorage))
      if (k.startsWith("controladoria.")) window.localStorage.removeItem(k);
  brutos = { negocios: [], notas: [] };
  dadosSnapshot = null;
  v2.fatos = v2.cards = v2.clientesDim = v2.controles = [];
  fatos = [];
  cardsLiberar = [];
  controles = [];
  clientes = [];
  negocios = [];
  notas = [];
  custosProduto = [];
  custos = [];
  carregado = null;
}

export const obterBrutos = () => brutos;
export const obterClientes = () => clientes;
export const obterNegocios = () => negocios;
export const obterNotasFiscais = () => notas;
export const obterCustos = () => custos;
export const obterBUs = (): BU[] => ["Advertising", "Analytics"];
const distintos = (xs: string[]) =>
  [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
export const obterProdutos = () =>
  distintos([...negocios.map((x) => x.produto), ...custosProduto.map((x) => x.produto)]);
export const obterContratos = () => distintos(negocios.map((x) => x.contrato));
export const obterPlataformas = () => distintos(negocios.map((x) => x.plataforma));
export const obterCategorias = () => ["Terceiro", "Anunciante"];
export const obterCustosProduto = () => custosProduto;

export interface FiltroFatos {
  bloco?: string | string[];
  nivel?: Fato["nivel"];
  bu?: string;
  produto?: string;
  cliente?: string;
  de?: string; // AAAA-MM
  ate?: string; // AAAA-MM
}
/** Fatos mensais da Parte2 (fato_mensal), filtrados. */
export function obterFatos(f: FiltroFatos = {}): Fato[] {
  const blocos = f.bloco == null ? null : new Set(Array.isArray(f.bloco) ? f.bloco : [f.bloco]);
  return fatos.filter(
    (x) =>
      (!blocos || blocos.has(x.bloco)) &&
      (!f.nivel || x.nivel === f.nivel) &&
      (!f.bu || x.bu === f.bu) &&
      (!f.produto || x.produto === f.produto) &&
      (!f.cliente || x.cliente === f.cliente) &&
      (!f.de || x.mes.slice(0, 7) >= f.de) &&
      (!f.ate || x.mes.slice(0, 7) <= f.ate),
  );
}
export const obterCardsLiberar = (): CardLiberar[] => cardsLiberar;
export const obterControles = (): Controle[] => controles;

// Fase 7 — checagens de qualidade (Parte1 × Parte2), recalculadas a cada carga.
import { executarChecagens, notaConfianca, type Checagem } from "@/lib/qualidade";
let cacheChecagens: { ref: unknown; cs: Checagem[] } | null = null;
export function obterChecagens(): Checagem[] {
  if (cacheChecagens?.ref === notas && cacheChecagens.ref !== null) return cacheChecagens.cs;
  const cs = executarChecagens({
    notas,
    negocios,
    fatos,
    controles,
    clientes: clientes.map((c) => ({ nome: c.nome, categoria: c.categoria })),
  });
  cacheChecagens = { ref: notas, cs };
  return cs;
}
export const obterNotaConfianca = () => notaConfianca(obterChecagens());

export interface Importacao {
  id: number;
  criadoEm: string;
  usuarioId: string | null;
  arquivo: string;
  totalFaturado: number;
  qtdNegocios: number;
  qtdNfs: number;
  qtdFatos: number;
  avisos: number;
  erros: number;
}
/** Histórico de cargas (tabela importacoes), mais recente primeiro. */
export async function obterImportacoes(): Promise<Importacao[]> {
  const { data, error } = await supabase
    .from("importacoes")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw error;
  const len = (j: unknown) => (Array.isArray(j) ? j.length : 0);
  return (data ?? []).map((x) => ({
    id: x.id,
    criadoEm: x.criado_em,
    usuarioId: x.usuario_id,
    arquivo: x.nome_arquivo ?? "—",
    totalFaturado: Number(x.total_faturado ?? 0),
    qtdNegocios: x.qtd_negocios ?? 0,
    qtdNfs: x.qtd_nfs ?? 0,
    qtdFatos: x.qtd_fatos ?? 0,
    avisos: len(x.avisos),
    erros: len(x.erros),
  }));
}

/** Avisos gravados na importação mais recente (para a tela de qualidade). */
export async function obterAvisosUltimaImportacao(): Promise<{ titulo: string; itens: string[] }[]> {
  const { data, error } = await supabase
    .from("importacoes")
    .select("avisos")
    .order("criado_em", { ascending: false })
    .limit(1);
  if (error) throw error;
  const a = data?.[0]?.avisos;
  return Array.isArray(a) ? (a as { titulo: string; itens: string[] }[]) : [];
}

// Fase 8 — snapshot imutável por carga, consumido por useDados()/useMetricas().
import type { Dados } from "./metricas";
let dadosSnapshot: Dados | null = null;
export function obterDados(): Dados {
  if (!dadosSnapshot) dadosSnapshot = { fatos, negocios, notas, clientes, cards: cardsLiberar };
  return dadosSnapshot;
}

// Fase 18 — visões salvas de relatórios (tabela visoes_salvas, RLS por usuário; compartilháveis).
export interface VisaoSalva {
  id: string;
  nome: string;
  filtros: Record<string, unknown>;
  configuracao: Record<string, unknown>;
  compartilhada: boolean;
  minha: boolean;
  criadoEm: string;
}
const CHAVE_LOCAL_VISOES = "controladoria.visoes_relatorio";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabelaVisoes = () => (supabase as any).from("visoes_salvas");
const locais = (): VisaoSalva[] => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LOCAL_VISOES) ?? "[]");
  } catch {
    return [];
  }
};
/** Lista visões próprias e compartilhadas. Se a tabela ainda não existir, usa o navegador. */
export async function listarVisoesSalvas(): Promise<{ visoes: VisaoSalva[]; local: boolean }> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await tabelaVisoes().select("*").order("criado_em", { ascending: false });
  if (error) return { visoes: locais(), local: true };
  return {
    local: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visoes: (data ?? []).map((x: any) => ({
      id: String(x.id),
      nome: String(x.nome),
      filtros: (x.filtros ?? {}) as Record<string, unknown>,
      configuracao: (x.configuracao ?? {}) as Record<string, unknown>,
      compartilhada: !!x.compartilhada,
      minha: x.usuario_id === u.user?.id,
      criadoEm: String(x.criado_em),
    })),
  };
}
export async function salvarVisaoRelatorio(
  v: Pick<VisaoSalva, "nome" | "filtros" | "configuracao" | "compartilhada">,
) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await tabelaVisoes().insert({ ...v, usuario_id: u.user?.id });
  if (error) {
    const xs = locais();
    xs.unshift({ ...v, id: crypto.randomUUID(), minha: true, criadoEm: new Date().toISOString() });
    localStorage.setItem(CHAVE_LOCAL_VISOES, JSON.stringify(xs));
  }
}
export async function removerVisaoRelatorio(id: string) {
  const { error } = await tabelaVisoes().delete().eq("id", id);
  if (error)
    localStorage.setItem(CHAVE_LOCAL_VISOES, JSON.stringify(locais().filter((x) => x.id !== id)));
}

// Fase 19 — papéis, usuários e auditoria (ver src/data/acesso.ts).
export * from "./acesso";
