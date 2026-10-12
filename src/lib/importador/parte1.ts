import { fimAnoAnteriorISO, obterAnoBase } from "@/lib/periodo";
// Importador v2 — Parte 1: negócios e NFs (Fase 5).
import { regimeDoCodigo, REGIME_NAO_IDENTIFICADO } from "../codigosNF";
import { ALIAS_CLIENTES, CLIENTES_EXCLUIDOS, chaveCliente } from "../aliasClientes";
import { statusDerivado } from "../calculos";
import * as XLSX from "xlsx";
import type {
  AgregadoRow,
  Cel,
  Leitura,
  NegocioRow,
  NotaRow,
  Problema,
  VinculoNegocioNF,
} from "./tipos";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
export const pad = (n: number) => String(n).padStart(2, "0");
export const serialISO = (n: number) =>
  new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10);
const letra = (c: number) => XLSX.utils.encode_col(c);
export const num = (v: unknown) =>
  typeof v === "number"
    ? v
    : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))
      ? Number(v)
      : null;
const sufixoMes = (t: string) => {
  const m = /(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*$/i.exec(t.trim());
  return m ? MESES.indexOf(m[1]!.toUpperCase()) + 1 : null;
};

/** Acesso à grade densa de uma aba. */
export function grade(data: Cel[][]) {
  const cel = (r: number, c: number): Cel => data[r]?.[c];
  const v = (r: number, c: number) => cel(r, c)?.v;
  const txt = (r: number, c: number) => String(v(r, c) ?? "").trim();
  const acharNaLinha = (r: number, titulo: string) =>
    (data[r] ?? []).findIndex((x) => norm(x?.v) === norm(titulo));
  const exigir = (r: number, titulo: string) => {
    const c = acharNaLinha(r, titulo);
    if (c < 0) throw new Error(`Bloco "${titulo}" não encontrado na linha ${r + 1}.`);
    return c;
  };
  return { cel, v, txt, acharNaLinha, exigir, nRows: data.length };
}

export type Parte1 = Omit<Leitura, "aba" | "hash" | "agregados" | "parte2"> & {
  canon: (nome: string) => string;
};

/** Lê a aba Parte1 (detalhe de negócios e NFs). Função pura. */
export function lerParte1(data: Cel[][]): Parte1 {
  const { cel, v, txt, acharNaLinha, exigir, nRows } = grade(data);
  const erros: Problema[] = [];
  const avisos: Leitura["avisos"] = [];
  const aviso = (titulo: string, itens: string[]) => {
    if (itens.length) avisos.push({ titulo: `${titulo} (${itens.length})`, itens });
  };

  // Cabeçalhos de um bloco de NFs (linha 2), do início até "Total:"
  function blocoNF(titulo: string) {
    const c0 = exigir(0, titulo);
    const cols: Record<string, number> = {};
    const meses: { c: number; iso: string }[] = [];
    for (let c = c0; c < c0 + 40; c++) {
      const h = v(1, c);
      if (typeof h === "number") meses.push({ c, iso: serialISO(h) });
      else if (h != null && h !== "") {
        cols[norm(h).replace(/:$/, "")] = c;
        if (norm(h).startsWith("TOTAL")) break;
      }
    }
    const col = (n: string) => {
      const c = cols[norm(n)];
      if (c == null) throw new Error(`Coluna "${n}" não encontrada no bloco "${titulo}".`);
      return c;
    };
    const nfs = new Map<string, number>();
    const cNF = col("Nota Fiscal");
    for (let r = 2; r < nRows; r++) {
      const x = txt(r, cNF);
      if (x && !/total/i.test(x)) {
        if (!nfs.has(x)) nfs.set(x, r);
      }
    }
    return { c0, cols, col, meses, nfs };
  }

  // ===== Notas fiscais =====
  const JC = blocoNF("FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF");
  const KD = blocoNF("FATURADO POR COMPETENCIA - POR NF");
  const LD = blocoNF("ADVERTISING - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF");
  const MD = blocoNF("ADVERTISING - FATURADO POR CLIENTE - POR EMISSÃO - POR NF");
  const NE = blocoNF("Analytics - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF");
  const OE = blocoNF("Analytics - FATURADO POR CLIENTE - POR EMISSÃO - POR NF");
  const PE = blocoNF("FATURADO POR EMISSÃO - POR NF");

  // conferência entre blocos
  const fonte = new Set(JC.nfs.keys());
  const conf: string[] = [];
  const advSet = new Set([...LD.nfs.keys()]),
    anaSet = new Set([...NE.nfs.keys()]);
  for (const [nome, b, esperado] of [
    ["KD (competência)", KD, fonte],
    ["PE (emissão)", PE, fonte],
    ["LD (Advertising competência)", LD, null],
    ["MD (Advertising emissão)", MD, advSet],
    ["NE (Analytics competência)", NE, null],
    ["OE (Analytics emissão)", OE, anaSet],
  ] as const) {
    const s = new Set(b.nfs.keys());
    const ref = esperado ?? fonte;
    const soBloco = [...s].filter((x) => !fonte.has(x));
    const faltam = esperado ? [...ref].filter((x) => !s.has(x)) : [];
    if (soBloco.length || faltam.length)
      conf.push(
        `${nome}: ${faltam.length} ausentes, ${soBloco.length} só neste bloco${[...faltam, ...soBloco].length ? ` — ex.: ${[...faltam, ...soBloco].slice(0, 5).join(", ")}` : ""}`,
      );
  }
  const semBU = [...fonte].filter((x) => !advSet.has(x) && !anaSet.has(x));
  const ambos = [...fonte].filter((x) => advSet.has(x) && anaSet.has(x));
  if (semBU.length) conf.push(`Sem BU (fora de LD e NE): ${semBU.join(", ")}`);
  if (ambos.length) conf.push(`Em Advertising e Analytics ao mesmo tempo: ${ambos.join(", ")}`);
  aviso("Conferência entre blocos", conf);

  // nomes canônicos de clientes
  const aliasN = new Map(Object.entries(ALIAS_CLIENTES).map(([a, c]) => [chaveCliente(a), c]));
  const grafias = new Map<string, Map<string, number>>();
  const contar = (bruto: string) => {
    const nome = (aliasN.get(chaveCliente(bruto)) ?? bruto).trim();
    const k = chaveCliente(nome);
    const m = grafias.get(k) ?? new Map<string, number>();
    m.set(nome, (m.get(nome) ?? 0) + 1);
    grafias.set(k, m);
  };
  const canon = (nome: string) => {
    const alvo = aliasN.get(chaveCliente(nome)) ?? nome;
    const m = grafias.get(chaveCliente(alvo));
    return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0] : alvo.trim();
  };
  const cCli = JC.col("Cliente"),
    cRaz = JC.col("Razão Social"),
    cCard = JC.col("Nome do Card no Pipe"),
    cPipe = JC.col("Pipe"),
    cNF = JC.col("Nota Fiscal"),
    cLink = JC.col("NF"),
    cCod = JC.col("Código"),
    cEmi = JC.col("Emissão"),
    cVen = JC.col("Vencimento"),
    cPag = JC.col("Data Pagamento"),
    cSt = JC.col("Status");
  const pipeC0 = 0;
  for (const r of JC.nfs.values())
    if (chaveCliente(txt(r, cCli)) !== "não localizado") contar(txt(r, cCli));
  const pipeHdr = (n: string) => {
    const c = (data[0] ?? [])
      .slice(pipeC0, 12)
      .findIndex((x) => norm(x?.v).replace(/:$/, "") === norm(n).replace(/:$/, ""));
    if (c < 0) throw new Error(`Coluna "${n}" do bloco Pipe não encontrada.`);
    return c;
  };
  const pT = pipeHdr("PIPE: Negócio - Título"),
    pG = pipeHdr("Negócio - Ganho em"),
    pC = pipeHdr("Contrato"),
    pPl = pipeHdr("Plataforma"),
    pV = pipeHdr("Negócio - Valor"),
    pTot = pipeHdr("Total p/ Card"),
    pCli = pipeHdr("Cliente:"),
    pId = pipeHdr("Pipe:"),
    pAut = pipeHdr("Autorizada emissão"),
    pNF = pipeHdr("NF");
  for (let r = 1; r < nRows; r++) if (txt(r, pT) && txt(r, pCli)) contar(txt(r, pCli));

  // razão social → clientes (para inferir "Não localizado")
  const razaoCli = new Map<string, Set<string>>();
  for (const r of JC.nfs.values()) {
    const c = txt(r, cCli);
    if (chaveCliente(c) === "não localizado") continue;
    const k = norm(txt(r, cRaz));
    (razaoCli.get(k) ?? razaoCli.set(k, new Set()).get(k)!).add(canon(c));
  }

  const dataISO = (r: number, c: number, obrig: boolean) => {
    const x = v(r, c);
    if (typeof x === "number") return serialISO(x);
    if (x == null || x === "") {
      if (obrig)
        erros.push({ modulo: "NF", linha: r + 1, coluna: letra(c), msg: "Data obrigatória vazia" });
      return null;
    }
    erros.push({
      modulo: "NF",
      linha: r + 1,
      coluna: letra(c),
      msg: `Data inválida: "${String(x)}"`,
    });
    return null;
  };

  const peComp = PE.col("Competência"),
    peNF = PE.col("Nota Fiscal");
  const pePorNF = new Map<string, string>();
  for (let r = 2; r < nRows; r++) {
    const n = txt(r, peNF);
    const c = v(r, peComp);
    if (n && typeof c === "number") pePorNF.set(n, serialISO(c).slice(0, 7));
  }

  const notas: NotaRow[] = [];
  const vistos = new Set<string>();
  const inferidos: string[] = [],
    semCliente: string[] = [],
    excluidos: string[] = [],
    codDesc: string[] = [],
    divStatus: string[] = [],
    divSufixo: string[] = [],
    divPE: string[] = [];
  let semIdPipe = 0,
    totalKD = 0;
  for (let r = 2; r < nRows; r++) {
    const numero = txt(r, cNF);
    if (!numero || /total/i.test(numero)) continue;
    if (vistos.has(numero)) {
      erros.push({
        modulo: "NF",
        linha: r + 1,
        coluna: letra(cNF),
        msg: `NF ${numero} repetida no arquivo`,
      });
      continue;
    }
    vistos.add(numero);
    let cliente = txt(r, cCli);
    let inferido = false;
    if (CLIENTES_EXCLUIDOS.some((x) => chaveCliente(x) === chaveCliente(cliente))) {
      excluidos.push(`NF ${numero} — cliente "${cliente}"`);
      continue;
    }
    const card = txt(r, cCard);
    if (chaveCliente(cliente) === "não localizado") {
      const set = razaoCli.get(norm(txt(r, cRaz)));
      if (set && set.size === 1) {
        cliente = [...set][0]!;
        inferido = true;
        inferidos.push(`NF ${numero} → ${cliente} (razão: ${txt(r, cRaz)})`);
      } else {
        cliente = "Sem cliente";
        semCliente.push(`NF ${numero} — ${txt(r, cRaz)}`);
      }
    } else cliente = canon(cliente);
    // valores: matriz do bloco KD
    const rk = KD.nfs.get(numero);
    const ms =
      rk == null ? [] : KD.meses.map((m) => ({ ...m, val: num(v(rk, m.c)) })).filter((m) => m.val);
    if (!ms.length) {
      erros.push({
        modulo: "NF",
        linha: r + 1,
        coluna: letra(cNF),
        msg: `NF ${numero} sem valor na matriz do bloco KD`,
      });
      continue;
    }
    if (ms.length > 1)
      erros.push({
        modulo: "NF",
        linha: (rk ?? r) + 1,
        coluna: letra(ms[1]!.c),
        msg: `NF ${numero} com valor em mais de um mês (somado; competência do 1º)`,
      });
    const valor = ms.reduce((a, m) => a + (m.val ?? 0), 0);
    totalKD += valor;
    const col = ms[0]!;
    const anoCol =
      col.iso === fimAnoAnteriorISO() ? obterAnoBase() - 1 : Number(col.iso.slice(0, 4));
    const mesCol = Number(col.iso.slice(5, 7));
    const suf = sufixoMes(card);
    if (suf == null)
      divSufixo.push(`NF ${numero}: título sem sufixo de mês ("${card}") — usado o mês da coluna`);
    else if (col.iso !== fimAnoAnteriorISO() && suf !== mesCol)
      divSufixo.push(
        `NF ${numero}: sufixo ${MESES[suf - 1]} × coluna ${MESES[mesCol - 1]}/${anoCol} ("${card}")`,
      );
    const competencia = `${anoCol}-${pad(suf ?? mesCol)}`;
    const pe = pePorNF.get(numero);
    if (pe && pe !== competencia) divPE.push(`NF ${numero}: sistema ${competencia} × PE ${pe}`);
    const cp = cel(r, cPipe);
    const linkPipe = cp?.l?.Target ?? (txt(r, cPipe) || null);
    const idm = linkPipe ? /deal\/(\d+)/.exec(linkPipe) : null;
    if (!idm) semIdPipe++;
    const codigo = txt(r, cCod);
    const regime = regimeDoCodigo(codigo);
    if (regime === REGIME_NAO_IDENTIFICADO)
      codDesc.push(`NF ${numero}: código "${codigo}" — ${REGIME_NAO_IDENTIFICADO}`);
    const emissao = dataISO(r, cEmi, true),
      venc = dataISO(r, cVen, true),
      pag = dataISO(r, cPag, false);
    const st = statusDerivado({ vencimento: venc ?? "", dataPagamento: pag ?? undefined });
    if (norm(txt(r, cSt)) !== norm(st))
      divStatus.push(`NF ${numero}: planilha "${txt(r, cSt)}" × calculado "${st}"`);
    notas.push({
      numero_nf: numero,
      id_pipe: idm ? idm[1]! : null,
      cliente,
      cliente_inferido: inferido,
      razao_social: txt(r, cRaz),
      card,
      link_pipe: linkPipe,
      link_nf: cel(r, cLink)?.l?.Target ?? null,
      codigo,
      regime,
      bu: advSet.has(numero) ? "Advertising" : anaSet.has(numero) ? "Analytics" : "",
      valor: Math.round(valor * 100) / 100,
      data_competencia: competencia,
      data_emissao: emissao,
      data_vencimento: venc,
      data_pagamento: pag,
    });
  }
  aviso("Clientes inferidos pela razão social", inferidos);
  aviso('NFs sem cliente ("Sem cliente")', semCliente);
  aviso("Excluídos da importação", excluidos);
  aviso("Códigos desconhecidos", codDesc);
  aviso("Inconsistência: sufixo do card × coluna da matriz", divSufixo);
  aviso("Competência × coluna Competência do bloco PE (informativo)", divPE);
  aviso("Status da planilha × calculado (informativo)", divStatus);
  if (semIdPipe) aviso('NFs sem ID do Pipe (link "Não Localizado")', [`${semIdPipe} nota(s)`]);
  const aliasUsados = Object.entries(ALIAS_CLIENTES).map(([a, c]) => `${a} → ${c}`);
  aviso("Clientes unidos por alias", aliasUsados);

  // ===== Negócios (Pipe) =====
  const negocios: NegocioRow[] = [];
  const vinculos: VinculoNegocioNF[] = [];
  const ids = new Set<string>();
  const buNF = new Map<string, string>();
  notas.forEach((n) => n.id_pipe && !buNF.has(n.id_pipe) && buNF.set(n.id_pipe, n.bu));
  const somaCard = new Map<string, number>();
  for (let r = 1; r < nRows; r++) {
    const t = txt(r, pT);
    if (!t) continue;
    const k = `${chaveCliente(canon(txt(r, pCli)))}|${t}`;
    somaCard.set(k, (somaCard.get(k) ?? 0) + (num(v(r, pV)) ?? 0));
  }
  const divCard: string[] = [];
  for (let r = 1; r < nRows; r++) {
    const titulo = txt(r, pT);
    if (!titulo) continue;
    if (/^total/i.test(titulo)) continue;
    const id = txt(r, pId);
    if (!id) {
      erros.push({ modulo: "Negócio", linha: r + 1, coluna: letra(pId), msg: "ID do Pipe vazio" });
      continue;
    }
    if (ids.has(id)) {
      erros.push({
        modulo: "Negócio",
        linha: r + 1,
        coluna: letra(pId),
        msg: `ID do Pipe ${id} repetido no arquivo`,
      });
      continue;
    }
    ids.add(id);
    const nfNeg = txt(r, pNF);
    if (nfNeg && !/^(-|0|nao localizado|n\/a)$/i.test(norm(nfNeg).toLowerCase()))
      for (const n of nfNeg.split(/[\s,;/]+/).filter(Boolean))
        vinculos.push({ id_pipe: id, numero_nf: n });
    const valor = num(v(r, pV));
    if (valor == null) {
      erros.push({ modulo: "Negócio", linha: r + 1, coluna: letra(pV), msg: "Valor inválido" });
      continue;
    }
    const cliente = canon(txt(r, pCli));
    const plataforma = txt(r, pPl);
    const tot = num(v(r, pTot));
    const calc = somaCard.get(`${chaveCliente(cliente)}|${titulo}`) ?? 0;
    if (tot != null && Math.abs(tot - calc) > 0.01)
      divCard.push(
        `Linha ${r + 1} (${titulo}): planilha ${tot.toFixed(2)} × calculado ${calc.toFixed(2)}`,
      );
    const suf = sufixoMes(titulo);
    negocios.push({
      id_pipe: id,
      cliente,
      titulo,
      ganho_em: typeof v(r, pG) === "number" ? serialISO(v(r, pG) as number) : null,
      bu: buNF.get(id) ?? (plataforma.toUpperCase() === "GA360" ? "Analytics" : "Advertising"),
      plataforma,
      tipo_contrato: txt(r, pC),
      autorizada: norm(txt(r, pAut)) === "SIM",
      valor,
      data_competencia: suf ? `${obterAnoBase()}-${pad(suf)}` : null,
    });
  }
  aviso("Total p/ Card × soma calculada (informativo)", divCard);

  // ===== Vínculo adicional negócio ↔ NF pela coluna "NF:" =====
  const notaPorNum = new Map(notas.map((n) => [n.numero_nf, n]));
  const divVinc: string[] = [];
  const preenchidos: string[] = [];
  for (const { id_pipe, numero_nf } of vinculos) {
    const n = notaPorNum.get(numero_nf);
    if (!n) divVinc.push(`Negócio ${id_pipe}: NF ${numero_nf} não encontrada nos blocos de NF`);
    else if (!n.id_pipe) {
      n.id_pipe = id_pipe;
      preenchidos.push(`NF ${numero_nf} → negócio ${id_pipe}`);
    } else if (n.id_pipe !== id_pipe)
      divVinc.push(
        `NF ${numero_nf}: link do Pipe aponta ${n.id_pipe} × coluna "NF:" do negócio ${id_pipe}`,
      );
  }
  aviso('Vínculo negócio × NF divergente (coluna "NF:" × link do Pipe)', divVinc);
  aviso('NFs sem link do Pipe vinculadas pela coluna "NF:"', preenchidos);

  return {
    negocios,
    notas,
    vinculos,
    erros,
    avisos,
    totalKD: Math.round(totalKD * 100) / 100,
    canon,
  };
}

/**
 * Agregados no layout antigo (Resumo Pipe, Custos, Impostos, Créditos, Cards a Liberar).
 * Mantido só para não perder os agregados até a Fase 6 (Parte 2).
 */
export function lerAgregadosLegado(data: Cel[][], canon: (n: string) => string): AgregadoRow[] {
  const { v, txt, acharNaLinha, exigir, nRows } = grade(data);
  // ===== Agregados apurados (regra 6) =====
  const agregados: AgregadoRow[] = [];
  const resumoC = exigir(1, "Resumo Pipe");
  const prod = (s: string) => s.replace(/^AdServer/i, "Adserver");
  for (const [titulo, tipo] of [
    ["Custos por Pagamento", "custo_pagamento"],
    ["Custos por Emissão", "custo_emissao"],
    ["Impostos", "impostos"],
    ["Créditos", "creditos"],
  ] as const) {
    const c0 = exigir(1, titulo);
    for (let r = 3; r < nRows; r++) {
      const bu = txt(r, resumoC),
        p = txt(r, resumoC + 1);
      if (!bu || !p || /^total/i.test(p)) break;
      for (let c = c0; c < c0 + 16; c++) {
        const h = v(2, c);
        if (typeof h !== "number") break;
        const val = num(v(r, c));
        if (!val) continue;
        agregados.push({
          tipo,
          bu,
          produto: prod(p),
          categoria: null,
          mes: serialISO(h).slice(0, 7),
          valor: val,
        });
      }
    }
  }
  // Cards a Liberar (por seção/categoria/mês) + categoria por cliente
  const somaCat = new Map<string, AgregadoRow>();
  const add = (
    tipo: string,
    produto: string | null,
    categoria: string,
    mes: string | null,
    val: number,
  ) => {
    const k = [tipo, produto, categoria, mes].join("|");
    const a = somaCat.get(k) ?? { tipo, bu: null, produto, categoria, mes, valor: 0 };
    a.valor += val;
    somaCat.set(k, a);
  };
  for (let r = 2; r < nRows; r++) {
    const c = acharNaLinha(r, "Cards a Liberar");
    if (c < 2 || norm(v(r, c - 1)) !== "CATEGORIA") continue;
    const secao = txt(r - 1, c - 2) || null;
    for (let i = r + 1; i < nRows; i++) {
      const cat = txt(i, c - 1);
      if (cat !== "Terceiro" && cat !== "Anunciante") break;
      add("cards_liberar", secao, cat, null, num(v(i, c)) ?? 0);
      add("categoria_cliente", canon(txt(i, c - 2)), cat, null, 0);
      for (let k = c + 1; k < c + 15; k++) {
        const h = v(r, k);
        if (typeof h !== "number") break;
        const val = num(v(i, k));
        if (val) add("pipe_categoria", secao, cat, serialISO(h).slice(0, 7), val);
      }
    }
  }
  agregados.push(...somaCat.values());

  return agregados;
}
