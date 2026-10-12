// Fase 8 — camada única de métricas. Funções PURAS (dados + filtros → números),
// memoizadas por referência dos dados + chave dos filtros.
// Fonte prioritária: fato_mensal (Parte2). NFs/negócios (Parte1) para detalhe.
import type { Fato, CardLiberar } from "./repository";
import type { Cliente, Negocio, NotaFiscal } from "./tipos";
import type { FiltrosGlobais } from "@/lib/filtros";
import type { EtapaJornada } from "@/lib/glossario";
import { diasEntre, mesesDoAno } from "@/lib/periodo";
import { ALIAS_CLIENTES, chaveCliente } from "@/lib/aliasClientes";

export interface Dados {
  fatos: Fato[];
  negocios: Negocio[];
  notas: NotaFiscal[];
  clientes: Cliente[];
  cards: CardLiberar[];
}

export type Bloco =
  | "pipe"
  | "pipe_autorizado"
  | "fat_emissao"
  | "fat_competencia"
  | "recebimento"
  | "vencimento"
  | "custo_pagamento"
  | "custo_emissao"
  | "impostos"
  | "creditos"
  | "a_liberar";

export type Item = { chave: string; valor: number };

// ---------- memo ----------
const cache = new WeakMap<object, Map<string, unknown>>();
function memo<T>(dados: object, chave: string, fn: () => T): T {
  let m = cache.get(dados);
  if (!m) cache.set(dados, (m = new Map()));
  if (!m.has(chave)) m.set(chave, fn());
  return m.get(chave) as T;
}
const k = (nome: string, ...xs: unknown[]) => `${nome}|${JSON.stringify(xs)}`;

const soma = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0);
const mes7 = (d: string | undefined | null) => (d ? d.slice(0, 7) : "");
const noIntervalo = (m: string, f: FiltrosGlobais) => !!m && m >= f.de && m <= f.ate;

// ---------- filtros sobre fatos (Parte2) ----------
/** Com filtro de cliente/categoria usa o nível cliente; senão o nível produto (evita dupla contagem). */
export function fatosFiltrados(
  d: Dados,
  bloco: Bloco | Bloco[],
  f: FiltrosGlobais,
  comPeriodo = true,
  nivelForcado?: Fato["nivel"],
): Fato[] {
  const blocos = new Set(Array.isArray(bloco) ? bloco : [bloco]);
  const nivel = nivelForcado ?? (f.clientes.length || f.categoria ? "cliente" : "produto");
  const cl = new Set(f.clientes);
  return d.fatos.filter(
    (x) =>
      blocos.has(x.bloco as Bloco) &&
      x.nivel === nivel &&
      (!comPeriodo || (!x.anterior && noIntervalo(mes7(x.mes), f))) &&
      (!f.bu || x.bu === f.bu) &&
      (!f.produto || x.produto === f.produto) &&
      (!f.plataforma || x.plataforma === f.plataforma) &&
      (!f.contrato || x.contrato === f.contrato) &&
      (!f.categoria || x.categoria === f.categoria) &&
      (!cl.size || (x.cliente != null && cl.has(x.cliente))),
  );
}

// ---------- filtros sobre NFs (Parte1) ----------
export function dataPorRegime(n: NotaFiscal, r: FiltrosGlobais["regime"]): string {
  if (r === "emissao") return mes7(n.emissao);
  if (r === "vencimento") return mes7(n.vencimento);
  if (r === "recebimento") return mes7(n.dataPagamento);
  return n.competencia;
}
export function notasFiltradas(d: Dados, f: FiltrosGlobais, comPeriodo = true): NotaFiscal[] {
  return memo(d, k("nfs", f, comPeriodo), () => {
    const cat = new Map(d.clientes.map((c) => [c.id, c.categoria]));
    const neg = new Map(d.negocios.map((g) => [g.id, g]));
    const cl = new Set(f.clientes);
    return d.notas.filter(
      (n) =>
        (!comPeriodo || noIntervalo(dataPorRegime(n, f.regime), f)) &&
        (!f.bu || n.bu === f.bu) &&
        (!f.produto || n.card === f.produto) &&
        (!f.contrato || n.contrato === f.contrato) &&
        (!f.plataforma || neg.get(n.negocioId)?.plataforma === f.plataforma) &&
        (!f.categoria || cat.get(n.clienteId) === f.categoria) &&
        (!cl.size || cl.has(n.clienteId)),
    );
  });
}

/** Status recalculado na data de referência (simulações). */
export function statusNaData(n: Pick<NotaFiscal, "vencimento" | "dataPagamento">, corte: string) {
  if (n.dataPagamento && n.dataPagamento <= corte) return "pago" as const;
  return n.vencimento < corte ? ("atrasado" as const) : ("pendente" as const);
}

// ---------- cadeia do dinheiro ----------
export interface Cadeia {
  pipe: number;
  pipeAutorizado: number;
  aLiberar: number;
  faturadoEmissao: number;
  faturadoCompetencia: number;
  aVencer: number;
  vencido: number;
  recebido: number;
  custoPagamento: number;
  custoEmissao: number;
  impostos: number;
  creditos: number;
  margem: number;
  /** Margem ainda sem regra confirmada (Fase 16 refina). */
  margemNecessitaValidacao: true;
}
export function cadeiaDoDinheiro(d: Dados, f: FiltrosGlobais): Cadeia {
  return memo(d, k("cadeia", f), () => {
    const b = (x: Bloco) => soma(fatosFiltrados(d, x, f));
    const abertas = notasFiltradas(d, f).filter((n) => statusNaData(n, f.dataReferencia) !== "pago");
    const faturadoCompetencia = b("fat_competencia");
    const custoPagamento = b("custo_pagamento");
    const impostos = b("impostos");
    const creditos = b("creditos");
    return {
      pipe: b("pipe"),
      pipeAutorizado: b("pipe_autorizado"),
      aLiberar: b("a_liberar"),
      faturadoEmissao: b("fat_emissao"),
      faturadoCompetencia,
      aVencer: soma(abertas.filter((n) => n.vencimento >= f.dataReferencia)),
      vencido: soma(abertas.filter((n) => n.vencimento < f.dataReferencia)),
      recebido: b("recebimento"),
      custoPagamento,
      custoEmissao: b("custo_emissao"),
      impostos,
      creditos,
      margem: margem(faturadoCompetencia, custoPagamento, impostos, creditos),
      margemNecessitaValidacao: true,
    };
  });
}
/** Margem = Faturado (competência) − Custos − Impostos + Créditos. Necessita validação. */
export const margem = (fat: number, custos: number, impostos: number, creditos: number) =>
  fat - custos - impostos + creditos;

// ---------- séries e quebras ----------
/** Série de 12 meses do ano-base (chaves AAAA-MM; bucket anterior nunca cai em "dez"). */
export function serieMensal(d: Dados, bloco: Bloco, f: FiltrosGlobais, ano?: number): Item[] {
  return memo(d, k("serie", bloco, f, ano), () => {
    const m = new Map<string, number>();
    for (const x of fatosFiltrados(d, bloco, f, false)) {
      if (x.anterior) continue;
      const c = mes7(x.mes);
      m.set(c, (m.get(c) ?? 0) + x.valor);
    }
    return mesesDoAno(ano).map((chave) => ({ chave, valor: m.get(chave) ?? 0 }));
  });
}
function agrupar(xs: Fato[], chave: (x: Fato) => string | null): Item[] {
  const m = new Map<string, number>();
  for (const x of xs) {
    const c = chave(x) ?? "—";
    m.set(c, (m.get(c) ?? 0) + x.valor);
  }
  return [...m].map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor);
}
export const porBU = (d: Dados, bloco: Bloco, f: FiltrosGlobais) =>
  memo(d, k("bu", bloco, f), () => agrupar(fatosFiltrados(d, bloco, f), (x) => x.bu));
export const porProduto = (d: Dados, bloco: Bloco, f: FiltrosGlobais) =>
  memo(d, k("prod", bloco, f), () => agrupar(fatosFiltrados(d, bloco, f), (x) => x.produto));
/** Por cliente sempre usa o nível cliente da Parte2. */
export const porCliente = (d: Dados, bloco: Bloco, f: FiltrosGlobais) =>
  memo(d, k("cli", bloco, f), () =>
    agrupar(fatosFiltrados(d, bloco, f, true, "cliente"), (x) => x.cliente),
  );

export const topN = (xs: Item[], n = 5) => [...xs].sort((a, b) => b.valor - a.valor).slice(0, n);

export type ItemABC = Item & { participacao: number; acumulado: number; classe: "A" | "B" | "C" };
/** Curva ABC: A até 80% acumulado, B até 95%, C o restante. */
export function curvaABC(xs: Item[]): ItemABC[] {
  const ord = [...xs].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = soma(ord) || 1;
  let acc = 0;
  return ord.map((x) => {
    const antes = acc;
    acc += x.valor / total;
    const classe = antes < 0.8 ? "A" : antes < 0.95 ? "B" : "C";
    return { ...x, participacao: x.valor / total, acumulado: acc, classe };
  });
}

// ---------- aging e projeção ----------
export const FAIXAS_AGING = ["A vencer", "1–30", "31–60", "61–90", ">90"] as const;
export function faixaAging(vencimento: string, corte: string): (typeof FAIXAS_AGING)[number] {
  const dias = diasEntre(vencimento, corte);
  if (dias <= 0) return "A vencer";
  if (dias <= 30) return "1–30";
  if (dias <= 60) return "31–60";
  if (dias <= 90) return "61–90";
  return ">90";
}
/** Aging das NFs em aberto na data de referência (independe do período). */
export function aging(
  d: Dados,
  f: FiltrosGlobais,
): { faixa: string; valor: number; qtd: number }[] {
  return memo(d, k("aging", f), () => {
    const abertas = notasFiltradas(d, f, false).filter(
      (n) => statusNaData(n, f.dataReferencia) !== "pago",
    );
    return FAIXAS_AGING.map((faixa) => {
      const xs = abertas.filter((n) => faixaAging(n.vencimento, f.dataReferencia) === faixa);
      return { faixa, valor: soma(xs), qtd: xs.length };
    });
  });
}
/** Projeção de caixa: entradas (NFs abertas por mês de vencimento) − saídas (custos por pagamento), a partir da data de referência. */
export function projecaoCaixa(d: Dados, f: FiltrosGlobais, meses = 6) {
  return memo(d, k("proj", f, meses), () => {
    const inicio = mes7(f.dataReferencia);
    const lista: string[] = [];
    const [a, m] = inicio.split("-").map(Number) as [number, number];
    for (let i = 0; i < meses; i++) {
      const dt = new Date(a, m - 1 + i, 1);
      lista.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
    }
    const abertas = notasFiltradas(d, f, false).filter(
      (n) => statusNaData(n, f.dataReferencia) !== "pago",
    );
    const custos = fatosFiltrados(d, "custo_pagamento", f, false).filter((x) => !x.anterior);
    let saldo = 0;
    return lista.map((mes) => {
      // vencidas entram no primeiro mês
      const entradas = soma(
        abertas.filter((n) =>
          mes === inicio ? mes7(n.vencimento) <= mes : mes7(n.vencimento) === mes,
        ),
      );
      const saidas = soma(custos.filter((x) => mes7(x.mes) === mes));
      saldo += entradas - saidas;
      return { mes, entradas, saidas, saldo };
    });
  });
}

// ---------- Fase 9 — Dashboard executivo ----------
/** Bloco de faturamento conforme o regime escolhido (vencimento/recebimento usam competência). */
export const blocoFaturado = (r: FiltrosGlobais["regime"]): Bloco =>
  r === "emissao" ? "fat_emissao" : "fat_competencia";

/** Variação do mês `ref` vs mês anterior na série (null se não houver base). */
export function variacaoMensal(serie: Item[], ref: string): number | null {
  const i = serie.findIndex((x) => x.chave === ref);
  if (i <= 0) return null;
  const ant = serie[i - 1]!.valor;
  if (!ant) return null;
  return (serie[i]!.valor - ant) / Math.abs(ant);
}

/** Acumula uma série mês a mês. */
export function acumular(serie: Item[]): Item[] {
  let acc = 0;
  return serie.map((x) => ({ chave: x.chave, valor: (acc += x.valor) }));
}

/** Séries de 12 meses de NFs em aberto na data de referência, por mês de vencimento. */
export function serieAbertas(d: Dados, f: FiltrosGlobais, ano?: number) {
  return memo(d, k("abertas", f, ano), () => {
    const meses = mesesDoAno(ano);
    const abertas = notasFiltradas(d, f, false).filter(
      (n) => statusNaData(n, f.dataReferencia) !== "pago",
    );
    const aVencer = meses.map((chave) => ({
      chave,
      valor: soma(
        abertas.filter((n) => n.vencimento >= f.dataReferencia && mes7(n.vencimento) === chave),
      ),
    }));
    const vencido = meses.map((chave) => ({
      chave,
      valor: soma(
        abertas.filter((n) => n.vencimento < f.dataReferencia && mes7(n.vencimento) === chave),
      ),
    }));
    return { aVencer, vencido };
  });
}

/** Série mensal da margem estimada (Necessita validação). */
export function serieMargem(d: Dados, f: FiltrosGlobais, ano?: number): Item[] {
  const fat = serieMensal(d, "fat_competencia", f, ano);
  const cu = serieMensal(d, "custo_pagamento", f, ano);
  const im = serieMensal(d, "impostos", f, ano);
  const cr = serieMensal(d, "creditos", f, ano);
  return fat.map((x, i) => ({
    chave: x.chave,
    valor: margem(x.valor, cu[i]!.valor, im[i]!.valor, cr[i]!.valor),
  }));
}

/** Faturado agrupado BU → produto (para barras empilhadas). */
export function porBUProduto(d: Dados, bloco: Bloco, f: FiltrosGlobais) {
  return memo(d, k("buprod", bloco, f), () => {
    const m = new Map<string, Map<string, number>>();
    for (const x of fatosFiltrados(d, bloco, f)) {
      const bu = x.bu ?? "—";
      const p = x.produto ?? "—";
      if (!m.has(bu)) m.set(bu, new Map());
      const mm = m.get(bu)!;
      mm.set(p, (mm.get(p) ?? 0) + x.valor);
    }
    return [...m].map(([bu, mm]) => ({
      bu,
      produtos: Object.fromEntries(mm) as Record<string, number>,
    }));
  });
}

/** Faturado por categoria de cliente (nível cliente da Parte2). */
export const porCategoria = (d: Dados, bloco: Bloco, f: FiltrosGlobais) =>
  memo(d, k("cat", bloco, f), () =>
    agrupar(fatosFiltrados(d, bloco, f, true, "cliente"), (x) => x.categoria),
  );

/** Etapas da jornada resumida com % de conversão vs etapa anterior. */
export function etapasJornada(c: Cadeia, faturado: number) {
  const xs = [
    { etapa: "Pipe", valor: c.pipe },
    { etapa: "Autorizado", valor: c.pipeAutorizado },
    { etapa: "Faturado", valor: faturado },
    { etapa: "Vencido + A vencer", valor: c.vencido + c.aVencer },
    { etapa: "Recebido", valor: c.recebido },
  ];
  return xs.map((x, i) => ({
    ...x,
    conversao: i === 0 ? null : xs[i - 1]!.valor ? x.valor / xs[i - 1]!.valor : null,
  }));
}

// Limiares dos alertas — Necessita validação (sem regra confirmada).
export const LIMIARES_ALERTA = {
  diasAtrasoCritico: 30,
  cardsLiberarValor: 50_000,
  toleranciaPipeFaturado: 0.05,
};
export type Destino = "/recebiveis" | "/pipe-x-faturado" | "/qualidade" | "/faturamento";
export interface Alerta {
  id: string;
  prioridade: 1 | 2 | 3; // 1 = crítico
  titulo: string;
  detalhe: string;
  valor?: number;
  destino: Destino;
}
/** Alertas por regras, ordenados por prioridade e valor. */
export function alertas(
  d: Dados,
  f: FiltrosGlobais,
  checagens: { severidade: string; titulo: string }[],
  lim = LIMIARES_ALERTA,
): Alerta[] {
  const out: Alerta[] = [];
  const abertas = notasFiltradas(d, f, false).filter(
    (n) => statusNaData(n, f.dataReferencia) !== "pago",
  );
  const criticas = abertas.filter(
    (n) => diasEntre(n.vencimento, f.dataReferencia) > lim.diasAtrasoCritico,
  );
  if (criticas.length)
    out.push({
      id: "nf-atraso",
      prioridade: 1,
      titulo: `${criticas.length} NF(s) vencida(s) há mais de ${lim.diasAtrasoCritico} dias`,
      detalhe: "Recebíveis em atraso crítico",
      valor: soma(criticas),
      destino: "/recebiveis",
    });
  const erros = checagens.filter((c) => c.severidade === "erro");
  if (erros.length)
    out.push({
      id: "qualidade",
      prioridade: 1,
      titulo: `${erros.length} checagem(ns) de qualidade com erro`,
      detalhe: erros
        .slice(0, 3)
        .map((c) => c.titulo)
        .join(" · "),
      destino: "/qualidade",
    });
  const cards = d.cards.filter(
    (c) => c.valor > lim.cardsLiberarValor && (!f.categoria || c.categoria === f.categoria),
  );
  if (cards.length)
    out.push({
      id: "cards",
      prioridade: 2,
      titulo: `${cards.length} card(s) a liberar acima de ${lim.cardsLiberarValor.toLocaleString("pt-BR")}`,
      detalhe: "Valores aguardando liberação para faturamento",
      valor: soma(cards),
      destino: "/faturamento",
    });
  const pipe = soma(fatosFiltrados(d, "pipe", f));
  const fat = soma(fatosFiltrados(d, blocoFaturado(f.regime), f));
  if (pipe && Math.abs(pipe - fat) / pipe > lim.toleranciaPipeFaturado)
    out.push({
      id: "pipe-fat",
      prioridade: 2,
      titulo: "Diferença Pipe × Faturado fora da tolerância",
      detalhe: `Diferença de ${(((pipe - fat) / pipe) * 100).toFixed(1).replace(".", ",")}% (tolerância ${lim.toleranciaPipeFaturado * 100}%)`,
      valor: pipe - fat,
      destino: "/pipe-x-faturado",
    });
  const naoLoc = fatosFiltrados(d, blocoFaturado(f.regime), f).filter(
    (x) => /n[ãa]o localizado/i.test(x.produto ?? "") && x.valor !== 0,
  );
  if (naoLoc.length)
    out.push({
      id: "nao-localizado",
      prioridade: 3,
      titulo: 'Produto "Não Localizado" com valor',
      detalhe: `${naoLoc.length} lançamento(s) sem produto identificado`,
      valor: soma(naoLoc),
      destino: "/qualidade",
    });
  return out.sort(
    (a, b) => a.prioridade - b.prioridade || Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0),
  );
}

// ---------- Fase 10 — Jornada do Dinheiro ----------

export type TipoEscopo = "total" | "bu" | "produto" | "cliente";
/** Aplica o escopo da Jornada sobre os filtros globais. */
export function aplicarEscopo(f: FiltrosGlobais, tipo: TipoEscopo, valor: string): FiltrosGlobais {
  if (tipo === "total" || !valor) return f;
  if (tipo === "bu") return { ...f, bu: valor };
  if (tipo === "produto") return { ...f, produto: valor };
  return { ...f, clientes: [valor] };
}

/** Etapas que viram blocos (margem é derivada). */
export const ETAPAS_BLOCO: (EtapaJornada & Bloco)[] = [
  "pipe",
  "pipe_autorizado",
  "a_liberar",
  "fat_emissao",
  "fat_competencia",
  "vencimento",
  "recebimento",
  "custo_pagamento",
  "custo_emissao",
  "impostos",
  "creditos",
];

export type TipoBarra = "nivel" | "negativa" | "positiva" | "info" | "total";
export interface BarraCascata {
  etapa: EtapaJornada;
  valor: number;
  /** base e topo (para barras flutuantes). */
  de: number;
  ate: number;
  tipo: TipoBarra;
  conversao: number | null;
}
/**
 * Cascata: etapas de fluxo são níveis (com % de conversão vs etapa anterior);
 * a partir do Faturado por competência descontam Custos (pagamento) e Impostos,
 * somam Créditos e terminam na Margem. Custos por emissão = informativo.
 */
export function cascata(d: Dados, f: FiltrosGlobais): BarraCascata[] {
  return memo(d, k("cascata", f), () => {
    const b = (x: Bloco) => soma(fatosFiltrados(d, x, f));
    const v = Object.fromEntries(ETAPAS_BLOCO.map((e) => [e, b(e)])) as Record<Bloco, number>;
    const out: BarraCascata[] = [];
    const niveis: EtapaJornada[] = [
      "pipe",
      "pipe_autorizado",
      "a_liberar",
      "fat_emissao",
      "fat_competencia",
      "vencimento",
      "recebimento",
    ];
    let ant: number | null = null;
    for (const e of niveis) {
      const valor = v[e as Bloco];
      const conv = e === "a_liberar" ? null : ant ? valor / ant : null;
      out.push({ etapa: e, valor, de: 0, ate: valor, tipo: "nivel", conversao: conv });
      if (e !== "a_liberar") ant = valor;
    }
    let run = v.fat_competencia;
    const passo = (e: EtapaJornada, delta: number, tipo: TipoBarra) => {
      out.push({
        etapa: e,
        valor: delta,
        de: Math.min(run, run + delta),
        ate: Math.max(run, run + delta),
        tipo,
        conversao: v.fat_competencia ? Math.abs(delta) / v.fat_competencia : null,
      });
      run += delta;
    };
    passo("custo_pagamento", -v.custo_pagamento, "negativa");
    out.push({
      etapa: "custo_emissao",
      valor: -v.custo_emissao,
      de: Math.max(0, run),
      ate: Math.max(0, run) + v.custo_emissao,
      tipo: "info",
      conversao: v.fat_competencia ? v.custo_emissao / v.fat_competencia : null,
    });
    passo("impostos", -v.impostos, "negativa");
    passo("creditos", v.creditos, "positiva");
    out.push({
      etapa: "margem",
      valor: run,
      de: Math.min(0, run),
      ate: Math.max(0, run),
      tipo: "total",
      conversao: v.fat_competencia ? run / v.fat_competencia : null,
    });
    return out;
  });
}

/** Tolerância do mapa de calor — Necessita validação. */
export const TOLERANCIA_JORNADA = { percentual: 0.05, minimo: 1000 };
const PARES_COMPARACAO: [Bloco, Bloco][] = [
  ["fat_competencia", "pipe_autorizado"],
  ["recebimento", "vencimento"],
];
export interface LinhaCalor {
  etapa: Bloco;
  valores: Item[];
  alerta: boolean[];
}
/** Mapa Mês × Etapa (12 meses do ano-base, ignora o período), com destaque acima da tolerância. */
export function mapaCalor(d: Dados, f: FiltrosGlobais, ano?: number): LinhaCalor[] {
  return memo(d, k("calor", f, ano), () => {
    const linhas = ETAPAS_BLOCO.map((etapa) => ({
      etapa,
      valores: serieMensal(d, etapa, f, ano),
      alerta: [] as boolean[],
    }));
    const por = new Map(linhas.map((l) => [l.etapa, l]));
    for (const l of linhas) {
      const par = PARES_COMPARACAO.find((p) => p[0] === l.etapa);
      l.alerta = l.valores.map((x, i) => {
        if (!par) return false;
        const ref = por.get(par[1])!.valores[i]!.valor;
        const dif = Math.abs(x.valor - ref);
        return (
          dif > TOLERANCIA_JORNADA.minimo && dif > Math.abs(ref) * TOLERANCIA_JORNADA.percentual
        );
      });
    }
    return linhas;
  });
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export interface Defasagens {
  emissaoVencimento: number | null;
  vencimentoRecebimento: number | null;
  emissaoRecebimento: number | null;
  qtdNFs: number;
  qtdPagas: number;
  /** Defasagem estimada (meses) custo por emissão → custo por pagamento. */
  custoMeses: number | null;
  custoErro: number | null;
}
/** Tempos médios nas NFs + melhor deslocamento (0–4 meses) entre custos por emissão e por pagamento. */
export function defasagens(d: Dados, f: FiltrosGlobais): Defasagens {
  return memo(d, k("defas", f), () => {
    const nfs = notasFiltradas(d, f).filter((n) => n.emissao && n.vencimento);
    const pagas = nfs.filter((n) => n.dataPagamento);
    const mapa = (b: Bloco) => {
      const m = new Map<string, number>();
      for (const x of fatosFiltrados(d, b, f, false))
        if (!x.anterior) m.set(mes7(x.mes), (m.get(mes7(x.mes)) ?? 0) + x.valor);
      return m;
    };
    const emi = mapa("custo_emissao"),
      pag = mapa("custo_pagamento");
    const desloca = (m: string, n: number) => {
      const [a, mm] = m.split("-").map(Number) as [number, number];
      const dt = new Date(a, mm - 1 + n, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    };
    let melhor: { l: number; e: number } | null = null;
    const totEmi = [...emi.values()].reduce((a, b) => a + Math.abs(b), 0);
    if (totEmi > 0 && pag.size) {
      for (let l = 0; l <= 4; l++) {
        let e = 0;
        for (const [m, v] of emi) e += Math.abs(v - (pag.get(desloca(m, l)) ?? 0));
        if (!melhor || e < melhor.e) melhor = { l, e };
      }
    }
    return {
      emissaoVencimento: media(nfs.map((n) => diasEntre(n.emissao, n.vencimento))),
      vencimentoRecebimento: media(pagas.map((n) => diasEntre(n.vencimento, n.dataPagamento!))),
      emissaoRecebimento: media(pagas.map((n) => diasEntre(n.emissao, n.dataPagamento!))),
      qtdNFs: nfs.length,
      qtdPagas: pagas.length,
      custoMeses: melhor?.l ?? null,
      custoErro: melhor ? melhor.e / totEmi : null,
    };
  });
}

export interface DiferencasJornada {
  pipeXFaturado: number; // Faturado competência − Pipe autorizado (só ano-base, sem bucket anterior)
  vencXReceb: number; // Recebimento − Vencimento (negativo = ainda não recebido)
  recebidoMenosCustos: number; // hipótese da planilha — Necessita validação
}
export function diferencasJornada(d: Dados, f: FiltrosGlobais, ano: number): DiferencasJornada {
  return memo(d, k("difs", f, ano), () => {
    const b = (x: Bloco, soAno = false) =>
      soma(fatosFiltrados(d, x, f).filter((y) => !soAno || y.mes.startsWith(String(ano))));
    return {
      pipeXFaturado: b("fat_competencia", true) - b("pipe_autorizado", true),
      vencXReceb: b("recebimento") - b("vencimento"),
      recebidoMenosCustos: b("recebimento") - b("custo_pagamento"),
    };
  });
}

/** Drill-down: BU × produto de um bloco (opcionalmente um mês). */
export function drillBUProduto(d: Dados, bloco: Bloco, f: FiltrosGlobais, mes?: string) {
  const ff = mes ? { ...f, de: mes, ate: mes } : f;
  return memo(d, k("drillbp", bloco, ff), () => {
    const m = new Map<string, { bu: string; produto: string; valor: number }>();
    for (const x of fatosFiltrados(d, bloco, ff)) {
      const key = `${x.bu ?? "—"}|${x.produto ?? "—"}`;
      const it = m.get(key) ?? { bu: x.bu ?? "—", produto: x.produto ?? "—", valor: 0 };
      it.valor += x.valor;
      m.set(key, it);
    }
    return [...m.values()]
      .filter((x) => x.valor !== 0)
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  });
}
/** Drill-down: clientes (nível cliente da Parte2) de um bloco/BU/produto. */
export function drillClientes(
  d: Dados,
  bloco: Bloco,
  f: FiltrosGlobais,
  bu: string,
  produto: string,
  mes?: string,
) {
  const ff = {
    ...f,
    ...(mes ? { de: mes, ate: mes } : {}),
    bu: bu === "—" ? f.bu : bu,
    produto: produto === "—" ? f.produto : produto,
  };
  return agrupar(fatosFiltrados(d, bloco, ff, true, "cliente"), (x) => x.cliente).filter(
    (x) => x.valor !== 0,
  );
}

/** "Explicar com palavras" — resumo por regras, sem IA. */
export function explicarJornada(
  d: Dados,
  f: FiltrosGlobais,
  ano: number,
  rotuloPeriodo: string,
  brl: (n: number) => string,
): string {
  const c = cascata(d, f);
  const v = (e: EtapaJornada) => c.find((x) => x.etapa === e)?.valor ?? 0;
  if (c.every((x) => x.valor === 0)) return `Não há valores para ${rotuloPeriodo} neste escopo.`;
  const dif = diferencasJornada(d, f, ano);
  const partes: string[] = [];
  partes.push(
    `Em ${rotuloPeriodo}, o Pipe somou ${brl(v("pipe"))}, dos quais ${brl(v("pipe_autorizado"))} foram autorizados para emissão.`,
  );
  if (dif.pipeXFaturado !== 0) {
    const bp = drillBUProduto(d, "fat_competencia", f).map((x) => ({ ...x }));
    const aut = new Map(
      drillBUProduto(d, "pipe_autorizado", f).map((x) => [`${x.bu}|${x.produto}`, x.valor]),
    );
    const gaps = bp.map((x) => ({
      p: x.produto,
      g: x.valor - (aut.get(`${x.bu}|${x.produto}`) ?? 0),
    }));
    for (const [key, val] of aut)
      if (!bp.some((x) => `${x.bu}|${x.produto}` === key))
        gaps.push({ p: key.split("|")[1]!, g: -val });
    const sinal = dif.pipeXFaturado < 0;
    const top = gaps
      .filter((x) => (sinal ? x.g < 0 : x.g > 0))
      .sort((a, b) => Math.abs(b.g) - Math.abs(a.g))[0];
    partes.push(
      `O faturado por competência ficou ${brl(Math.abs(dif.pipeXFaturado))} ${sinal ? "abaixo" : "acima"} do Pipe autorizado` +
        (top ? `, concentrado em ${top.p} (${brl(Math.abs(top.g))}).` : "."),
    );
  }
  if (v("a_liberar")) partes.push(`Há ${brl(v("a_liberar"))} em cards a liberar.`);
  partes.push(
    dif.vencXReceb < 0
      ? `Do que venceu, ${brl(Math.abs(dif.vencXReceb))} ainda não foi recebido.`
      : `Os recebimentos superaram os vencimentos em ${brl(dif.vencXReceb)}.`,
  );
  const fat = v("fat_competencia");
  const mg = v("margem");
  partes.push(
    `Após custos (${brl(Math.abs(v("custo_pagamento")))}), impostos (${brl(Math.abs(v("impostos")))}) e créditos (${brl(v("creditos"))}), a margem estimada é ${brl(mg)}` +
      (fat
        ? ` (${((mg / fat) * 100).toFixed(1).replace(".", ",")}% do faturado) — necessita validação.`
        : " — necessita validação."),
  );
  return partes.join(" ");
}

// ---------- Fase 11 — Negócios (Pipe) e Cards a liberar ----------
/** Limiares do semáforo "Sem NF" (dias desde "ganho em"). */
export const SEMAFORO_SEM_NF = { verde: 15, amarelo: 45 };
export type TomSemaforo = "success" | "warning" | "danger";
export const tomSemaforo = (dias: number): TomSemaforo =>
  dias < SEMAFORO_SEM_NF.verde ? "success" : dias < SEMAFORO_SEM_NF.amarelo ? "warning" : "danger";

/** Negócios filtrados pelos filtros globais; período pelo mês de "ganho em". */
export function negociosFiltrados(d: Dados, f: FiltrosGlobais, comPeriodo = true): Negocio[] {
  return memo(d, k("negs", f, comPeriodo), () => {
    const cat = new Map(d.clientes.map((c) => [c.id, c.categoria]));
    const cl = new Set(f.clientes);
    return d.negocios.filter(
      (n) =>
        (!comPeriodo || noIntervalo(mes7(n.ganhoEm) || n.competencia, f)) &&
        (!f.bu || n.bu === f.bu) &&
        (!f.produto || n.produto === f.produto) &&
        (!f.plataforma || n.plataforma === f.plataforma) &&
        (!f.contrato || n.contrato === f.contrato) &&
        (!f.categoria || cat.get(n.clienteId) === f.categoria) &&
        (!cl.size || cl.has(n.clienteId)),
    );
  });
}

/** NFs por negócio (id_pipe; a coluna "NF:" já preenche id_pipe na importação). */
export function nfsPorNegocio(d: Dados): Map<string, NotaFiscal[]> {
  return memo(d, "nfsPorNeg", () => {
    const m = new Map<string, NotaFiscal[]>();
    for (const n of d.notas)
      if (n.negocioId) (m.get(n.negocioId) ?? m.set(n.negocioId, []).get(n.negocioId)!).push(n);
    return m;
  });
}

export interface KpisNegocios {
  pipe: number;
  autorizado: number;
  aLiberar: number;
  cards: number;
  ticketMedio: number;
  pctAutorizado: number;
}
export function kpisNegocios(d: Dados, f: FiltrosGlobais): KpisNegocios {
  const ns = negociosFiltrados(d, f);
  const pipe = soma(ns),
    autorizado = soma(ns.filter((n) => n.autorizada));
  return {
    pipe,
    autorizado,
    aLiberar: pipe - autorizado,
    cards: ns.length,
    ticketMedio: ns.length ? pipe / ns.length : 0,
    pctAutorizado: pipe ? autorizado / pipe : 0,
  };
}

/** Cards a liberar (Parte2 col. E) com filtros globais (sem período: é posição). */
export function cardsLiberarFiltrados(d: Dados, f: FiltrosGlobais): CardLiberar[] {
  const cl = new Set(f.clientes);
  const bu = (p: string) => (/GA4|GA360|ANALYTICS/i.test(p) ? "Analytics" : "Advertising");
  return d.cards.filter(
    (c) =>
      c.valor !== 0 &&
      (!f.bu || bu(c.produto + c.plataforma) === f.bu) &&
      (!f.produto || c.produto === f.produto) &&
      (!f.plataforma || c.plataforma === f.plataforma) &&
      (!f.contrato || c.contrato === f.contrato) &&
      (!f.categoria || c.categoria === f.categoria) &&
      (!cl.size || cl.has(c.cliente)),
  );
}
export const agruparPor = <T>(
  xs: T[],
  chave: (x: T) => string,
  valor: (x: T) => number,
): Item[] => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return [...m].map(([c, v]) => ({ chave: c || "—", valor: v })).sort((a, b) => b.valor - a.valor);
};

/** Valor AF22 (Parte2, "Á liberar" na coluna AF linha 22) entre os controles importados. */
export function controleAF22(ctl: { descricao: string; valorPlanilha: number }[]): number | null {
  const c =
    ctl.find((x) => /^Linha 22 AF:/.test(x.descricao)) ??
    ctl.find((x) => /\bAF22\b/.test(x.descricao));
  return c ? c.valorPlanilha : null;
}

export interface LinhaSemNF {
  negocio: Negocio;
  dias: number;
  tom: TomSemaforo;
}
/** Autorizados sem nenhuma NF vinculada — possível atraso de faturamento. */
export function negociosSemNF(d: Dados, f: FiltrosGlobais): LinhaSemNF[] {
  const porNeg = nfsPorNegocio(d);
  return negociosFiltrados(d, f)
    .filter((n) => n.autorizada && !porNeg.get(n.id)?.length)
    .map((n) => {
      const dias = n.ganhoEm ? Math.max(0, diasEntre(n.ganhoEm.slice(0, 10), f.dataReferencia)) : 0;
      return { negocio: n, dias, tom: tomSemaforo(dias) };
    })
    .sort((a, b) => b.dias - a.dias);
}

/** Pipe × autorizado por mês (Parte2). */
export function seriePipeAutorizado(d: Dados, f: FiltrosGlobais) {
  const p = serieMensal(d, "pipe", f),
    a = serieMensal(d, "pipe_autorizado", f);
  return p.map((x, i) => ({ mes: x.chave, pipe: x.valor, autorizado: a[i]?.valor ?? 0 }));
}

// ---------- Fase 12: Faturamento (NFs) ----------
export type RegimeFat = "competencia" | "emissao";
export const blocoRegimeFat = (r: RegimeFat): Bloco =>
  r === "emissao" ? "fat_emissao" : "fat_competencia";
export const regimeFatPadrao = (r: FiltrosGlobais["regime"]): RegimeFat =>
  r === "emissao" ? "emissao" : "competencia";
const mesNF = (n: NotaFiscal, r: RegimeFat) => (r === "emissao" ? mes7(n.emissao) : n.competencia);
const anoDe = (f: FiltrosGlobais) => Number(f.ate.slice(0, 4));

/** NFs do período no regime escolhido (bucket anterior ao ano-base fica de fora). */
export function notasFaturamento(d: Dados, f: FiltrosGlobais, r: RegimeFat): NotaFiscal[] {
  return notasFiltradas(d, { ...f, regime: r });
}
export interface KpisFaturamento {
  faturado: number;
  qtd: number;
  ticketMedio: number;
  maior: number;
  acumuladoAno: number;
  anterior: { valor: number; qtd: number };
}
export function kpisFaturamento(d: Dados, f: FiltrosGlobais, r: RegimeFat): KpisFaturamento {
  return memo(d, k("kfat", f, r), () => {
    const ano = anoDe(f);
    const inicio = `${ano}-01`;
    const xs = notasFaturamento(d, f, r).filter((n) => mesNF(n, r) >= inicio);
    const todas = notasFiltradas(d, { ...f, regime: r }, false);
    const acum = todas.filter((n) => {
      const m = mesNF(n, r);
      return m >= inicio && m <= f.ate;
    });
    const ant = todas.filter((n) => {
      const m = mesNF(n, r);
      return !!m && m < inicio;
    });
    const total = soma(xs);
    return {
      faturado: total,
      qtd: xs.length,
      ticketMedio: xs.length ? total / xs.length : 0,
      maior: xs.reduce((a, n) => Math.max(a, n.valor), 0),
      acumuladoAno: soma(acum),
      anterior: { valor: soma(ant), qtd: ant.length },
    };
  });
}
/** Série mensal (Parte 2) empilhada por BU ou produto. */
export function serieFaturadoEmpilhada(
  d: Dados,
  f: FiltrosGlobais,
  r: RegimeFat,
  por: "bu" | "produto",
) {
  return memo(d, k("fatemp", f, r, por), () => {
    const meses = mesesDoAno(anoDe(f));
    const grupos = new Set<string>();
    const m = new Map<string, Record<string, number>>();
    for (const x of fatosFiltrados(d, blocoRegimeFat(r), f, false)) {
      if (x.anterior) continue;
      const g = (por === "bu" ? x.bu : x.produto) ?? "—";
      grupos.add(g);
      const o = (m.get(mes7(x.mes)) ?? {}) as Record<string, number>;
      o[g] = (o[g] ?? 0) + x.valor;
      m.set(mes7(x.mes), o);
    }
    const aut = serieMensal(d, "pipe_autorizado", f, anoDe(f));
    return {
      grupos: [...grupos].sort(),
      linhas: meses.map((mes, i) => ({
        mes,
        ...(m.get(mes) ?? {}),
        autorizado: aut[i]?.valor ?? 0,
      })) as ({ mes: string; autorizado: number } & Record<string, number>)[],
    };
  });
}
export interface LinhaMatriz {
  chave: string;
  valores: Item[];
  total: number;
}
/** Matriz dimensão × mês (Parte 2). Cliente: top N + "Outros". */
export function matrizFaturado(
  d: Dados,
  f: FiltrosGlobais,
  r: RegimeFat,
  dim: "produto" | "cliente",
  top = 20,
): LinhaMatriz[] {
  return memo(d, k("matriz", f, r, dim, top), () => {
    const meses = mesesDoAno(anoDe(f));
    const xs = fatosFiltrados(
      d,
      blocoRegimeFat(r),
      f,
      false,
      dim === "cliente" ? "cliente" : undefined,
    ).filter((x) => !x.anterior);
    const m = new Map<string, Map<string, number>>();
    for (const x of xs) {
      const c = (dim === "cliente" ? x.cliente : x.produto) ?? "—";
      const mm = m.get(c) ?? new Map<string, number>();
      mm.set(mes7(x.mes), (mm.get(mes7(x.mes)) ?? 0) + x.valor);
      m.set(c, mm);
    }
    let linhas: LinhaMatriz[] = [...m]
      .map(([chave, mm]) => {
        const valores = meses.map((mes) => ({ chave: mes, valor: mm.get(mes) ?? 0 }));
        return { chave, valores, total: soma(valores) };
      })
      .sort((a, b) => b.total - a.total);
    if (dim === "cliente" && linhas.length > top) {
      const resto = linhas.slice(top);
      const valores = meses.map((mes, i) => ({
        chave: mes,
        valor: resto.reduce((a, l) => a + (l.valores[i]?.valor ?? 0), 0),
      }));
      linhas = [...linhas.slice(0, top), { chave: "Outros", valores, total: soma(valores) }];
    }
    return linhas;
  });
}
/** Conferência NFs (Parte 1) × bloco da Parte 2 no período. */
export function conferenciaFaturado(d: Dados, f: FiltrosGlobais, r: RegimeFat) {
  const nfs = kpisFaturamento(d, f, r).faturado;
  const p2 = soma(fatosFiltrados(d, blocoRegimeFat(r), f));
  return { nfs, parte2: p2, diferenca: nfs - p2, diverge: Math.abs(nfs - p2) > 0.01 };
}
/** Dias de atraso (+) ou antecipação (−) em relação ao vencimento. Aberta e vencida: até a data de referência. */
export function diasAtrasoNF(
  n: Pick<NotaFiscal, "vencimento" | "dataPagamento">,
  corte: string,
): number | null {
  if (!n.vencimento) return null;
  if (n.dataPagamento) return diasEntre(n.vencimento, n.dataPagamento);
  const dd = diasEntre(n.vencimento, corte);
  return dd > 0 ? dd : null;
}
export type MotivoPendenciaNF = "sem_negocio" | "sem_cliente" | "cliente_inferido";
export function nfsComPendencia(
  d: Dados,
  f: FiltrosGlobais,
): { nota: NotaFiscal; motivo: MotivoPendenciaNF }[] {
  const ids = new Set(d.negocios.map((n) => n.id));
  const out: { nota: NotaFiscal; motivo: MotivoPendenciaNF }[] = [];
  for (const n of notasFiltradas(d, f, false)) {
    if (!n.clienteId) out.push({ nota: n, motivo: "sem_cliente" });
    else if (n.clienteInferido) out.push({ nota: n, motivo: "cliente_inferido" });
    if (!n.negocioId || !ids.has(n.negocioId)) out.push({ nota: n, motivo: "sem_negocio" });
  }
  return out;
}
export const FAIXAS_VALOR_NF = [
  { value: "todas", label: "Qualquer valor", min: 0, max: Infinity },
  { value: "ate5", label: "Até R$ 5 mil", min: 0, max: 5000 },
  { value: "5a20", label: "R$ 5–20 mil", min: 5000, max: 20000 },
  { value: "20a50", label: "R$ 20–50 mil", min: 20000, max: 50000 },
  { value: "50mais", label: "Acima de R$ 50 mil", min: 50000, max: Infinity },
] as const;

// ---------- Fase 13 — Recebíveis, aging e inadimplência ----------
const somaDias = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const abertasNaData = (d: Dados, f: FiltrosGlobais) =>
  notasFiltradas(d, f, false).filter(
    (n) => !!n.vencimento && statusNaData(n, f.dataReferencia) !== "pago",
  );

export interface KpisRecebiveis {
  aVencer7: number;
  aVencer30: number;
  aVencer60: number;
  vencido: number;
  qtdVencidas: number;
  recebidoMes: number;
  vencidoMes: number;
  taxaRecebimento: number | null;
  prazoMedio: number | null;
  atrasoMedio: number | null;
  mes: string;
}
/** KPIs na data de referência (não depende do período; filtros de dimensão aplicam). */
export function kpisRecebiveis(d: Dados, f: FiltrosGlobais): KpisRecebiveis {
  return memo(d, k("krec", f), () => {
    const c = f.dataReferencia;
    const mes = mes7(c);
    const todas = notasFiltradas(d, f, false);
    const abertas = abertasNaData(d, f);
    const aVencer = (n: number) =>
      soma(abertas.filter((x) => x.vencimento >= c && x.vencimento <= somaDias(c, n)));
    const vencidas = abertas.filter((x) => x.vencimento < c);
    const recebidoMes = soma(
      todas.filter((x) => x.dataPagamento && mes7(x.dataPagamento) === mes && x.dataPagamento <= c),
    );
    const vencidoMes = soma(todas.filter((x) => mes7(x.vencimento) === mes && x.vencimento <= c));
    const pagas = todas.filter((x) => x.dataPagamento && x.emissao && x.dataPagamento <= c);
    const prazos = pagas.map((x) => diasEntre(x.emissao, x.dataPagamento!));
    const atrasos = vencidas.map((x) => diasEntre(x.vencimento, c));
    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    return {
      aVencer7: aVencer(7),
      aVencer30: aVencer(30),
      aVencer60: aVencer(60),
      vencido: soma(vencidas),
      qtdVencidas: vencidas.length,
      recebidoMes,
      vencidoMes,
      taxaRecebimento: vencidoMes ? recebidoMes / vencidoMes : null,
      prazoMedio: media(prazos),
      atrasoMedio: media(atrasos),
      mes,
    };
  });
}

export type LinhaAging = { grupo: string; total: number } & Record<
  (typeof FAIXAS_AGING)[number],
  number
>;
const linhaAgingVazia = (grupo: string): LinhaAging => ({
  grupo,
  total: 0,
  "A vencer": 0,
  "1–30": 0,
  "31–60": 0,
  "61–90": 0,
  ">90": 0,
});

/** Aging das NFs abertas agrupado por BU, categoria ou cliente. */
export function agingPor(
  d: Dados,
  f: FiltrosGlobais,
  dim: "bu" | "categoria" | "cliente",
): LinhaAging[] {
  return memo(d, k("agingPor", f, dim), () => {
    const cat = new Map(d.clientes.map((c) => [c.id, c.categoria]));
    const m = new Map<string, LinhaAging>();
    for (const n of abertasNaData(d, f)) {
      const g =
        (dim === "bu" ? n.bu : dim === "categoria" ? cat.get(n.clienteId) : n.clienteId) || "—";
      const l = m.get(g) ?? linhaAgingVazia(g);
      l[faixaAging(n.vencimento, f.dataReferencia)] += n.valor;
      l.total += n.valor;
      m.set(g, l);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  });
}

/** Semáforo por cliente: verde = nada vencido; amarelo = vencido só até 30 dias; vermelho = algo > 30 dias. */
export const tomAgingCliente = (l: LinhaAging): TomSemaforo =>
  l["31–60"] + l["61–90"] + l[">90"] > 0 ? "danger" : l["1–30"] > 0 ? "warning" : "success";
export const vencidoDaLinha = (l: LinhaAging) => l.total - l["A vencer"];

export interface LinhaPrevReal {
  mes: string; // "anterior" ou AAAA-MM
  vencimento: number;
  recebimento: number;
  diferenca: number;
  vencimentoNF: number;
  recebimentoNF: number;
  diverge: boolean;
}
/** Previsto (vencimento) × realizado (recebimento) por mês — Parte 2 (CQ:DD e CB:CO) conferida com as NFs. */
export function previstoRealizado(d: Dados, f: FiltrosGlobais): LinhaPrevReal[] {
  return memo(d, k("prevreal", f), () => {
    const ano = anoDe(f);
    const inicio = `${ano}-01`;
    const meses = ["anterior", ...mesesDoAno(ano)];
    const chave = (m: string) => (m && m < inicio ? "anterior" : m);
    const p2 = (b: Bloco) => {
      const r = new Map<string, number>();
      for (const x of fatosFiltrados(d, b, f, false)) {
        const c = x.anterior ? "anterior" : chave(mes7(x.mes));
        r.set(c, (r.get(c) ?? 0) + x.valor);
      }
      return r;
    };
    const nfs = notasFiltradas(d, f, false);
    const porNF = (data: (n: NotaFiscal) => string | undefined) => {
      const r = new Map<string, number>();
      for (const n of nfs) {
        const c = chave(mes7(data(n)));
        if (c) r.set(c, (r.get(c) ?? 0) + n.valor);
      }
      return r;
    };
    const venc = p2("vencimento"),
      rec = p2("recebimento");
    const vNF = porNF((n) => n.vencimento),
      rNF = porNF((n) => n.dataPagamento);
    return meses.map((mes) => {
      const vencimento = venc.get(mes) ?? 0,
        recebimento = rec.get(mes) ?? 0;
      const vencimentoNF = vNF.get(mes) ?? 0,
        recebimentoNF = rNF.get(mes) ?? 0;
      return {
        mes,
        vencimento,
        recebimento,
        diferenca: recebimento - vencimento,
        vencimentoNF,
        recebimentoNF,
        diverge:
          Math.abs(vencimento - vencimentoNF) > 0.01 ||
          Math.abs(recebimento - recebimentoNF) > 0.01,
      };
    });
  });
}

export interface ItemCobranca {
  nota: NotaFiscal;
  dias: number;
  prioridade: number;
}
/** NFs vencidas e não pagas na data de referência, ordenadas por valor × dias de atraso. */
export function listaCobranca(d: Dados, f: FiltrosGlobais): ItemCobranca[] {
  return memo(d, k("cobranca", f), () =>
    abertasNaData(d, f)
      .filter((n) => n.vencimento < f.dataReferencia)
      .map((nota) => {
        const dias = diasEntre(nota.vencimento, f.dataReferencia);
        return { nota, dias, prioridade: nota.valor * dias };
      })
      .sort((a, b) => b.prioridade - a.prioridade),
  );
}

/** Top N clientes em atraso e participação no vencido total. */
export function concentracaoRisco(d: Dados, f: FiltrosGlobais, n = 10) {
  return memo(d, k("risco", f, n), () => {
    const xs = agruparPor(
      listaCobranca(d, f),
      (x) => x.nota.clienteId || "—",
      (x) => x.nota.valor,
    );
    const total = soma(xs);
    const top = topN(xs, n).map((x) => ({ ...x, participacao: total ? x.valor / total : 0 }));
    const topSoma = soma(top);
    return { top, total, participacaoTop: total ? topSoma / total : 0 };
  });
}

export interface DiaCalendario {
  dia: string;
  total: number;
  notas: (NotaFiscal & { statusCorte: StatusNFCorte })[];
}
type StatusNFCorte = ReturnType<typeof statusNaData>;
/** Vencimentos de um mês (AAAA-MM) agrupados por dia, com status na data de referência. */
export function calendarioVencimentos(
  d: Dados,
  f: FiltrosGlobais,
  mes: string,
): Map<string, DiaCalendario> {
  return memo(d, k("cal", f, mes), () => {
    const r = new Map<string, DiaCalendario>();
    for (const n of notasFiltradas(d, f, false)) {
      if (mes7(n.vencimento) !== mes) continue;
      const dia = n.vencimento.slice(0, 10);
      const x = r.get(dia) ?? { dia, total: 0, notas: [] };
      x.total += n.valor;
      x.notas.push({ ...n, statusCorte: statusNaData(n, f.dataReferencia) });
      r.set(dia, x);
    }
    return r;
  });
}

/** Modelo editável do texto de cobrança. Marcadores: {cliente} {nf} {valor} {vencimento} {dias}. */
export const MODELO_COBRANCA_PADRAO =
  "Olá, {cliente}! Identificamos que a NF {nf}, no valor de {valor}, venceu em {vencimento} ({dias} dias em atraso). Poderia nos confirmar a previsão de pagamento? Obrigado.";
export function textoCobranca(
  modelo: string,
  v: { cliente: string; nf: string; valor: string; vencimento: string; dias: number },
) {
  return modelo
    .replaceAll("{cliente}", v.cliente)
    .replaceAll("{nf}", v.nf)
    .replaceAll("{valor}", v.valor)
    .replaceAll("{vencimento}", v.vencimento)
    .replaceAll("{dias}", String(v.dias));
}

// ---------- Fase 14 — Fluxo de caixa ----------
export type VisaoCaixa = "realizado" | "previsto" | "misto";
export type CenarioCaixa = "base" | "atraso" | "pior";
export interface ParamsCaixa {
  visao: VisaoCaixa;
  cenario: CenarioCaixa;
  atrasoPct: number; // 0..1
  atrasoDias: number;
}
/** Pior caso — Necessita validação: 50% das entradas projetadas atrasam 90 dias e 10% não entram. */
export const PIOR_CASO = { atrasoPct: 0.5, atrasoDias: 90, perdaPct: 0.1 };
export interface LinhaCaixa {
  mes: string; // AAAA-MM ou "anterior"
  projetado: boolean;
  entradas: number;
  recebido: number;
  vencimento: number;
  custos: number;
  impostos: number;
  creditos: number;
  saldo: number;
  acumulado: number;
  difPlanilha: number;
}

function somaPorMes(fs: Fato[]) {
  const m = new Map<string, number>();
  for (const x of fs) {
    const c = x.anterior ? "anterior" : mes7(x.mes);
    m.set(c, (m.get(c) ?? 0) + x.valor);
  }
  return m;
}

/** Fluxo mensal pela Parte 2 (sem recalcular custos/impostos). Saldo = entradas − custos − impostos; créditos são informativos. */
export function fluxoCaixa(d: Dados, f: FiltrosGlobais, p: ParamsCaixa): LinhaCaixa[] {
  const g = (b: string) => somaPorMes(fatosFiltrados(d, b as Bloco, f, false));
  const rec = g("recebimento"),
    ven = g("vencimento"),
    cus = g("custo_pagamento");
  const imp = g("impostos"),
    cre = g("creditos"),
    dif = g("dif_custo_receb");
  const corte = f.dataReferencia.slice(0, 7);
  const meses = [
    ...new Set([...rec.keys(), ...ven.keys(), ...cus.keys(), ...imp.keys(), ...cre.keys()]),
  ]
    .filter((m) => m !== "anterior")
    .sort();
  const todos = (
    rec.has("anterior") || ven.has("anterior") || imp.has("anterior") || cus.has("anterior")
      ? ["anterior"]
      : []
  ).concat(meses);
  const proj = (m: string) =>
    m !== "anterior" && (p.visao === "previsto" ? m > corte : p.visao === "misto" && m > corte);
  const base = todos.map((m) => {
    if (p.visao === "realizado") return rec.get(m) ?? 0;
    if (p.visao === "previsto") return ven.get(m) ?? 0;
    return m === "anterior" || m <= corte ? (rec.get(m) ?? 0) : (ven.get(m) ?? 0);
  });
  // cenários: só afetam meses projetados
  const ent = [...base];
  if (p.cenario !== "base") {
    const pct = p.cenario === "pior" ? PIOR_CASO.atrasoPct : p.atrasoPct;
    const dias = p.cenario === "pior" ? PIOR_CASO.atrasoDias : p.atrasoDias;
    const perda = p.cenario === "pior" ? PIOR_CASO.perdaPct : 0;
    const desloc = Math.max(0, Math.round(dias / 30));
    todos.forEach((m, i) => {
      if (!proj(m)) return;
      const v = base[i]!;
      const perdido = v * perda;
      const atrasado = (v - perdido) * pct;
      ent[i]! -= perdido + atrasado;
      const j = i + desloc;
      if (j < todos.length) ent[j]! += atrasado;
    });
  }
  let acc = 0;
  return todos.map((m, i) => {
    const custos = cus.get(m) ?? 0,
      impostos = imp.get(m) ?? 0;
    const saldo = ent[i]! - custos - impostos;
    acc += saldo;
    return {
      mes: m,
      projetado: proj(m),
      entradas: ent[i]!,
      recebido: rec.get(m) ?? 0,
      vencimento: ven.get(m) ?? 0,
      custos,
      impostos,
      creditos: cre.get(m) ?? 0,
      saldo,
      acumulado: acc,
      difPlanilha: dif.get(m) ?? 0,
    };
  });
}

export function resumoCaixa(linhas: LinhaCaixa[], corte: string) {
  const c = corte.slice(0, 7);
  const meses = linhas.filter((l) => l.mes !== "anterior");
  const min = meses.reduce<LinhaCaixa | null>(
    (a, l) => (!a || l.acumulado < a.acumulado ? l : a),
    null,
  );
  const atual = [...linhas].reverse().find((l) => l.mes === "anterior" || l.mes <= c);
  const futuros = meses.filter((l) => l.mes > c);
  const custoMedio = futuros.length
    ? futuros.reduce((a, l) => a + l.custos + l.impostos, 0) / futuros.length
    : 0;
  const ate = linhas.filter((l) => l.mes === "anterior" || l.mes <= c);
  const ven = ate.reduce((a, l) => a + l.vencimento, 0);
  const rec = ate.reduce((a, l) => a + l.recebido, 0);
  return {
    saldoMinimo: min?.acumulado ?? 0,
    mesMinimo: min?.mes ?? null,
    saldoNoCorte: atual?.acumulado ?? 0,
    mesesCobertos: custoMedio > 0 ? Math.max(0, (atual?.acumulado ?? 0) / custoMedio) : null,
    pctRealizado: ven > 0 ? rec / ven : null,
  };
}

// ---------- Fase 15: Pipe × Faturado v2 ----------
export type RegimePxF = "total" | "autorizado";
export const TOLERANCIA_PXF_PADRAO = 0.05;
export type TomPxF = "success" | "warning" | "danger";
/** Aderência relativa: |diferença| / base (base zero com faturado ≠ 0 = 100%). */
export const desvioPxF = (base: number, fat: number) =>
  base ? Math.abs(base - fat) / Math.abs(base) : fat ? 1 : 0;
export const tomPxF = (base: number, fat: number, tol: number): TomPxF => {
  const x = desvioPxF(base, fat);
  return x <= tol ? "success" : x <= tol * 2 ? "warning" : "danger";
};
export interface CelulaPxF {
  base: number;
  fat: number;
  dif: number;
  planilha: number;
}
export interface LinhaPxF {
  bu: string;
  produto: string;
  meses: CelulaPxF[]; // 12 meses do ano-base
  anterior: CelulaPxF;
  total: CelulaPxF;
  aLiberar: number;
}
const celVazia = (): CelulaPxF => ({ base: 0, fat: 0, dif: 0, planilha: 0 });
const somaCel = (a: CelulaPxF, b: CelulaPxF) => {
  a.base += b.base;
  a.fat += b.fat;
  a.dif += b.dif;
  a.planilha += b.planilha;
};
/** Matriz BU × Produto × mês. Diferença = base (Pipe ou Pipe autorizado) − Faturado competência; planilha = bloco BM:BY. */
export function matrizPxF(d: Dados, f: FiltrosGlobais, regime: RegimePxF): LinhaPxF[] {
  return memo(d, k("pxf", f, regime), () => {
    const ano = anoDe(f);
    const meses = mesesDoAno(ano);
    const blocoBase: Bloco = regime === "total" ? "pipe" : "pipe_autorizado";
    const m = new Map<string, LinhaPxF>();
    const get = (bu: string, produto: string) => {
      const key = `${bu}|${produto}`;
      let l = m.get(key);
      if (!l)
        m.set(
          key,
          (l = {
            bu,
            produto,
            meses: meses.map(celVazia),
            anterior: celVazia(),
            total: celVazia(),
            aLiberar: 0,
          }),
        );
      return l;
    };
    for (const x of fatosFiltrados(
      d,
      [blocoBase, "fat_competencia", "dif_pipe_fat" as Bloco, "a_liberar"],
      f,
      false,
      "produto",
    )) {
      const l = get(x.bu ?? "—", x.produto ?? "—");
      if (x.bloco === "a_liberar") {
        l.aLiberar += x.valor;
        continue;
      }
      const i = meses.indexOf(mes7(x.mes));
      const c = x.anterior ? l.anterior : i >= 0 ? l.meses[i]! : null;
      if (!c) continue;
      if (x.bloco === blocoBase) c.base += x.valor;
      else if (x.bloco === "fat_competencia") c.fat += x.valor;
      else c.planilha += x.valor;
    }
    for (const l of m.values()) {
      for (const c of [...l.meses, l.anterior]) c.dif = c.base - c.fat;
      for (const c of l.meses) somaCel(l.total, c); // total = só ano-base (regra da Parte 2)
    }
    return [...m.values()].sort(
      (a, b) => a.bu.localeCompare(b.bu) || Math.abs(b.total.base) - Math.abs(a.total.base),
    );
  });
}
export function totalLinhasPxF(ls: LinhaPxF[], bu: string, produto = "Total"): LinhaPxF {
  const t: LinhaPxF = {
    bu,
    produto,
    meses: Array.from({ length: 12 }, celVazia),
    anterior: celVazia(),
    total: celVazia(),
    aLiberar: 0,
  };
  for (const l of ls) {
    l.meses.forEach((c, i) => somaCel(t.meses[i]!, c));
    somaCel(t.anterior, l.anterior);
    somaCel(t.total, l.total);
    t.aLiberar += l.aLiberar;
  }
  return t;
}
/** Conferência com a planilha: aceita a mesma convenção ou o sinal oposto (Faturado − Pipe). */
export function conferePxF(c: CelulaPxF): "ok" | "sinal" | "divergente" {
  if (Math.abs(c.dif - c.planilha) <= 1) return "ok";
  if (Math.abs(c.dif + c.planilha) <= 1) return "sinal";
  return "divergente";
}
export function kpisPxF(ls: LinhaPxF[]) {
  const t = totalLinhasPxF(ls, "Total");
  return {
    base: t.total.base,
    fat: t.total.fat,
    dif: t.total.dif,
    aLiberar: t.aLiberar,
    aderencia: t.total.base ? t.total.fat / t.total.base : 0,
  };
}
/** Série mensal (base, faturado, diferença e diferença acumulada). */
export function seriePxF(ls: LinhaPxF[], f: FiltrosGlobais) {
  const t = totalLinhasPxF(ls, "Total");
  let acum = 0;
  return mesesDoAno(anoDe(f)).map((mes, i) => {
    const c = t.meses[i]!;
    acum += c.dif;
    return { mes, base: c.base, fat: c.fat, dif: c.dif, acumulada: acum };
  });
}
/** Drill: clientes (fato_mensal nível cliente) de um BU/produto/mês, com negócios e NFs relacionados. */
export function drillPxF(
  d: Dados,
  f: FiltrosGlobais,
  regime: RegimePxF,
  bu: string,
  produto: string,
  mes: string | "anterior" | "total",
) {
  return memo(d, k("pxfdrill", f, regime, bu, produto, mes), () => {
    const blocoBase: Bloco = regime === "total" ? "pipe" : "pipe_autorizado";
    const ano = String(anoDe(f));
    const ff = {
      ...f,
      bu: bu === "Total" ? f.bu : (bu as FiltrosGlobais["bu"]),
      produto: produto === "Total" ? f.produto : produto,
    };
    const ok = (x: Fato) =>
      mes === "anterior"
        ? x.anterior
        : !x.anterior && (mes === "total" ? x.mes.startsWith(ano) : mes7(x.mes) === mes);
    const m = new Map<string, { cliente: string; base: number; fat: number }>();
    for (const x of fatosFiltrados(d, [blocoBase, "fat_competencia"], ff, false, "cliente")) {
      if (!ok(x)) continue;
      const c = x.cliente ?? "—";
      const it = m.get(c) ?? { cliente: c, base: 0, fat: 0 };
      if (x.bloco === blocoBase) it.base += x.valor;
      else it.fat += x.valor;
      m.set(c, it);
    }
    const okMes = (c: string) =>
      mes === "anterior" ? c < `${ano}-01` : mes === "total" ? c.startsWith(ano) : c === mes;
    const neg = d.negocios.filter(
      (n) =>
        (!ff.bu || n.bu === ff.bu) &&
        (!ff.produto || n.produto === ff.produto) &&
        okMes(n.competencia) &&
        (regime === "total" || n.autorizada),
    );
    const nfs = d.notas.filter(
      (n) =>
        (!ff.bu || n.bu === ff.bu) &&
        (!ff.produto || n.card === ff.produto) &&
        okMes(n.competencia),
    );
    return [...m.values()]
      .map((x) => ({
        ...x,
        dif: x.base - x.fat,
        negocios: neg.filter((n) => n.clienteId === x.cliente),
        nfs: nfs.filter((n) => n.clienteId === x.cliente),
      }))
      .filter((x) => x.base || x.fat)
      .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
  });
}
export type CausaPxF =
  "sem_card" | "autorizado_sem_nf" | "competencia_diferente" | "valor_diferente";
export interface RegistroCausa {
  causa: CausaPxF;
  id: string;
  tipo: "negocio" | "nf" | "fato";
  cliente: string;
  produto: string;
  competencia: string;
  valor: number;
  detalhe: string;
}
/** Causas prováveis por regras (Parte 1 + nível cliente da Parte 2). */
export function causasPxF(d: Dados, f: FiltrosGlobais): RegistroCausa[] {
  return memo(d, k("pxfcausas", f), () => {
    const ano = String(anoDe(f));
    const out: RegistroCausa[] = [];
    const negs = d.negocios.filter(
      (n) => (!f.bu || n.bu === f.bu) && (!f.produto || n.produto === f.produto),
    );
    const porId = new Map(d.negocios.map((n) => [n.id, n]));
    const porNeg = nfsPorNegocio(d);
    const nfs = d.notas.filter(
      (n) =>
        (!f.bu || n.bu === f.bu) &&
        (!f.produto || n.card === f.produto) &&
        n.competencia.startsWith(ano),
    );
    for (const x of fatosFiltrados(d, "fat_competencia", f, false, "cliente"))
      if (
        !x.anterior &&
        x.mes.startsWith(ano) &&
        (x.produto ?? "").toLowerCase().startsWith("não localizado")
      )
        out.push({
          causa: "sem_card",
          id: `f-${x.cliente}-${x.mes}`,
          tipo: "fato",
          cliente: x.cliente ?? "—",
          produto: x.produto ?? "—",
          competencia: mes7(x.mes),
          valor: x.valor,
          detalhe: "Parte 2: faturado em Não Localizado",
        });
    for (const n of nfs)
      if (!n.negocioId || !porId.has(n.negocioId))
        out.push({
          causa: "sem_card",
          id: `nf-${n.id}`,
          tipo: "nf",
          cliente: n.clienteId,
          produto: n.card,
          competencia: n.competencia,
          valor: n.valor,
          detalhe: `NF ${n.numero} sem card no Pipe`,
        });
    for (const n of negs) {
      if (!n.competencia.startsWith(ano)) continue;
      const ns = porNeg.get(n.id) ?? [];
      if (n.autorizada && !ns.length)
        out.push({
          causa: "autorizado_sem_nf",
          id: `n-${n.id}`,
          tipo: "negocio",
          cliente: n.clienteId,
          produto: n.produto,
          competencia: n.competencia,
          valor: n.valor,
          detalhe: n.titulo,
        });
      if (ns.length) {
        const tot = ns.reduce((a, x) => a + x.valor, 0);
        if (Math.abs(tot - n.valor) > 1)
          out.push({
            causa: "valor_diferente",
            id: `v-${n.id}`,
            tipo: "negocio",
            cliente: n.clienteId,
            produto: n.produto,
            competencia: n.competencia,
            valor: tot - n.valor,
            detalhe: `Card ${n.valor.toFixed(2)} × NFs ${tot.toFixed(2)}`,
          });
      }
    }
    for (const n of nfs) {
      const g = n.negocioId ? porId.get(n.negocioId) : undefined;
      if (g && g.competencia && g.competencia !== n.competencia)
        out.push({
          causa: "competencia_diferente",
          id: `c-${n.id}`,
          tipo: "nf",
          cliente: n.clienteId,
          produto: n.card,
          competencia: n.competencia,
          valor: n.valor,
          detalhe: `NF ${n.numero}: ${n.competencia} × card ${g.competencia}`,
        });
    }
    return out;
  });
}

// ---------- Fase 16: Controladoria operacional v2 ----------
const mesesExtendidos = (ano: number, ateMes = "02") => {
  const xs = mesesDoAno(ano);
  for (let m = 1; m <= Number(ateMes); m++) xs.push(`${ano + 1}-${String(m).padStart(2, "0")}`);
  return xs;
};

export interface ResumoEmissao {
  autorizados: { qtd: number; valor: number };
  naoAutorizados: { qtd: number; valor: number };
  naoLocalizadas: { qtd: number; valor: number; parte2: number };
  aLiberar: number;
  fila: {
    cliente: string;
    categoria: string;
    autorizadoSemNF: number;
    qtdSemNF: number;
    aLiberar: number;
    total: number;
    diasMax: number;
  }[];
}
/** Emissão: cards autorizados × não, NFs não localizadas, A liberar e fila por cliente. */
export function resumoEmissao(d: Dados, f: FiltrosGlobais): ResumoEmissao {
  return memo(d, k("emissao16", f), () => {
    const ns = negociosFiltrados(d, f);
    const aut = ns.filter((n) => n.autorizada),
      nao = ns.filter((n) => !n.autorizada);
    const nl = notasFiltradas(d, f).filter(
      (n) => !n.negocioId || /n[aã]o localizado/i.test(n.card),
    );
    const nlP2 = soma(
      fatosFiltrados(d, blocoFaturado(f.regime), f, true, "produto").filter((x) =>
        /n[aã]o localizado/i.test(x.produto ?? ""),
      ),
    );
    const cards = cardsLiberarFiltrados(d, f);
    const cat = new Map(d.clientes.map((c) => [c.id, c.categoria]));
    const fila = new Map<string, ResumoEmissao["fila"][number]>();
    const get = (c: string, categoria?: string | null) =>
      fila.get(c) ??
      fila
        .set(c, {
          cliente: c,
          categoria: categoria ?? cat.get(c) ?? "—",
          autorizadoSemNF: 0,
          qtdSemNF: 0,
          aLiberar: 0,
          total: 0,
          diasMax: 0,
        })
        .get(c)!;
    for (const l of negociosSemNF(d, f)) {
      const o = get(l.negocio.clienteId);
      o.autorizadoSemNF += l.negocio.valor;
      o.qtdSemNF++;
      o.diasMax = Math.max(o.diasMax, l.dias);
    }
    for (const c of cards) get(c.cliente, c.categoria).aLiberar += c.valor;
    for (const o of fila.values()) o.total = o.autorizadoSemNF + o.aLiberar;
    return {
      autorizados: { qtd: aut.length, valor: soma(aut) },
      naoAutorizados: { qtd: nao.length, valor: soma(nao) },
      naoLocalizadas: { qtd: nl.length, valor: soma(nl), parte2: nlP2 },
      aLiberar: soma(cards),
      fila: [...fila.values()].sort((a, b) => b.total - a.total),
    };
  });
}

export interface LinhaCustoMes {
  mes: string;
  emitido: number;
  pago: number;
  emitidoDeslocado: number;
}
/** Custos por emissão × por pagamento, jan do ano-base até fev do ano seguinte; deslocamento em meses. */
export function serieCustos(d: Dados, f: FiltrosGlobais, deslocamento = 2): LinhaCustoMes[] {
  return memo(d, k("custos16", f, deslocamento), () => {
    const ano = Number(f.ate.slice(0, 4));
    const mapa = (b: Bloco) => {
      const m = new Map<string, number>();
      for (const x of fatosFiltrados(d, b, f, false))
        if (!x.anterior) m.set(mes7(x.mes), (m.get(mes7(x.mes)) ?? 0) + x.valor);
      return m;
    };
    const e = mapa("custo_emissao"),
      p = mapa("custo_pagamento");
    const meses = mesesExtendidos(ano);
    return meses.map((mes, i) => ({
      mes,
      emitido: e.get(mes) ?? 0,
      pago: p.get(mes) ?? 0,
      emitidoDeslocado: i - deslocamento >= 0 ? (e.get(meses[i - deslocamento]!) ?? 0) : 0,
    }));
  });
}
/** Erro relativo (Σ|emitido(m−l) − pago(m)| ÷ Σ|emitido|) para cada defasagem l = 0..4. */
export function testeDefasagemCustos(
  d: Dados,
  f: FiltrosGlobais,
): { meses: number; erro: number }[] {
  return [0, 1, 2, 3, 4].map((l) => {
    const s = serieCustos(d, f, l);
    const tot = s.reduce((a, x) => a + Math.abs(x.emitido), 0);
    const e = s.slice(l).reduce((a, x) => a + Math.abs(x.emitidoDeslocado - x.pago), 0);
    return { meses: l, erro: tot ? e / tot : 0 };
  });
}
/** Custos a pagar: custo por pagamento em meses após a data de referência (até fev do ano seguinte). */
export const custosAPagar = (d: Dados, f: FiltrosGlobais) =>
  serieCustos(d, f).filter((x) => x.mes > f.dataReferencia.slice(0, 7) && x.pago !== 0);

export interface LinhaFin {
  chave: string;
  bu: string;
  produto: string;
  cliente: string;
  categoria: string;
  faturado: number;
  recebido: number;
  custoEmissao: number;
  custoPagamento: number;
  impostos: number;
  creditos: number;
}
const BLOCOS_FIN: [Bloco, keyof LinhaFin][] = [
  ["recebimento", "recebido"],
  ["custo_emissao", "custoEmissao"],
  ["custo_pagamento", "custoPagamento"],
  ["impostos", "impostos"],
  ["creditos", "creditos"],
];
/** Agregado financeiro por dimensão (Parte 2). Cliente usa o nível cliente; BU/produto o nível produto. */
export function financeiroPor(
  d: Dados,
  f: FiltrosGlobais,
  dim: "bu" | "produto" | "cliente",
  nivel?: Fato["nivel"],
): LinhaFin[] {
  return memo(d, k("fin16", f, dim, nivel), () => {
    const nv = nivel ?? (dim === "cliente" ? "cliente" : undefined);
    const m = new Map<string, LinhaFin>();
    const add = (x: Fato, campo: keyof LinhaFin) => {
      const chave =
        dim === "bu"
          ? (x.bu ?? "—")
          : dim === "produto"
            ? `${x.bu ?? "—"} · ${x.produto ?? "—"}`
            : (x.cliente ?? "—");
      const o =
        m.get(chave) ??
        m
          .set(chave, {
            chave,
            bu: x.bu ?? "—",
            produto: x.produto ?? "—",
            cliente: x.cliente ?? "—",
            categoria: x.categoria ?? "—",
            faturado: 0,
            recebido: 0,
            custoEmissao: 0,
            custoPagamento: 0,
            impostos: 0,
            creditos: 0,
          })
          .get(chave)!;
      (o[campo] as number) += x.valor;
    };
    for (const x of fatosFiltrados(d, blocoFaturado(f.regime), f, true, nv)) add(x, "faturado");
    for (const [b, c] of BLOCOS_FIN) for (const x of fatosFiltrados(d, b, f, true, nv)) add(x, c);
    return [...m.values()].sort((a, b) => b.faturado - a.faturado);
  });
}

/** Impostos/créditos por mês (Parte 2). */
export function serieImpostos(d: Dados, f: FiltrosGlobais) {
  const i = serieMensal(d, "impostos", f),
    c = serieMensal(d, "creditos", f),
    fa = serieMensal(d, blocoFaturado(f.regime), f);
  return i.map((x, n) => {
    const cr = c[n]?.valor ?? 0,
      fat = fa[n]?.valor ?? 0;
    return {
      mes: x.chave,
      impostos: x.valor,
      creditos: cr,
      liquido: x.valor - cr,
      faturado: fat,
      aliquota: fat ? x.valor / fat : 0,
    };
  });
}
/** Faturado das NFs por regime de PIS/Cofins (código da NF). A Parte 2 não separa impostos por regime. */
export function faturadoPorRegimeNF(d: Dados, f: FiltrosGlobais) {
  const m = new Map<string, { regime: string; qtd: number; valor: number }>();
  for (const n of notasFiltradas(d, f)) {
    const r = n.regime || "Regime não identificado";
    const o = m.get(r) ?? m.set(r, { regime: r, qtd: 0, valor: 0 }).get(r)!;
    o.qtd++;
    o.valor += n.valor;
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor);
}

export interface LinhaConciliacao {
  mes: string;
  faturado: number;
  recebido: number;
  custosPagos: number;
  recebidoMenosCustos: number;
  diferenca: number;
  planilha: number;
}
/** Recebido − Custos pagos e Faturado − (Recebido − Custos pagos), com o bloco de diferenças da Parte 2. */
export function conciliacao(d: Dados, f: FiltrosGlobais): LinhaConciliacao[] {
  return memo(d, k("concil16", f), () => {
    const fa = serieMensal(d, blocoFaturado(f.regime), f),
      r = serieMensal(d, "recebimento", f),
      c = serieMensal(d, "custo_pagamento", f);
    const pl = serieMensal(d, "dif_custo_receb" as Bloco, f);
    return fa.map((x, i) => {
      const rec = r[i]?.valor ?? 0,
        cp = c[i]?.valor ?? 0;
      return {
        mes: x.chave,
        faturado: x.valor,
        recebido: rec,
        custosPagos: cp,
        recebidoMenosCustos: rec - cp,
        diferenca: x.valor - (rec - cp),
        planilha: pl[i]?.valor ?? 0,
      };
    });
  });
}

export type FormulaMargem = "a" | "b" | "c";
export const FORMULAS_MARGEM: { id: FormulaMargem; titulo: string; formula: string }[] = [
  {
    id: "a",
    titulo: "(a) Faturado − Custos por emissão",
    formula: "Faturado − Custos por emissão",
  },
  {
    id: "b",
    titulo: "(b) Recebido − Custos por pagamento",
    formula: "Recebido − Custos por pagamento",
  },
  {
    id: "c",
    titulo: "(c) (a) − Impostos + Créditos",
    formula: "Faturado − Custos por emissão − Impostos + Créditos",
  },
];
export function margemPor(
  l: LinhaFin,
  fm: FormulaMargem,
): { margem: number; base: number; pct: number } {
  const a = l.faturado - l.custoEmissao;
  const margem =
    fm === "a" ? a : fm === "b" ? l.recebido - l.custoPagamento : a - l.impostos + l.creditos;
  const base = fm === "b" ? l.recebido : l.faturado;
  return { margem, base, pct: base ? margem / base : 0 };
}
/** Soma das margens por cliente × margem do nível produto/BU (diferença = clientes − produto). */
export function conferenciaMargemClientes(d: Dados, f: FiltrosGlobais, fm: FormulaMargem) {
  const tot = (ls: LinhaFin[]) => ls.reduce((a, l) => a + margemPor(l, fm).margem, 0);
  const cli = tot(financeiroPor(d, f, "cliente")),
    prod = tot(financeiroPor(d, f, "bu", "produto"));
  return { clientes: cli, produto: prod, diferenca: cli - prod };
}

/** Desvio (em σ) para "fora da média" no ranking — Necessita validação. */
export const LIMIAR_RANKING_SIGMA = 2;
export interface LinhaRanking extends LinhaFin {
  margem: number;
  pct: number;
  alerta: "negativa" | "fora_media" | null;
}
export function rankingRentabilidade(
  d: Dados,
  f: FiltrosGlobais,
  dim: "cliente" | "produto",
  fm: FormulaMargem,
): LinhaRanking[] {
  const ls = financeiroPor(d, f, dim)
    .map((l) => ({ ...l, ...margemPor(l, fm) }))
    .filter((l) => l.base || l.margem);
  const pcts = ls.filter((l) => l.base).map((l) => l.pct);
  const mu = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const sd = pcts.length ? Math.sqrt(pcts.reduce((a, b) => a + (b - mu) ** 2, 0) / pcts.length) : 0;
  return ls
    .map((l) => ({
      ...l,
      alerta:
        l.margem < 0
          ? ("negativa" as const)
          : sd && Math.abs(l.pct - mu) > LIMIAR_RANKING_SIGMA * sd
            ? ("fora_media" as const)
            : null,
    }))
    .sort((a, b) => b.margem - a.margem);
}

// ======================= Fase 17 — Clientes 360° e Produtos/Plataformas =======================

export type StatusReceb = "quitado" | "em_dia" | "atrasado" | "sem_nf";
export interface LinhaCliente {
  id: string; // chave normalizada
  nome: string;
  categoria: string;
  bus: string[];
  plataformas: string[];
  pipe: number;
  faturado: number;
  recebido: number;
  custo: number;
  impostos: number;
  creditos: number;
  margem: number;
  margemPct: number;
  emAberto: number;
  atrasado: number;
  nNFs: number;
  ultimaNF: string;
  status: StatusReceb;
}

/** Filtros sem cliente/categoria/bu/plataforma (a tela aplica os próprios). */
const semCliente = (f: FiltrosGlobais): FiltrosGlobais => ({ ...f, clientes: [] });

/** Visão por cliente: valores da Parte 2 (nível cliente) + NFs da Parte 1, unidos pelo nome canônico. */
export function clientes360(d: Dados, f: FiltrosGlobais): LinhaCliente[] {
  return memo(d, k("cli360", f), () => {
    const m = new Map<
      string,
      LinhaCliente & { _bu: Set<string>; _pl: Set<string>; _cat: Map<string, number> }
    >();
    const get = (nome: string) => {
      const id = chaveCliente(nome);
      let o = m.get(id);
      if (!o) {
        o = {
          id,
          nome,
          categoria: "—",
          bus: [],
          plataformas: [],
          pipe: 0,
          faturado: 0,
          recebido: 0,
          custo: 0,
          impostos: 0,
          creditos: 0,
          margem: 0,
          margemPct: 0,
          emAberto: 0,
          atrasado: 0,
          nNFs: 0,
          ultimaNF: "",
          status: "sem_nf",
          _bu: new Set(),
          _pl: new Set(),
          _cat: new Map(),
        };
        m.set(id, o);
      }
      return o;
    };
    const campo: Partial<
      Record<Bloco, "pipe" | "faturado" | "recebido" | "custo" | "impostos" | "creditos">
    > = {
      pipe: "pipe",
      fat_competencia: "faturado",
      recebimento: "recebido",
      custo_pagamento: "custo",
      impostos: "impostos",
      creditos: "creditos",
    };
    for (const x of fatosFiltrados(
      d,
      Object.keys(campo) as Bloco[],
      semCliente(f),
      true,
      "cliente",
    )) {
      if (!x.cliente) continue;
      const o = get(x.cliente);
      o[campo[x.bloco as Bloco]!] += x.valor;
      if (x.bu) o._bu.add(x.bu);
      if (x.plataforma) o._pl.add(x.plataforma);
      if (x.categoria) o._cat.set(x.categoria, (o._cat.get(x.categoria) ?? 0) + 1);
    }
    const catP1 = new Map(d.clientes.map((c) => [chaveCliente(c.id), c.categoria]));
    for (const n of notasFiltradas(d, semCliente(f))) {
      if (f.categoria && !m.has(chaveCliente(n.clienteId))) continue;
      const o = get(n.clienteId);
      o.nNFs++;
      if (n.emissao > o.ultimaNF) o.ultimaNF = n.emissao;
      o._bu.add(n.bu);
      const st = statusNaData(n, f.dataReferencia);
      if (st !== "pago") o.emAberto += n.valor;
      if (st === "atrasado") o.atrasado += n.valor;
    }
    return [...m.values()]
      .map(({ _bu, _pl, _cat, ...o }) => {
        const cat =
          [..._cat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? catP1.get(o.id) ?? "—";
        const mg = margem(o.faturado, o.custo, o.impostos, o.creditos);
        const status: StatusReceb =
          o.nNFs === 0
            ? "sem_nf"
            : o.atrasado > 0
              ? "atrasado"
              : o.emAberto > 0
                ? "em_dia"
                : "quitado";
        return {
          ...o,
          categoria: cat,
          bus: [..._bu].sort(),
          plataformas: [..._pl].sort(),
          margem: mg,
          margemPct: o.faturado ? mg / o.faturado : 0,
          status,
        };
      })
      .sort((a, b) => b.faturado - a.faturado);
  });
}

export const aliasesDe = (nome: string) =>
  Object.entries(ALIAS_CLIENTES)
    .filter(([, c]) => chaveCliente(c) === chaveCliente(nome))
    .map(([a]) => a);

export interface SerieCliente {
  mes: string;
  pipe: number;
  faturado: number;
  recebido: number;
  custo: number;
  margem: number;
}
export interface ProdutoCliente {
  produto: string;
  itemCobranca: string;
  plataforma: string;
  contrato: string;
  faturado: number;
  recebido: number;
  custo: number;
}
export interface AlertaCliente {
  tom: "danger" | "warning";
  texto: string;
}
export interface Cliente360 {
  linha: LinhaCliente | null;
  aliases: string[];
  serie: SerieCliente[];
  produtos: ProdutoCliente[];
  notas: NotaFiscal[];
  negocios: Negocio[];
  cards: CardLiberar[];
  alertas: AlertaCliente[];
}

export function cliente360(d: Dados, f: FiltrosGlobais, id: string, ano: number): Cliente360 {
  return memo(d, k("c360", f, id, ano), () => {
    const linha = clientes360(d, f).find((c) => c.id === id) ?? null;
    const eh = (nome: string | null | undefined) => !!nome && chaveCliente(nome) === id;
    const fatos = fatosFiltrados(
      d,
      ["pipe", "fat_competencia", "recebimento", "custo_pagamento", "impostos", "creditos"],
      semCliente(f),
      false,
      "cliente",
    ).filter((x) => eh(x.cliente) && !x.anterior);
    const serie: SerieCliente[] = mesesDoAno(ano).map((mes) => {
      const s = (b: Bloco) => soma(fatos.filter((x) => x.bloco === b && mes7(x.mes) === mes));
      const fat = s("fat_competencia"),
        cus = s("custo_pagamento");
      return {
        mes,
        pipe: s("pipe"),
        faturado: fat,
        recebido: s("recebimento"),
        custo: cus,
        margem: margem(fat, cus, s("impostos"), s("creditos")),
      };
    });
    const pm = new Map<string, ProdutoCliente>();
    for (const x of fatos) {
      if (!noIntervalo(mes7(x.mes), f)) continue;
      const kk = `${x.produto}|${x.itemCobranca}`;
      const o = pm.get(kk) ?? {
        produto: x.produto ?? "—",
        itemCobranca: x.itemCobranca ?? "—",
        plataforma: x.plataforma ?? "—",
        contrato: x.contrato ?? "—",
        faturado: 0,
        recebido: 0,
        custo: 0,
      };
      if (x.bloco === "fat_competencia") o.faturado += x.valor;
      if (x.bloco === "recebimento") o.recebido += x.valor;
      if (x.bloco === "custo_pagamento") o.custo += x.valor;
      pm.set(kk, o);
    }
    const notas = notasFiltradas(d, semCliente(f))
      .filter((n) => eh(n.clienteId))
      .sort((a, b) => b.emissao.localeCompare(a.emissao));
    const negocios = negociosFiltrados(d, semCliente(f)).filter((g) => eh(g.clienteId));
    const cards = d.cards.filter((c) => eh(c.cliente) && c.valor);
    const negIds = new Set(d.negocios.map((g) => g.id));
    const alertas: AlertaCliente[] = [];
    const atrasadas = notas.filter((n) => statusNaData(n, f.dataReferencia) === "atrasado");
    if (atrasadas.length)
      alertas.push({
        tom: "danger",
        texto: `${atrasadas.length} NF(s) em atraso, somando ${soma(atrasadas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      });
    if (linha && linha.faturado > 0 && linha.margem < 0)
      alertas.push({ tom: "danger", texto: "Margem negativa no período" });
    const semNeg = notas.filter((n) => !n.negocioId || !negIds.has(n.negocioId));
    if (semNeg.length)
      alertas.push({
        tom: "warning",
        texto: `${semNeg.length} NF(s) sem negócio vinculado no Pipe`,
      });
    if (cards.length) alertas.push({ tom: "warning", texto: `${cards.length} card(s) a liberar` });
    return {
      linha,
      aliases: aliasesDe(linha?.nome ?? id),
      serie,
      produtos: [...pm.values()]
        .filter((p) => p.faturado || p.recebido || p.custo)
        .sort((a, b) => b.faturado - a.faturado),
      notas,
      negocios,
      cards,
      alertas,
    };
  });
}

// ---------- Produtos e plataformas ----------
export type DimProduto = "bu" | "plataforma" | "contrato" | "produto" | "itemCobranca";
export interface LinhaProduto {
  chave: string;
  pipe: number;
  faturado: number;
  recebido: number;
  custo: number;
  margem: number;
  nClientes: number;
  /** total do nível produto (Parte 2, resumo) — para conferir com a soma dos clientes */
  faturadoResumo: number | null;
}
export function produtosPor(d: Dados, f: FiltrosGlobais, dim: DimProduto): LinhaProduto[] {
  return memo(d, k("prod17", f, dim), () => {
    const blocos: Bloco[] = [
      "pipe",
      "fat_competencia",
      "recebimento",
      "custo_pagamento",
      "impostos",
      "creditos",
    ];
    const chave = (x: Fato) => (dim === "itemCobranca" ? x.itemCobranca : x[dim]) ?? "—";
    type Acc = LinhaProduto & { _cl: Set<string>; imp: number; cred: number };
    const m = new Map<string, Acc>();
    for (const x of fatosFiltrados(d, blocos, semCliente(f), true, "cliente")) {
      const c = chave(x);
      const o =
        m.get(c) ??
        m
          .set(c, {
            chave: c,
            pipe: 0,
            faturado: 0,
            recebido: 0,
            custo: 0,
            margem: 0,
            nClientes: 0,
            faturadoResumo: null,
            _cl: new Set(),
            imp: 0,
            cred: 0,
          })
          .get(c)!;
      if (x.cliente) o._cl.add(chaveCliente(x.cliente));
      if (x.bloco === "pipe") o.pipe += x.valor;
      if (x.bloco === "fat_competencia") o.faturado += x.valor;
      if (x.bloco === "recebimento") o.recebido += x.valor;
      if (x.bloco === "custo_pagamento") o.custo += x.valor;
      if (x.bloco === "impostos") o.imp += x.valor;
      if (x.bloco === "creditos") o.cred += x.valor;
    }
    // conferência com o nível produto (só faz sentido para BU e produto)
    const resumo = new Map<string, number>();
    if (dim === "bu" || dim === "produto")
      for (const x of fatosFiltrados(d, "fat_competencia", semCliente(f), true, "produto")) {
        const c = (x[dim] ?? "—") as string;
        resumo.set(c, (resumo.get(c) ?? 0) + x.valor);
      }
    return [...m.values()]
      .map(({ _cl, imp, cred, ...o }) => ({
        ...o,
        nClientes: _cl.size,
        margem: margem(o.faturado, o.custo, imp, cred),
        faturadoResumo: dim === "bu" || dim === "produto" ? (resumo.get(o.chave) ?? 0) : null,
      }))
      .sort((a, b) => b.faturado - a.faturado);
  });
}

/** "Totais: N Clientes" lido da Parte 2 (controles da seção). */
export function totaisClientesSecao(
  ctl: { bloco: string; descricao: string; valorPlanilha: number }[],
) {
  return ctl
    .filter((c) => c.bloco === "secao")
    .map((c) => ({ secao: c.descricao.split(":")[0]!.trim(), clientes: c.valorPlanilha }));
}

// ---------- Terceiro × Anunciante ----------
export interface LinhaCategoria {
  categoria: string;
  clientes: number;
  faturado: number;
  margem: number;
  margemPct: number;
  emAberto: number;
  atrasado: number;
  /** atrasado ÷ faturado (Parte 1 sobre Parte 2) — necessita validação */
  inadimplencia: number;
  /** participação dos 5 maiores clientes no faturado da categoria */
  top5: number;
}
export function terceiroXAnunciante(d: Dados, f: FiltrosGlobais): LinhaCategoria[] {
  return memo(d, k("cat17", f), () => {
    const cls = clientes360(d, f);
    return ["Terceiro", "Anunciante", "—"]
      .map((cat) => {
        const xs = cls.filter((c) => c.categoria === cat);
        const fat = xs.reduce((a, c) => a + c.faturado, 0);
        const mg = xs.reduce((a, c) => a + c.margem, 0);
        const atr = xs.reduce((a, c) => a + c.atrasado, 0);
        const top = [...xs]
          .sort((a, b) => b.faturado - a.faturado)
          .slice(0, 5)
          .reduce((a, c) => a + c.faturado, 0);
        return {
          categoria: cat,
          clientes: xs.length,
          faturado: fat,
          margem: mg,
          margemPct: fat ? mg / fat : 0,
          emAberto: xs.reduce((a, c) => a + c.emAberto, 0),
          atrasado: atr,
          inadimplencia: fat ? atr / fat : 0,
          top5: fat ? top / fat : 0,
        };
      })
      .filter((l) => l.clientes > 0);
  });
}

// ---------- Fase 18 — Relatórios (construtor + modelos) ----------
export type DimRelatorio =
  "bu" | "produto" | "plataforma" | "contrato" | "categoria" | "cliente" | "mes";
export type MetricaRelatorio =
  Bloco | "faturado_regime" | "margem" | "margem_pct" | "dif_pxf" | "participacao" | "acumulado";
export type TipoColuna = "texto" | "brl" | "pct";
export interface ColunaRelatorio {
  chave: string;
  rotulo: string;
  tipo: TipoColuna;
  validar?: boolean | undefined;
}
export interface TabelaRelatorio {
  titulo: string;
  colunas: ColunaRelatorio[];
  linhas: Record<string, string | number>[];
  total: Record<string, string | number> | null;
  notas: string[];
}
export const DIMENSOES_RELATORIO: { value: DimRelatorio; label: string }[] = [
  { value: "bu", label: "BU" },
  { value: "produto", label: "Produto" },
  { value: "plataforma", label: "Plataforma" },
  { value: "contrato", label: "Contrato" },
  { value: "categoria", label: "Categoria" },
  { value: "cliente", label: "Cliente" },
  { value: "mes", label: "Mês" },
];
export const METRICAS_RELATORIO: {
  value: MetricaRelatorio;
  label: string;
  tipo: TipoColuna;
  validar?: boolean | undefined;
}[] = [
  { value: "pipe", label: "Pipe", tipo: "brl" },
  { value: "pipe_autorizado", label: "Pipe autorizado", tipo: "brl" },
  { value: "faturado_regime", label: "Faturado (regime escolhido)", tipo: "brl" },
  { value: "fat_emissao", label: "Faturado — emissão", tipo: "brl" },
  { value: "fat_competencia", label: "Faturado — competência", tipo: "brl" },
  { value: "vencimento", label: "Vencimento", tipo: "brl" },
  { value: "recebimento", label: "Recebimento", tipo: "brl" },
  { value: "custo_emissao", label: "Custos — emissão", tipo: "brl" },
  { value: "custo_pagamento", label: "Custos — pagamento", tipo: "brl" },
  { value: "impostos", label: "Impostos", tipo: "brl" },
  { value: "creditos", label: "Créditos", tipo: "brl" },
  { value: "a_liberar", label: "A liberar (cards)", tipo: "brl" },
  { value: "margem", label: "Margem", tipo: "brl", validar: true },
  { value: "margem_pct", label: "Margem %", tipo: "pct", validar: true },
  { value: "dif_pxf", label: "Pipe aut. − Faturado", tipo: "brl" },
  { value: "participacao", label: "Participação %", tipo: "pct" },
  { value: "acumulado", label: "Acumulado %", tipo: "pct" },
];
export interface ConfigRelatorio {
  dimensao: DimRelatorio;
  metricas: MetricaRelatorio[];
  regimeFaturado: "fat_emissao" | "fat_competencia";
  ordenarPor?: MetricaRelatorio | "dimensao";
  limite?: number;
}
const DERIVADAS = new Set<MetricaRelatorio>([
  "margem",
  "margem_pct",
  "dif_pxf",
  "participacao",
  "acumulado",
]);

/**
 * Tabela dinâmica dimensão × métricas sobre a Parte 2 (fato_mensal).
 * Margem = faturado (regime) − custos emissão − impostos + créditos (necessita validação; MARGEM_OFICIAL não definida).
 */
export function relatorioDinamico(
  d: Dados,
  f: FiltrosGlobais,
  c: ConfigRelatorio,
): TabelaRelatorio {
  return memo(d, k("rel18", f, c), () => {
    const fat = c.regimeFaturado;
    const precisa = new Set<Bloco>();
    for (const m of c.metricas) {
      if (m === "faturado_regime") precisa.add(fat);
      else if (m === "margem" || m === "margem_pct")
        ["custo_emissao", "impostos", "creditos", fat].forEach((b) => precisa.add(b as Bloco));
      else if (m === "dif_pxf") {
        precisa.add("pipe_autorizado");
        precisa.add(fat);
      } else if (m === "participacao" || m === "acumulado") precisa.add(fat);
      else if (!DERIVADAS.has(m)) precisa.add(m as Bloco);
    }
    const nivel: Fato["nivel"] =
      c.dimensao === "cliente" || c.dimensao === "categoria" || f.clientes.length || f.categoria
        ? "cliente"
        : "produto";
    const chave = (x: Fato) =>
      (c.dimensao === "mes" ? mes7(x.mes) : (x[c.dimensao] as string | null)) || "—";
    const m = new Map<string, Record<string, number>>();
    for (const x of fatosFiltrados(d, [...precisa], f, true, nivel)) {
      const g = chave(x);
      const o = m.get(g) ?? m.set(g, {}).get(g)!;
      o[x.bloco] = (o[x.bloco] ?? 0) + x.valor;
    }
    const v = (o: Record<string, number>, b: string) => o[b] ?? 0;
    const totFat = [...m.values()].reduce((a, o) => a + v(o, fat), 0);
    const calc = (o: Record<string, number>, met: MetricaRelatorio): number => {
      const marg = v(o, fat) - v(o, "custo_emissao") - v(o, "impostos") + v(o, "creditos");
      switch (met) {
        case "faturado_regime":
          return v(o, fat);
        case "margem":
          return marg;
        case "margem_pct":
          return v(o, fat) ? marg / v(o, fat) : 0;
        case "dif_pxf":
          return v(o, "pipe_autorizado") - v(o, fat);
        case "participacao":
          return totFat ? v(o, fat) / totFat : 0;
        case "acumulado":
          return 0;
        default:
          return v(o, met);
      }
    };
    const dimLabel = DIMENSOES_RELATORIO.find((x) => x.value === c.dimensao)!.label;
    const colunas: ColunaRelatorio[] = [
      { chave: "dimensao", rotulo: dimLabel, tipo: "texto" },
      ...c.metricas.map((met) => {
        const def = METRICAS_RELATORIO.find((x) => x.value === met)!;
        const rot =
          met === "faturado_regime"
            ? `Faturado (${fat === "fat_emissao" ? "emissão" : "competência"})`
            : def.label;
        return { chave: met, rotulo: rot, tipo: def.tipo, validar: def.validar };
      }),
    ];
    let linhas = [...m.entries()].map(([g, o]) => {
      const l: Record<string, string | number> = {
        dimensao: c.dimensao === "mes" && g !== "—" ? g : g,
      };
      for (const met of c.metricas) l[met] = calc(o, met);
      l["__fat"] = v(o, fat);
      return l;
    });
    const ord =
      c.ordenarPor ??
      (c.dimensao === "mes"
        ? "dimensao"
        : (c.metricas.find((x) => !DERIVADAS.has(x)) ?? "dimensao"));
    linhas.sort((a, b) =>
      ord === "dimensao"
        ? String(a["dimensao"]).localeCompare(String(b["dimensao"]), "pt-BR")
        : Number(b[ord] ?? 0) - Number(a[ord] ?? 0),
    );
    if (c.metricas.includes("acumulado")) {
      let acc = 0;
      for (const l of linhas) {
        acc += Number(l["__fat"]);
        l["acumulado"] = totFat ? acc / totFat : 0;
      }
    }
    if (c.limite) linhas = linhas.slice(0, c.limite);
    // total = soma das linhas exibidas (reproduz a tela)
    const total: Record<string, string | number> = { dimensao: "Total" };
    const tot: Record<string, number> = {};
    for (const l of linhas) for (const b of precisa) tot[b] = tot[b] ?? 0;
    for (const [g, o] of m)
      if (linhas.some((l) => l["dimensao"] === g))
        for (const b of Object.keys(o)) tot[b] = (tot[b] ?? 0) + o[b]!;
    for (const met of c.metricas)
      total[met] =
        met === "acumulado"
          ? linhas.length
            ? Number(linhas[linhas.length - 1]!["acumulado"])
            : 0
          : met === "participacao"
            ? totFat
              ? (tot[fat] ?? 0) / totFat
              : 0
            : calc(tot, met);
    linhas.forEach((l) => delete l["__fat"]);
    const notas = ["Fonte: Parte 2 (história financeira consolidada)."];
    if (c.metricas.some((x) => x === "margem" || x === "margem_pct"))
      notas.push(
        "Margem = Faturado − Custos de emissão − Impostos + Créditos — necessita validação.",
      );
    return {
      titulo: "Relatório personalizado",
      colunas,
      linhas,
      total: linhas.length ? total : null,
      notas,
    };
  });
}

/** Aging de recebíveis (NFs da Parte 1 abertas na data de referência) no formato de relatório. */
export function relatorioAging(
  d: Dados,
  f: FiltrosGlobais,
  dim: "bu" | "categoria" | "cliente",
): TabelaRelatorio {
  const nomes = new Map(d.clientes.map((c) => [c.id, c.nome]));
  const xs = agingPor(d, f, dim);
  const faixas = ["A vencer", "1–30", "31–60", "61–90", ">90"] as const;
  const linhas = xs
    .map((l) => ({
      dimensao: dim === "cliente" ? (nomes.get(l.grupo) ?? l.grupo) : l.grupo,
      ...Object.fromEntries(faixas.map((x) => [x, l[x]])),
      total: l.total,
    }))
    .sort((a, b) => b.total - a.total);
  const total: Record<string, string | number> = { dimensao: "Total" };
  for (const c of [...faixas, "total"])
    total[c] = linhas.reduce((a, l) => a + Number((l as Record<string, unknown>)[c] ?? 0), 0);
  return {
    titulo: "Aging de recebíveis",
    colunas: [
      {
        chave: "dimensao",
        rotulo: dim === "bu" ? "BU" : dim === "categoria" ? "Categoria" : "Cliente",
        tipo: "texto",
      },
      ...faixas.map((x) => ({
        chave: x,
        rotulo: x === "A vencer" ? x : `${x} dias`,
        tipo: "brl" as const,
      })),
      { chave: "total", rotulo: "Total em aberto", tipo: "brl" },
    ],
    linhas,
    total: linhas.length ? total : null,
    notas: ["Fonte: Parte 1 (NFs). Status pela data de referência."],
  };
}

/** Cards a liberar (Parte 2) no formato de relatório. */
export function relatorioCards(d: Dados, f: FiltrosGlobais): TabelaRelatorio {
  const cl = new Set(f.clientes);
  const linhas = d.cards
    .filter(
      (x) =>
        (!f.produto || x.produto === f.produto) &&
        (!f.plataforma || x.plataforma === f.plataforma) &&
        (!f.contrato || x.contrato === f.contrato) &&
        (!f.categoria || x.categoria === f.categoria) &&
        (!cl.size || cl.has(x.cliente)),
    )
    .map((x) => ({
      cliente: x.cliente,
      produto: x.produto,
      plataforma: x.plataforma,
      contrato: x.contrato,
      categoria: x.categoria ?? "—",
      valor: x.valor,
    }))
    .sort((a, b) => b.valor - a.valor);
  return {
    titulo: "Cards a liberar",
    colunas: [
      { chave: "cliente", rotulo: "Cliente", tipo: "texto" },
      { chave: "produto", rotulo: "Produto", tipo: "texto" },
      { chave: "plataforma", rotulo: "Plataforma", tipo: "texto" },
      { chave: "contrato", rotulo: "Contrato", tipo: "texto" },
      { chave: "categoria", rotulo: "Categoria", tipo: "texto" },
      { chave: "valor", rotulo: "Valor a liberar", tipo: "brl" },
    ],
    linhas,
    total: linhas.length
      ? {
          cliente: "Total",
          produto: "",
          plataforma: "",
          contrato: "",
          categoria: "",
          valor: linhas.reduce((a, l) => a + l.valor, 0),
        }
      : null,
    notas: ["Fonte: Parte 2 (bloco de cards a liberar). Filtro de período não se aplica."],
  };
}

export type ModeloRelatorio =
  "fechamento" | "pxf" | "aging" | "custos_margem" | "clientes" | "cards";
export const MODELOS_RELATORIO: {
  value: ModeloRelatorio;
  label: string;
  descricao: string;
  config?: ConfigRelatorio;
}[] = [
  {
    value: "fechamento",
    label: "Fechamento mensal",
    descricao: "Cadeia do dinheiro mês a mês.",
    config: {
      dimensao: "mes",
      metricas: [
        "pipe",
        "faturado_regime",
        "recebimento",
        "custo_pagamento",
        "impostos",
        "creditos",
        "margem",
      ],
      regimeFaturado: "fat_competencia",
      ordenarPor: "dimensao",
    },
  },
  {
    value: "pxf",
    label: "Pipe × Faturado",
    descricao: "Autorizado contra faturado por produto.",
    config: {
      dimensao: "produto",
      metricas: ["pipe_autorizado", "faturado_regime", "dif_pxf"],
      regimeFaturado: "fat_competencia",
    },
  },
  { value: "aging", label: "Aging de recebíveis", descricao: "Em aberto por faixa de atraso." },
  {
    value: "custos_margem",
    label: "Custos e margem por produto",
    descricao: "Faturado, custos, impostos, créditos e margem.",
    config: {
      dimensao: "produto",
      metricas: [
        "faturado_regime",
        "custo_emissao",
        "custo_pagamento",
        "impostos",
        "creditos",
        "margem",
        "margem_pct",
      ],
      regimeFaturado: "fat_competencia",
    },
  },
  {
    value: "clientes",
    label: "Clientes: ranking e concentração",
    descricao: "Top clientes por faturado e participação acumulada.",
    config: {
      dimensao: "cliente",
      metricas: ["faturado_regime", "recebimento", "participacao", "acumulado"],
      regimeFaturado: "fat_competencia",
      ordenarPor: "faturado_regime",
    },
  },
  {
    value: "cards",
    label: "Cards a liberar",
    descricao: "Valores ainda não liberados para faturar.",
  },
];
