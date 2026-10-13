import { fimAnoAnteriorISO, obterAnoBase, mesAnterior } from "@/lib/periodo";
// Importador v2 — Parte 2: história financeira consolidada (Fase 6). Função pura.
// Blocos localizados pelo TÍTULO da linha 2; meses/colunas especiais pela linha 3.
import { ALIAS_CLIENTES, chaveCliente } from "../aliasClientes";
import { produtoDe } from "../produto";
import { grade, norm, num, serialISO } from "./parte1";
import type { Cel } from "./tipos";

import { blocoP2DoTitulo, P2_BLOCOS, P2_CABECALHOS, compacto, parecidos, TOLERANCIA, type Bloco } from "./mapa-planilha";
export type { Bloco } from "./mapa-planilha";

export interface FatoRow {
  bloco: Bloco;
  nivel: "produto" | "cliente";
  bu: string | null;
  plataforma: string | null;
  contrato: string | null;
  produto: string | null;
  item_cobranca: string | null;
  cliente: string | null;
  categoria: "Terceiro" | "Anunciante" | null;
  mes: string; // AAAA-MM-01
  anterior: boolean;
  valor: number;
}
export interface CardLiberarRow {
  cliente: string;
  produto: string;
  plataforma: string;
  contrato: string;
  categoria: string | null;
  valor: number;
}
export interface ControleRow {
  bloco: string;
  mes: string | null;
  valor_planilha: number;
  descricao: string;
}
export interface ClienteDimRow {
  nome: string;
  categoria: string | null;
  ativo: boolean;
}
export interface ProblemaP2 {
  bloco: string;
  linha: number;
  coluna: string;
  msg: string;
}
export interface Parte2 {
  fatos: FatoRow[];
  cards: CardLiberarRow[];
  controles: ControleRow[];
  clientes: ClienteDimRow[];
  problemas: ProblemaP2[];
  avisos: { titulo: string; itens: string[] }[];
  resumo: {
    fatosPorBloco: Record<string, number>;
    secoes: number;
    clientes: number;
    controles: number;
    conciliados: number;
    divergentes: number;
  };
}

const TITULOS: [Bloco, (t: string) => boolean][] = [
  ["pipe_autorizado", (t) => t === "RESUMO PIPE - EMISSAO AUTORIZADA"],
  ["pipe", (t) => t === "RESUMO PIPE"],
  ["fat_emissao", (t) => t.startsWith("RESUMO FATURADO - POR EMISSAO")],
  ["fat_competencia", (t) => t === "RESUMO FATURADO - POR COMPETENCIA"],
  ["dif_pipe_fat", (t) => t.startsWith("DIFERENCAS - ENTRE RESUMO PIPE")],
  ["recebimento", (t) => t === "RESUMO FATURADO - POR RECEBIMENTO"],
  ["vencimento", (t) => t === "RESUMO FATURADO - POR VENCIMENTO"],
  ["dif_venc_receb", (t) => t.startsWith("DIFERENCAS - ENTRE FATURADO POR VENCIMENTO")],
  ["custo_pagamento", (t) => t === "CUSTOS POR PAGAMENTO"],
  ["dif_custo_receb", (t) => t.startsWith("DIFERENCAS - ENTRE RESUMO FATURADO - CUSTOS")],
  ["custo_emissao", (t) => t === "CUSTOS POR EMISSAO"],
  ["impostos", (t) => t === "IMPOSTOS"],
  ["creditos", (t) => t === "CREDITOS"],
];

type Coluna = {
  c: number;
  bloco: Bloco;
  tipo: "mes" | "anterior" | "total" | "a_liberar";
  mes: string | null;
};

const TOL = 0.05;
const r2 = (x: number) => Math.round(x * 100) / 100;
const normProduto = (p: string) => p.trim().replace(/^adserver/i, "Adserver");
/** Nome usado para linhas de seção sem cliente na coluna C (somam no "Totais:"). */
export const SEM_CLIENTE = "(sem cliente)";
const MES_ANTERIOR = () => `${mesAnterior()}-01`;

export function lerParte2(data: Cel[][], canonExt?: (n: string) => string): Parte2 {
  const { cel, v, nRows } = grade(data);
  const t = (r: number, c: number) => {
    const x = String(v(r, c) ?? "").trim();
    return x.toUpperCase() === "NONE" ? "" : x;
  };
  const letra = (c: number) => {
    let s = "";
    for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const problemas: ProblemaP2[] = [];
  const avisos: Parte2["avisos"] = [];
  const aviso = (titulo: string, itens: string[]) => {
    if (itens.length) avisos.push({ titulo: `${titulo} (${itens.length})`, itens });
  };
  const aliasN = new Map(Object.entries(ALIAS_CLIENTES).map(([a, c]) => [chaveCliente(a), c]));
  const canon = canonExt ?? ((n: string) => (aliasN.get(chaveCliente(n)) ?? n).trim());

  // valor numérico de uma célula: vazio/None = 0; texto numérico → número; erro → problema
  const valor = (r: number, c: number, bloco: string): number => {
    const x = cel(r, c);
    if (!x || x.v == null || x.v === "") return 0;
    if (x.t === "e") {
      problemas.push({
        bloco,
        linha: r + 1,
        coluna: letra(c),
        msg: `Fórmula com erro (${x.w ?? x.v})`,
      });
      return 0;
    }
    if (typeof x.v === "string") {
      const s = x.v.trim();
      if (s === "" || s.toUpperCase() === "NONE" || s === "-") return 0;
      if (/^#/.test(s)) {
        problemas.push({ bloco, linha: r + 1, coluna: letra(c), msg: `Fórmula com erro (${s})` });
        return 0;
      }
      const n = num(s) ?? num(s.replace(/\./g, "").replace(",", "."));
      if (n == null) {
        problemas.push({
          bloco,
          linha: r + 1,
          coluna: letra(c),
          msg: `Texto não numérico: "${s}"`,
        });
        return 0;
      }
      return n;
    }
    return num(x.v) ?? 0;
  };

  // ===== Blocos (linha 2) e colunas (linha 3) =====
  const titulos: { c: number; bloco: Bloco; titulo: string }[] = [];
  (data[1] ?? []).forEach((x, c) => {
    const tt = norm(x?.v);
    if (!tt) return;
    const m = TITULOS.find(([, f]) => f(tt));
    if (m) titulos.push({ c, bloco: m[0], titulo: String(x?.v) });
  });
  const faltam = TITULOS.map(([b]) => b).filter((b) => !titulos.some((x) => x.bloco === b));
  if (faltam.length)
    throw new Error(`Parte2: bloco(s) não encontrado(s) na linha 2: ${faltam.join(", ")}`);
  const nCols = Math.max(...data.slice(0, 3).map((r) => r?.length ?? 0));
  const colunas: Coluna[] = [];
  const ajustes: string[] = [];
  for (let i = 0; i < titulos.length; i++) {
    const { c: c0 } = titulos[i]!;
    const c1 = i + 1 < titulos.length ? titulos[i + 1]!.c : nCols;
    const cols: Omit<Coluna, "bloco">[] = [];
    for (let c = c0; c < c1; c++) {
      const h = v(2, c);
      if (typeof h === "number") {
        const iso = serialISO(h);
        if (iso <= fimAnoAnteriorISO()) cols.push({ c, tipo: "anterior", mes: MES_ANTERIOR() });
        else cols.push({ c, tipo: "mes", mes: `${iso.slice(0, 7)}-01` });
      } else {
        const hn = norm(h);
        if (new RegExp(`^<?\\s*31/12/${obterAnoBase() - 1}$`).test(hn))
          cols.push({ c, tipo: "anterior", mes: MES_ANTERIOR() });
        else if (hn.startsWith("TOTAL")) cols.push({ c, tipo: "total", mes: null });
        else if (hn === "A LIBERAR") cols.push({ c, tipo: "a_liberar", mes: null });
      }
    }
    let bloco = titulos[i]!.bloco;
    // Título repetido sem meses (ex.: 2º "Por Vencimento" em DF) = bucket anterior do bloco seguinte
    const prox = titulos[i + 1];
    if (!cols.some((x) => x.tipo === "mes") && prox && prox.bloco.startsWith("dif_")) {
      ajustes.push(
        `Coluna ${letra(c0)} ("${titulos[i]!.titulo}") tratada como anterior de "${prox.titulo}"`,
      );
      bloco = prox.bloco;
    }
    for (const x of cols)
      colunas.push(
        x.tipo === "a_liberar"
          ? { ...x, bloco: "a_liberar", tipo: "mes", mes: `${obterAnoBase()}-01-01` }
          : { ...x, bloco },
      );
  }
  aviso("Ajustes de layout da Parte2", ajustes);
  const colsFato = colunas.filter((x) => x.tipo !== "total");

  // ===== Resumo BU × Produto (linhas 4–18) =====
  const fatos: FatoRow[] = [];
  const controles: ControleRow[] = [];
  const buDoProduto = new Map<string, string>();
  let r = 3;
  const cBU = (data[2] ?? []).findIndex((x) => norm(x?.v) === "BU");
  const cProd = (data[2] ?? []).findIndex((x) => norm(x?.v) === "PRODUTO");
  if (cBU < 0 || cProd < 0)
    throw new Error('Parte2: cabeçalhos "BU" e "Produto" não encontrados na linha 3.');
  const naoLoc: string[] = [];
  const testeBloco = new Map<string, number>(); // produto "Teste" (ignorado nos fatos)
  for (; r < nRows; r++) {
    const bu = t(r, cBU),
      prodBruto = t(r, cProd);
    if (!bu || !prodBruto || /^total/i.test(prodBruto)) break;
    const produto = normProduto(prodBruto);
    if (norm(produto) === "TESTE") {
      for (const col of colsFato) {
        const val = valor(r, col.c, col.bloco);
        if (val) testeBloco.set(col.bloco, (testeBloco.get(col.bloco) ?? 0) + val);
      }
      continue;
    }
    buDoProduto.set(norm(produto), bu);
    for (const col of colsFato) {
      const val = valor(r, col.c, col.bloco);
      if (!val) continue;
      if (norm(produto) === "NAO LOCALIZADO") naoLoc.push(`${col.bloco} ${col.mes}: ${r2(val)}`);
      fatos.push({
        bloco: col.bloco,
        nivel: "produto",
        bu,
        plataforma: null,
        contrato: null,
        produto,
        item_cobranca: null,
        cliente: null,
        categoria: null,
        mes: col.mes!,
        anterior: col.tipo === "anterior",
        valor: val,
      });
    }
  }
  aviso('Produto "Não Localizado" com valores no resumo (qualidade)', naoLoc);

  // ===== Linhas de controle (totais, Á liberar, Check:) até a 1ª seção =====
  const ehCabecalhoSecao = (i: number) =>
    !!t(i, 1) && !!t(i, 2) && norm(t(i + 1, 2)).replace(/:$/, "") === "CLIENTE";
  const rotulo = (i: number, c: number) => {
    for (let k = c - 1; k >= Math.max(0, c - 3); k--) {
      const x = v(i, k);
      if (typeof x === "string" && x.trim()) return x.trim();
    }
    return t(i, cProd) || "";
  };
  const totalBU = new Map<string, number>(); // bloco → soma das linhas "Total <BU>:" (col. Total)
  for (; r < nRows && !ehCabecalhoSecao(r); r++) {
    const rotLinha = t(r, cProd);
    for (const col of colunas) {
      const x = v(r, col.c);
      if (typeof x !== "number") continue;
      controles.push({
        bloco: col.bloco,
        mes: col.mes,
        valor_planilha: x,
        descricao: `Linha ${r + 1} ${letra(col.c)}: ${rotLinha || rotulo(r, col.c) || col.tipo}`,
      });
      if (/^total (analytics|advertising)/i.test(rotLinha) && col.tipo === "total")
        totalBU.set(col.bloco, (totalBU.get(col.bloco) ?? 0) + x);
    }
  }

  // ===== Seções plataforma × contrato × cliente =====
  const cards: CardLiberarRow[] = [];
  const cats = new Map<string, Map<string, number>>();
  const contagem: string[] = [],
    difTotais: string[] = [],
    difProduto: string[] = [],
    semTotais: string[] = [],
    catInval: string[] = [],
    linhasSemCliente: string[] = [];
  let secoes = 0,
    nClientes = 0;
  while (r < nRows) {
    if (!ehCabecalhoSecao(r)) {
      r++;
      continue;
    }
    secoes++;
    const plataforma = t(r, 1),
      contrato = t(r, 2);
    const nome = `${plataforma} ${contrato}`;
    const linhas: number[] = [];
    const semCliente: number[] = [];
    let totais: number | null = null;
    let i = r + 2;
    for (; i < nRows; i++) {
      if (/^totais/i.test(t(i, 1))) {
        totais = i;
        i++;
        break;
      }
      if (ehCabecalhoSecao(i)) break;
      const c = t(i, 2);
      if (!c) {
        // Linha sem nome de cliente mas com valores: entra na linha "Totais:" da planilha,
        // então precisa ser lida (antes era descartada e gerava falsa divergência).
        if (colunas.some((col) => valor(i, col.c, col.bloco) !== 0)) {
          semCliente.push(i);
          linhas.push(i);
        }
        continue;
      }
      if (norm(c).startsWith("DIFERENCAS")) {
        for (const col of colunas) {
          const x = v(i, col.c);
          if (typeof x === "number" && x)
            controles.push({
              bloco: col.bloco,
              mes: col.mes,
              valor_planilha: x,
              descricao: `Linha ${i + 1} ${letra(col.c)}: ${t(i, 1) || nome} Diferenças`,
            });
        }
        continue;
      }
      linhas.push(i);
    }
    r = i;
    const prodSecao = normProduto(
      totais != null && t(totais, 3) ? t(totais, 3) : produtoDe(plataforma, contrato),
    );
    if (totais == null)
      semTotais.push(`${nome}: sem linha "Totais:" (produto deduzido: ${prodSecao})`);
    const bu =
      buDoProduto.get(norm(prodSecao)) ??
      (plataforma.toUpperCase() === "GA360" ? "Analytics" : "Advertising");
    const nSemCliente = linhas.filter((li) => !t(li, 2)).length;
    if (nSemCliente)
      linhasSemCliente.push(
        `${nome}: ${nSemCliente} linha(s) sem nome de cliente com valores — lidas como "${SEM_CLIENTE}"`,
      );
    nClientes += linhas.length - nSemCliente;

    const somaCol = new Map<number, number>();
    for (const li of linhas) {
      const a = t(li, 0);
      if (a && norm(normProduto(a)) !== norm(prodSecao))
        difProduto.push(
          `Linha ${li + 1} (${nome}): coluna A "${a}" × seção "${prodSecao}" — usado o da seção`,
        );
      const cliente = t(li, 2) ? canon(t(li, 2)) : SEM_CLIENTE;
      const catB = t(li, 3);
      const categoria = catB === "Terceiro" || catB === "Anunciante" ? catB : null;
      if (catB && !categoria) catInval.push(`Linha ${li + 1}: "${catB}"`);
      if (cliente === SEM_CLIENTE) {
        // não entra no cadastro de clientes
      } else if (categoria) {
        const k = cliente;
        const m = cats.get(k) ?? new Map<string, number>();
        m.set(categoria, (m.get(categoria) ?? 0) + 1);
        cats.set(k, m);
      } else if (!cats.has(cliente)) cats.set(cliente, new Map());
      const cardV = valor(li, 4, "cards_liberar");
      somaCol.set(4, (somaCol.get(4) ?? 0) + cardV);
      if (cliente !== SEM_CLIENTE)
        cards.push({ cliente, produto: prodSecao, plataforma, contrato, categoria, valor: cardV });
      for (const col of colunas) {
        const val = valor(li, col.c, col.bloco);
        somaCol.set(col.c, (somaCol.get(col.c) ?? 0) + val);
        if (!val || col.tipo === "total") continue;
        fatos.push({
          bloco: col.bloco,
          nivel: "cliente",
          bu,
          plataforma,
          contrato,
          produto: prodSecao,
          item_cobranca: t(li, 1) || null,
          cliente,
          categoria,
          mes: col.mes!,
          anterior: col.tipo === "anterior",
          valor: val,
        });
      }
    }
    if (totais != null) {
      const m = /(\d+)\s*clientes?/i.exec(t(totais, 2));
      if (m) {
        const esperado = Number(m[1]);
        controles.push({
          bloco: "secao",
          mes: null,
          valor_planilha: esperado,
          descricao: `${nome}: ${m[0]}`,
        });
        const lidos = linhas.length - semCliente.length;
        if (esperado !== lidos) contagem.push(`${nome}: planilha ${esperado} × lidos ${lidos}`);
      }
      for (const [c, soma] of somaCol) {
        const tot = valor(totais, c, "secao");
        if (Math.abs(tot - soma) > TOL) {
          const col = colunas.find((x) => x.c === c);
          difTotais.push(
            `${nome} · ${col ? `${col.bloco} ${col.tipo === "total" ? "Total" : col.mes}` : "Cards a Liberar"} (${letra(c)}): clientes ${r2(soma)} × Totais ${r2(tot)}`,
          );
        }
        const col = colunas.find((x) => x.c === c);
        if (col?.tipo === "total")
          controles.push({
            bloco: col.bloco,
            mes: null,
            valor_planilha: tot,
            descricao: `Totais ${nome}`,
          });
      }
    }
  }

  // ===== Conciliação: soma das seções × resumo BU×produto =====
  const chave = (f: FatoRow) => `${f.bloco}|${norm(f.produto)}|${f.mes}|${f.anterior}`;
  const somaNivel = (nivel: FatoRow["nivel"]) => {
    const m = new Map<string, number>();
    for (const f of fatos) if (f.nivel === nivel) m.set(chave(f), (m.get(chave(f)) ?? 0) + f.valor);
    return m;
  };
  const sp = somaNivel("produto"),
    sc = somaNivel("cliente");
  const centavos: string[] = [],
    divResumo: string[] = [],
    sinal = new Map<string, number>();
  let conciliados = 0;
  for (const k of new Set([...sp.keys(), ...sc.keys()])) {
    const [b, p, mes, ant] = k.split("|");
    if (p === "NAO LOCALIZADO") continue;
    const d = (sc.get(k) ?? 0) - (sp.get(k) ?? 0);
    const txt = `${b} · ${p} · ${ant === "true" ? `<31/12/${obterAnoBase() - 1}` : mes!.slice(0, 7)}: seções ${r2(sc.get(k) ?? 0)} × resumo ${r2(sp.get(k) ?? 0)}`;
    if (Math.abs(d) <= TOL) conciliados++;
    else if (b!.startsWith("dif_") && Math.abs((sc.get(k) ?? 0) + (sp.get(k) ?? 0)) <= TOL) {
      conciliados++;
      sinal.set(b!, (sinal.get(b!) ?? 0) + 1);
    } else if (Math.abs(d) < 1) centavos.push(txt);
    else divResumo.push(txt);
  }
  // Total do resumo por bloco × linhas "Total <BU>:"
  const divBU: string[] = [];
  for (const [b, tot] of totalBU) {
    const soma =
      fatos.filter((f) => f.nivel === "produto" && f.bloco === b).reduce((a, f) => a + f.valor, 0) +
      (testeBloco.get(b) ?? 0);
    if (Math.abs(soma - tot) > TOL)
      divBU.push(`${b}: fatos ${r2(soma)} × "Total <BU>:" ${r2(tot)}`);
    else conciliados++;
  }

  // clientes_dim
  const clientes: ClienteDimRow[] = [];
  const catDiv: string[] = [];
  for (const [nome, m] of cats) {
    const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (ord.length > 1)
      catDiv.push(
        `${nome}: ${ord.map(([c, n]) => `${c} (${n})`).join(" × ")} — usado ${ord[0]![0]}`,
      );
    clientes.push({ nome, categoria: ord[0]?.[0] ?? null, ativo: true });
  }

  aviso(
    "Diferenças com sinal invertido entre seções e resumo (conciliadas; Necessita validação)",
    [...sinal].map(([b, n]) => `${b}: ${n} combinação(ões) produto × mês`),
  );
  aviso(
    'Produto "Teste" ignorado nos fatos (usado só na conferência dos totais)',
    [...testeBloco].filter(([, x]) => x).map(([b, x]) => `${b}: ${r2(x)}`),
  );
  aviso("Seções sem linha Totais", semTotais);
  aviso("Linhas sem cliente com valores (lidas)", linhasSemCliente);
  aviso('Clientes lidos × "N Clientes" da seção', contagem);
  aviso("Soma dos clientes × linha Totais da seção", difTotais);
  aviso("Soma das seções × resumo BU×produto — só centavos", centavos);
  aviso("Soma das seções × resumo BU×produto — divergência", divResumo);
  aviso('Resumo × linhas "Total Analytics/Advertising:"', divBU);
  aviso("Produto da coluna A × seção (Necessita validação)", difProduto);
  aviso("Categoria fora de Terceiro/Anunciante", catInval);
  aviso("Cliente com categorias diferentes entre seções", catDiv);

  const fatosPorBloco: Record<string, number> = {};
  for (const f of fatos) fatosPorBloco[f.bloco] = (fatosPorBloco[f.bloco] ?? 0) + 1;
  return {
    fatos,
    cards,
    controles,
    clientes,
    problemas,
    avisos,
    resumo: {
      fatosPorBloco,
      secoes,
      clientes: clientes.length,
      controles: controles.length,
      conciliados,
      divergentes: difTotais.length + divResumo.length + divBU.length + contagem.length,
    },
  };
}
