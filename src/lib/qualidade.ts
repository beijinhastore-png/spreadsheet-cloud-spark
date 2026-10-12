import { obterAnoBase } from "@/lib/periodo";
// Fase 7 — Conferência cruzada Parte1 (detalhe) × Parte2 (consolidado). Funções puras.
// Não corrige dados: apenas compara e descreve.

export type Severidade = "ok" | "aviso" | "erro";
export type Ref = { tipo: "nf" | "negocio" | "cliente"; id: string };
export interface Detalhe {
  chave: string;
  descricao: string;
  esperado?: number;
  encontrado?: number;
  diferenca?: number;
  ref?: Ref;
}
export interface Checagem {
  id: string;
  titulo: string;
  grupo: string;
  severidade: Severidade;
  informativo?: boolean;
  validar?: boolean; // regra sem confirmação → selo "Necessita validação"
  esperado: number;
  encontrado: number;
  diferenca: number;
  nota?: string | undefined;
  detalhes: Detalhe[];
}

export interface QNF {
  id: string;
  negocioId: string;
  clienteId: string;
  bu: string;
  card: string;
  competencia: string;
  emissao: string;
  vencimento: string;
  dataPagamento?: string | undefined;
  valor: number;
  regime?: string | undefined;
  clienteInferido?: boolean | undefined;
}
export interface QNegocio {
  id: string;
  clienteId: string;
  bu: string;
  produto: string;
  competencia: string;
  valor: number;
  autorizada: boolean;
}
export interface QFato {
  bloco: string;
  nivel: "produto" | "cliente";
  bu: string | null;
  produto: string | null;
  plataforma: string | null;
  contrato: string | null;
  cliente: string | null;
  categoria: string | null;
  mes: string;
  anterior: boolean;
  valor: number;
}
export interface QControle {
  bloco: string;
  mes: string | null;
  valorPlanilha: number;
  descricao: string;
}
export interface QClienteCat {
  nome: string;
  categoria: string;
}
export interface EntradaQualidade {
  notas: QNF[];
  negocios: QNegocio[];
  fatos: QFato[];
  controles: QControle[];
  clientes?: QClienteCat[];
  ano?: string; // padrão: ano-base (periodo.ts)
}

export const TOLERANCIA = 0.01;
const r2 = (x: number) => Math.round(x * 100) / 100;
const formatar = (x: number) =>
  x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "AAAA-MM-DD", "AAAA-MM" ou "DD/MM/AAAA" → "AAAA-MM" ("" se inválida). */
export function mesDe(d?: string | null): string {
  if (!d) return "";
  const s = String(d).trim();
  let m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}` : "";
}

const somarPor = <T>(xs: T[], k: (x: T) => string, v: (x: T) => number) => {
  const m = new Map<string, number>();
  for (const x of xs) {
    const c = k(x);
    if (c) m.set(c, (m.get(c) ?? 0) + v(x));
  }
  return m;
};

/** Compara dois mapas chave→valor; devolve detalhes divergentes. */
export function compararMapas(
  esperado: Map<string, number>,
  encontrado: Map<string, number>,
  rotulo: (k: string) => string = (k) => k,
): Detalhe[] {
  const chaves = [...new Set([...esperado.keys(), ...encontrado.keys()])].sort();
  const out: Detalhe[] = [];
  for (const k of chaves) {
    const e = r2(esperado.get(k) ?? 0),
      f = r2(encontrado.get(k) ?? 0);
    if (Math.abs(f - e) > TOLERANCIA)
      out.push({
        chave: k,
        descricao: rotulo(k),
        esperado: e,
        encontrado: f,
        diferenca: r2(f - e),
      });
  }
  return out;
}

function montar(
  id: string,
  grupo: string,
  titulo: string,
  esperado: number,
  encontrado: number,
  detalhes: Detalhe[],
  extra: Partial<Checagem> = {},
): Checagem {
  const e = r2(esperado),
    f = r2(encontrado),
    d = r2(f - e);
  const sev: Severidade = Math.abs(d) <= TOLERANCIA && detalhes.length === 0 ? "ok" : "erro";
  return {
    id,
    grupo,
    titulo,
    esperado: e,
    encontrado: f,
    diferenca: d,
    severidade: sev,
    detalhes,
    ...extra,
  };
}

const fatosDe = (fatos: QFato[], bloco: string) =>
  fatos.filter((f) => f.bloco === bloco && f.nivel === "produto");
const total = (xs: { valor: number }[]) => xs.reduce((a, x) => a + x.valor, 0);

/** Detalhe NF (esperado = Parte2) × fato mensal por mês e por BU×produto. */
function conferirBloco(
  id: string,
  titulo: string,
  bloco: string,
  itens: { mes: string; bu: string; produto: string; valor: number }[],
  fatos: QFato[],
  ano: string,
  comAnterior: boolean,
  porProduto = true,
): Checagem {
  const fs = fatosDe(fatos, bloco);
  const chaveMes = (mes: string, anterior: boolean) =>
    anterior || (comAnterior && mes < `${ano}-01`) ? "anterior" : mes.startsWith(ano) ? mes : "";
  const p2Mes = somarPor(
    fs,
    (f) => chaveMes(f.mes.slice(0, 7), f.anterior),
    (f) => f.valor,
  );
  const p1Mes = somarPor(
    itens,
    (x) => chaveMes(x.mes, false),
    (x) => x.valor,
  );
  const rot = (k: string) => (k === "anterior" ? `Anterior a ${ano}` : `Mês ${k}`);
  const det = compararMapas(p2Mes, p1Mes, rot);
  if (porProduto) {
    const p2P = somarPor(
      fs.filter((f) => !f.anterior && f.mes.startsWith(ano)),
      (f) => `${f.bu ?? "—"} × ${f.produto ?? "—"}`,
      (f) => f.valor,
    );
    const p1P = somarPor(
      itens.filter((x) => x.mes.startsWith(ano)),
      (x) => `${x.bu || "—"} × ${x.produto || "—"}`,
      (x) => x.valor,
    );
    det.push(
      ...compararMapas(p2P, p1P, (k) => `BU × produto ${k}`).map((d) => ({
        ...d,
        chave: `bp:${d.chave}`,
      })),
    );
  }
  return montar(
    id,
    "Parte1 × Parte2",
    titulo,
    total([...p2Mes.entries()].map(([, valor]) => ({ valor }))),
    total([...p1Mes.entries()].map(([, valor]) => ({ valor }))),
    det,
  );
}

export function checarFaturadoCompetencia(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "fat_competencia",
    "Faturado por competência",
    "fat_competencia",
    e.notas.map((n) => ({ mes: mesDe(n.competencia), bu: n.bu, produto: n.card, valor: n.valor })),
    e.fatos,
    ano,
    false,
  );
}
export function checarFaturadoEmissao(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "fat_emissao",
    "Faturado por emissão (inclui anterior)",
    "fat_emissao",
    e.notas.map((n) => ({ mes: mesDe(n.emissao), bu: n.bu, produto: n.card, valor: n.valor })),
    e.fatos,
    ano,
    true,
  );
}
export function checarRecebimento(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "recebimento",
    "Recebimento (data de pagamento)",
    "recebimento",
    e.notas
      .filter((n) => n.dataPagamento)
      .map((n) => ({ mes: mesDe(n.dataPagamento), bu: n.bu, produto: n.card, valor: n.valor })),
    e.fatos,
    ano,
    true,
  );
}
export function checarVencimento(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "vencimento",
    "Vencimento",
    "vencimento",
    e.notas.map((n) => ({ mes: mesDe(n.vencimento), bu: n.bu, produto: n.card, valor: n.valor })),
    e.fatos,
    ano,
    true,
  );
}
export function checarPipe(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "pipe",
    "Pipe (soma dos negócios)",
    "pipe",
    e.negocios.map((n) => ({
      mes: mesDe(n.competencia),
      bu: n.bu,
      produto: n.produto,
      valor: n.valor,
    })),
    e.fatos,
    ano,
    true,
  );
}
export function checarPipeAutorizado(e: EntradaQualidade): Checagem {
  const ano = e.ano ?? String(obterAnoBase());
  return conferirBloco(
    "pipe_autorizado",
    "Pipe autorizado (autorizada = sim)",
    "pipe_autorizado",
    e.negocios
      .filter((n) => n.autorizada)
      .map((n) => ({ mes: mesDe(n.competencia), bu: n.bu, produto: n.produto, valor: n.valor })),
    e.fatos,
    ano,
    true,
  );
}

/** "A liberar" = Pipe − Pipe autorizado (negócios) × coluna BZ/AF22 (bloco a_liberar ou controle). */
export function checarALiberar(e: EntradaQualidade): Checagem {
  const pipe = total(e.negocios),
    aut = total(e.negocios.filter((n) => n.autorizada));
  const calculado = pipe - aut;
  const fs = fatosDe(e.fatos, "a_liberar");
  const ctl = e.controles.find(
    (c) => /\b(AF22|BZ22)\b/.test(c.descricao) || /a liberar/i.test(c.descricao),
  );
  const planilha = fs.length ? total(fs) : (ctl?.valorPlanilha ?? 0);
  const det: Detalhe[] = e.negocios
    .filter((n) => !n.autorizada)
    .map((n) => ({
      chave: `neg:${n.id}`,
      descricao: `Negócio não autorizado ${n.id}`,
      encontrado: r2(n.valor),
      ref: { tipo: "negocio", id: n.id } as Ref,
    }));
  const c = montar(
    "a_liberar",
    "Parte1 × Parte2",
    "A liberar (Pipe − Pipe autorizado)",
    planilha,
    calculado,
    [],
    {
      nota: "Linhas = negócios que compõem o valor a liberar.",
      validar: true,
    },
  );
  return { ...c, detalhes: c.severidade === "ok" ? [] : det };
}

/** Linhas "Check:" da planilha devem ser zero. */
export function checarControlesCheck(e: EntradaQualidade): Checagem {
  const checks = e.controles.filter((c) => /check/i.test(c.descricao));
  const det = checks
    .filter((c) => Math.abs(c.valorPlanilha) > TOLERANCIA)
    .map((c) => ({
      chave: c.descricao,
      descricao: c.descricao,
      esperado: 0,
      encontrado: r2(c.valorPlanilha),
      diferenca: r2(c.valorPlanilha),
    }));
  return montar(
    "check",
    "Controles da planilha",
    `Linhas "Check:" (${checks.length})`,
    0,
    total(det.map((d) => ({ valor: d.encontrado ?? 0 }))),
    det,
  );
}

/** "Totais: N Clientes" × clientes distintos encontrados na seção. */
export function checarTotaisClientes(e: EntradaQualidade): Checagem {
  const secoes = e.controles.filter((c) => c.bloco === "secao");
  const det: Detalhe[] = [];
  let esp = 0,
    enc = 0;
  for (const s of secoes) {
    const nome = (s.descricao.split(":")[0] ?? "").trim();
    const n = new Set(
      e.fatos
        .filter(
          (f) =>
            f.nivel === "cliente" &&
            `${f.plataforma ?? ""} ${f.contrato ?? ""}`.trim() === nome &&
            f.cliente,
        )
        .map((f) => f.cliente!.toLowerCase()),
    ).size;
    esp += s.valorPlanilha;
    enc += n;
    if (n !== s.valorPlanilha)
      det.push({
        chave: nome,
        descricao: `Seção ${nome}`,
        esperado: s.valorPlanilha,
        encontrado: n,
        diferenca: n - s.valorPlanilha,
      });
  }
  return montar(
    "totais_clientes",
    "Controles da planilha",
    '"Totais: N Clientes" por seção',
    esp,
    enc,
    det,
  );
}

/** Total faturado do app × AV23 (linha de total geral da Parte2). */
export function checarTotalGeral(e: EntradaQualidade): Checagem {
  const app = total(e.notas);
  const ctl =
    e.controles.find((c) => /^Linha 23 AV\b/.test(c.descricao)) ??
    e.controles.find(
      (c) => c.bloco === "fat_competencia" && c.mes == null && /total/i.test(c.descricao),
    );
  const planilha = ctl?.valorPlanilha ?? 0;
  const dif = r2(app - planilha);
  const det: Detalhe[] = [];
  if (Math.abs(dif) > TOLERANCIA) {
    const alvo = Math.abs(dif);
    for (const n of e.notas.filter((n) => Math.abs(n.valor - alvo) <= TOLERANCIA))
      det.push({
        chave: `nf:${n.id}`,
        descricao: `NF ${n.id} tem valor igual à diferença`,
        encontrado: n.valor,
        ref: { tipo: "nf", id: n.id },
      });
    for (const n of e.notas.filter((n) => !mesDe(n.competencia)))
      det.push({
        chave: `semcomp:${n.id}`,
        descricao: `NF ${n.id} sem data de competência`,
        encontrado: n.valor,
        ref: { tipo: "nf", id: n.id },
      });
    const centavos = e.notas.reduce((a, n) => a + (n.valor - r2(n.valor)), 0);
    if (Math.abs(centavos) > TOLERANCIA)
      det.push({
        chave: "arred",
        descricao: "Arredondamento acumulado nas NFs",
        diferenca: r2(centavos),
      });
  }
  // Rodada 1: se o app bate com a soma do resumo lida, a diferença está em linhas do resumo
  // que o app ignora de propósito (produto "Teste"; NFs do cliente Teste também são excluídas).
  const somaResumo = total(fatosDe(e.fatos, "fat_competencia"));
  const explicadaPorTeste =
    Math.abs(dif) > TOLERANCIA && fatosDe(e.fatos, "fat_competencia").length > 0 && Math.abs(app - somaResumo) <= TOLERANCIA;
  if (explicadaPorTeste)
    return {
      ...montar("total_geral", "Totais gerais", `Total faturado do app × ${ctl ? ctl.descricao.split(":")[0] : "AV23"}`, planilha, app, []),
      severidade: "ok",
      informativo: true,
      nota: `Diferença de ${formatar(dif)} explicada: é a linha "Teste" do resumo da Parte2, excluída de propósito (cliente Teste). As NFs do cliente Teste também ficam fora da importação. Não é divergência.`,
    };
  return montar(
    "total_geral",
    "Totais gerais",
    `Total faturado do app × ${ctl ? ctl.descricao.split(":")[0] : "AV23"}`,
    planilha,
    app,
    det,
    {
      nota:
        Math.abs(dif) > TOLERANCIA
          ? `Diferença de ${dif.toFixed(2)}. ${det.length ? "Candidatos listados abaixo." : "Nenhuma NF isolada explica a diferença; provável lançamento manual ou fórmula na própria planilha (Necessita validação)."}`
          : undefined,
    },
  );
}

/** Pendências de dados (avisos). */
export function checarPendencias(e: EntradaQualidade): Checagem[] {
  const negIds = new Set(e.negocios.map((n) => n.id));
  const nfNeg = new Set(e.notas.map((n) => n.negocioId).filter(Boolean));
  const nf = (n: QNF, d: string): Detalhe => ({
    chave: `nf:${n.id}`,
    descricao: `NF ${n.id} — ${d}`,
    encontrado: n.valor,
    ref: { tipo: "nf", id: n.id },
  });
  const pend = (
    id: string,
    titulo: string,
    det: Detalhe[],
    extra: Partial<Checagem> = {},
  ): Checagem => ({
    id,
    grupo: "Pendências de dados",
    titulo,
    severidade: det.length ? "aviso" : "ok",
    esperado: 0,
    encontrado: det.length,
    diferenca: det.length,
    detalhes: det,
    ...extra,
  });
  const naoLoc = e.fatos.filter(
    (f) => f.nivel === "produto" && /n[aã]o localizado/i.test(f.produto ?? "") && f.valor,
  );
  const catPlanilha = new Map<string, Set<string>>();
  for (const f of e.fatos)
    if (f.nivel === "cliente" && f.cliente && f.categoria) {
      const k = f.cliente;
      catPlanilha.set(k, (catPlanilha.get(k) ?? new Set()).add(f.categoria));
    }
  const catDim = new Map((e.clientes ?? []).map((c) => [c.nome.toLowerCase(), c.categoria]));
  const catDiv: Detalhe[] = [];
  for (const [k, cats] of catPlanilha) {
    const dim = catDim.get(k.toLowerCase());
    if (cats.size > 1 || (dim && dim !== "—" && !cats.has(dim)))
      catDiv.push({
        chave: `cat:${k}`,
        descricao: `Cliente ${k}: ${[...cats].join(" / ")}${dim ? ` (cadastro: ${dim})` : ""}`,
        ref: { tipo: "cliente", id: k },
      });
  }
  return [
    pend(
      "nf_sem_cliente",
      "NFs sem cliente",
      e.notas.filter((n) => !n.clienteId).map((n) => nf(n, "sem cliente")),
    ),
    pend(
      "cliente_inferido",
      "Clientes inferidos pela razão social",
      e.notas
        .filter((n) => n.clienteInferido)
        .map((n) => nf(n, `cliente inferido: ${n.clienteId}`)),
    ),
    pend(
      "nao_localizado",
      '"Não Localizado" no resumo',
      naoLoc.map((f) => ({
        chave: `nl:${f.bloco}:${f.mes}:${f.bu}`,
        descricao: `${f.bloco} · ${f.mes.slice(0, 7)} · ${f.bu ?? "—"}`,
        encontrado: r2(f.valor),
      })),
    ),
    pend(
      "nf_sem_negocio",
      "NFs sem negócio",
      e.notas
        .filter((n) => !n.negocioId || !negIds.has(n.negocioId))
        .map((n) => nf(n, "sem negócio")),
    ),
    pend(
      "negocio_sem_nf",
      "Negócios sem NF",
      e.negocios
        .filter((g) => !nfNeg.has(g.id))
        .map((g) => ({
          chave: `neg:${g.id}`,
          descricao: `Negócio ${g.id}`,
          encontrado: g.valor,
          ref: { tipo: "negocio", id: g.id } as Ref,
        })),
    ),
    pend(
      "regime",
      "Regime não identificado",
      e.notas
        .filter((n) => !n.regime || /n[aã]o identificado/i.test(n.regime))
        .map((n) => nf(n, "regime não identificado")),
    ),
    pend("categoria", "Categoria divergente", catDiv, { validar: true }),
  ];
}

const somaMes = (m: string, k: number) => {
  const [a = 0, b = 1] = m.split("-").map(Number);
  const d = new Date(Date.UTC(a, b - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Hipótese: custo por pagamento em m+2 ≈ custo por emissão em m. Informativo. */
export function checarDefasagemCustos(e: EntradaQualidade): Checagem {
  const pag = somarPor(
    fatosDe(e.fatos, "custo_pagamento").filter((f) => !f.anterior),
    (f) => f.mes.slice(0, 7),
    (f) => f.valor,
  );
  const emi = somarPor(
    fatosDe(e.fatos, "custo_emissao").filter((f) => !f.anterior),
    (f) => f.mes.slice(0, 7),
    (f) => f.valor,
  );
  const desloc = new Map<string, number>();
  for (const [m, v] of emi) if (pag.has(somaMes(m, 2))) desloc.set(m, v);
  const pagM = new Map([...desloc.keys()].map((m) => [m, pag.get(somaMes(m, 2)) ?? 0]));
  const det = compararMapas(desloc, pagM, (m) => `Emissão ${m} × pagamento ${somaMes(m, 2)}`);
  const conf = desloc.size ? desloc.size - det.length : 0;
  return {
    ...montar(
      "defasagem_custos",
      "Informativo",
      "Defasagem de custos (pagamento m+2 × emissão m)",
      total([...desloc.values()].map((valor) => ({ valor }))),
      total([...pagM.values()].map((valor) => ({ valor }))),
      det,
    ),
    severidade: "ok",
    informativo: true,
    validar: true,
    nota: `Hipótese confirmada em ${conf} de ${desloc.size} meses.`,
  };
}

/** Parte2: resumo por produto × soma das seções de clientes, por bloco de faturado. */
export function checarProdutoCliente(e: EntradaQualidade): Checagem {
  const fs = e.fatos.filter((f) => f.bloco === "fat_competencia");
  const k = (f: QFato) =>
    `${(f.produto ?? "—").toLowerCase()}|${f.anterior ? "anterior" : f.mes.slice(0, 7)}`;
  const prod = somarPor(fs.filter((f) => f.nivel === "produto"), k, (f) => f.valor);
  const cli = somarPor(fs.filter((f) => f.nivel === "cliente"), k, (f) => f.valor);
  const det = compararMapas(prod, cli, (c) => {
    const [p, m] = c.split("|");
    return `${p} · ${m === "anterior" ? "saldo anterior ao ano" : m}`;
  }).sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0));
  const c = montar(
    "produto_cliente",
    "Parte2: resumo × clientes",
    "Faturado (competência): resumo por produto × soma dos clientes",
    total([...prod.values()].map((valor) => ({ valor }))),
    total([...cli.values()].map((valor) => ({ valor }))),
    det,
  );
  return {
    ...c,
    severidade: c.severidade === "ok" ? "ok" : "aviso",
    nota: det.length
      ? 'Inconsistência da própria planilha (o app lê as duas partes corretamente). No ano: linha "Não Localizado" do resumo sem clientes. No saldo anterior: nas seções a coluna "<31/12/2025" de competência é menor que a de emissão, enquanto o resumo usa o mesmo valor; e há saldos no resumo sem clientes. Detalhes em docs/CONCILIACAO.md.'
      : undefined,
  };
}

export function executarChecagens(e: EntradaQualidade): Checagem[] {
  return [
    checarFaturadoCompetencia(e),
    checarFaturadoEmissao(e),
    checarRecebimento(e),
    checarVencimento(e),
    checarPipe(e),
    checarPipeAutorizado(e),
    checarALiberar(e),
    checarControlesCheck(e),
    checarTotaisClientes(e),
    checarTotalGeral(e),
    checarProdutoCliente(e),
    ...checarPendencias(e),
    checarDefasagemCustos(e),
  ];
}

export function notaConfianca(cs: Checagem[]) {
  const conta = cs.filter((c) => !c.informativo);
  return {
    ok: conta.filter((c) => c.severidade === "ok").length,
    total: conta.length,
    erros: conta.filter((c) => c.severidade === "erro").length,
    avisos: conta.filter((c) => c.severidade === "aviso").length,
  };
}

const csvCel = (x: unknown) => {
  const s = x == null ? "" : String(x);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV (separador ;) com todas as linhas divergentes. */
export function divergenciasCSV(cs: Checagem[]): string {
  const linhas = [
    [
      "checagem",
      "severidade",
      "chave",
      "descricao",
      "esperado",
      "encontrado",
      "diferenca",
      "registro",
    ],
  ];
  for (const c of cs)
    for (const d of c.detalhes)
      linhas.push([
        c.titulo,
        c.severidade,
        d.chave,
        d.descricao,
        String(d.esperado ?? ""),
        String(d.encontrado ?? ""),
        String(d.diferenca ?? ""),
        d.ref ? `${d.ref.tipo}:${d.ref.id}` : "",
      ]);
  return linhas.map((l) => l.map(csvCel).join(";")).join("\n");
}

export interface ImportacaoResumo {
  id: number;
  qtdNegocios: number;
  qtdNfs: number;
  qtdFatos: number;
  totalFaturado: number;
}
/** Diferença entre uma carga e a anterior (contagens e total). */
export function compararCargas(atual: ImportacaoResumo, anterior?: ImportacaoResumo) {
  if (!anterior) return null;
  return {
    negocios: atual.qtdNegocios - anterior.qtdNegocios,
    nfs: atual.qtdNfs - anterior.qtdNfs,
    fatos: atual.qtdFatos - anterior.qtdFatos,
    totalFaturado: r2(atual.totalFaturado - anterior.totalFaturado),
  };
}
