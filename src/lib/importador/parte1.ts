import { fimAnoAnteriorISO, obterAnoBase } from "@/lib/periodo";
// Importador v3 — Parte 1: negócios e NFs. Layout em mapa-planilha.ts.
import { regimeDoCodigo, REGIME_NAO_IDENTIFICADO } from "../codigosNF";
import { ALIAS_CLIENTES, CLIENTES_EXCLUIDOS, chaveCliente } from "../aliasClientes";
import { statusDerivado } from "../calculos";
import * as XLSX from "xlsx";
import { P1_BLOCOS_NF, P1_NEGOCIOS, parecidos, type BlocoNF, type IdBlocoNF } from "./mapa-planilha";
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
  function blocoNF(def: BlocoNF) {
    const c0 = (data[0] ?? []).findIndex((x) => norm(x?.v) === norm(def.titulo));
    if (c0 < 0) return null;
    const cols: Record<string, number> = {};
    const meses: { c: number; iso: string }[] = [];
    for (let c = c0; c < c0 + 40; c++) {
      const h = v(1, c);
      if (typeof h === "number") meses.push({ c, iso: serialISO(h) });
      else if (h != null && h !== "") {
        const k = norm(h).replace(/:$/, "");
        if (cols[k] == null) cols[k] = c;
        if (k.startsWith("TOTAL")) break;
      }
    }
    const faltaCab = def.cabecalhos.filter((h) => cols[norm(h).replace(/:$/, "")] == null);
    if (faltaCab.length)
      throw new Error(
        `Bloco "${def.titulo}": cabeçalho(s) não encontrado(s) na linha 2: ${faltaCab.join(", ")}`,
      );
    const col = (n: string) => cols[norm(n).replace(/:$/, "")]!;
    const nfs = new Map<string, number>();
    const cNF = col("Nota Fiscal");
    for (let r = 2; r < nRows; r++) {
      const x = txt(r, cNF);
      if (x && !/total/i.test(x) && !nfs.has(x)) nfs.set(x, r);
    }
    return { def, c0, cols, col, meses, nfs };
  }
  type LidoNF = NonNullable<ReturnType<typeof blocoNF>>;

  // ===== Blocos de NF (mapa-planilha.ts) =====
  const lidos = new Map<IdBlocoNF, LidoNF>();
  const faltando: BlocoNF[] = [];
  for (const d of P1_BLOCOS_NF) {
    const b = blocoNF(d);
    if (b) lidos.set(d.id, b);
    else if (d.obrigatorio) faltando.push(d);
  }
  if (faltando.length) {
    const achados = (data[0] ?? []).map((x) => String(x?.v ?? "").trim()).filter(Boolean);
    throw new Error(
      `Parte1: bloco(s) obrigatório(s) não encontrado(s) na linha 1 — ${faltando
        .map(
          (d) =>
            `esperado "${d.titulo}" (mais parecidos: ${
              parecidos(d.titulo, achados)
                .map((p) => `"${p}"`)
                .join(", ") || "nenhum"
            })`,
        )
        .join("; ")}`,
    );
  }
  const MS = lidos.get("mestra")!;
  const AC = lidos.get("adv_comp")!,
    AE = lidos.get("adv_emis")!,
    NC = lidos.get("ana_comp")!,
    NE = lidos.get("ana_emis")!;

  // ===== Cruzamento: lista mestra × blocos por BU =====
  const mestraSet = new Set(MS.nfs.keys());
  const advSet = new Set(AC.nfs.keys()),
    anaSet = new Set(NC.nfs.keys());
  const conf: string[] = [];
  const uniao = (a: LidoNF, b: LidoNF) => new Set([...a.nfs.keys(), ...b.nfs.keys()]);
  for (const [nome, set] of [
    ["Competência (Advertising + Analytics)", uniao(AC, NC)],
    ["Emissão (Advertising + Analytics)", uniao(AE, NE)],
  ] as const) {
    const faltam = [...mestraSet].filter((x) => !set.has(x));
    const sobram = [...set].filter((x) => !mestraSet.has(x));
    if (faltam.length)
      conf.push(`${nome}: ${faltam.length} NF(s) da lista mestra ausentes — ${faltam.join(", ")}`);
    if (sobram.length)
      conf.push(`${nome}: ${sobram.length} NF(s) fora da lista mestra — ${sobram.join(", ")}`);
  }
  for (const [nome, a, b] of [
    ["Advertising", AC, AE],
    ["Analytics", NC, NE],
  ] as const) {
    const so1 = [...a.nfs.keys()].filter((x) => !b.nfs.has(x));
    const so2 = [...b.nfs.keys()].filter((x) => !a.nfs.has(x));
    if (so1.length || so2.length)
      conf.push(
        `${nome}: ${so1.length} só no bloco por competência, ${so2.length} só no por emissão — ${[...so1, ...so2].join(", ")}`,
      );
  }
  const ambos = [...advSet].filter((x) => anaSet.has(x));
  if (ambos.length) conf.push(`Em Advertising e Analytics ao mesmo tempo: ${ambos.join(", ")}`);
  aviso("Cruzamento lista mestra × blocos por BU", conf);

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
  const cCli = MS.col("Cliente"),
    cRaz = MS.col("Razão Social"),
    cCard = MS.col("Nome do Card no Pipe"),
    cPipe = MS.col("Pipe"),
    cNF = MS.col("Nota Fiscal"),
    cVer = MS.col("Cód Verificação"),
    cLink = MS.col("NF"),
    cEmi = MS.col("Emissão"),
    cComp = MS.col("Competência"),
    cVen = MS.col("Vencimento"),
    cSt = MS.col("Status");
  for (const r of MS.nfs.values())
    if (chaveCliente(txt(r, cCli)) !== "não localizado") contar(txt(r, cCli));
  const H = P1_NEGOCIOS.cabecalhos;
  const pipeHdr = (n: string) => {
    const c = (data[0] ?? [])
      .slice(0, P1_NEGOCIOS.ultimaColuna)
      .findIndex((x) => norm(x?.v).replace(/:$/, "") === norm(n).replace(/:$/, ""));
    if (c < 0) throw new Error(`Coluna "${n}" do bloco de negócios não encontrada na linha 1.`);
    return c;
  };
  const pT = pipeHdr(H.titulo),
    pG = pipeHdr(H.ganhoEm),
    pC = pipeHdr(H.contrato),
    pPl = pipeHdr(H.plataforma),
    pV = pipeHdr(H.valor),
    pTot = pipeHdr(H.totalCard),
    pCli = pipeHdr(H.cliente),
    pId = pipeHdr(H.idPipe),
    pAut = pipeHdr(H.autorizada),
    pNF = pipeHdr(H.nf);
  for (let r = 1; r < nRows; r++) if (txt(r, pT) && txt(r, pCli)) contar(txt(r, pCli));

  // razão social → clientes (para inferir "Não localizado")
  const razaoCli = new Map<string, Set<string>>();
  for (const r of MS.nfs.values()) {
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

  const notas: NotaRow[] = [];
  const vistos = new Set<string>();
  const inferidos: string[] = [],
    semCliente: string[] = [],
    excluidos: string[] = [],
    codDesc: string[] = [],
    divStatus: string[] = [],
    divSufixo: string[] = [],
    divComp: string[] = [],
    semCruzamento: string[] = [];
  let semIdPipe = 0,
    totalKD = 0;
  const anoBase = obterAnoBase();
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

    // BU = bloco por competência em que a NF aparece; valores pela matriz desse bloco
    const bu = advSet.has(numero) ? "Advertising" : anaSet.has(numero) ? "Analytics" : "";
    const B = bu === "Advertising" ? AC : bu === "Analytics" ? NC : null;
    const rb = B?.nfs.get(numero);
    let ms =
      B && rb != null
        ? B.meses.map((m) => ({ ...m, val: num(v(rb, m.c)) })).filter((m) => m.val)
        : [];
    if (!ms.length) {
      // sem cruzamento: usa a matriz por emissão da lista mestra (nunca descarta valor)
      ms = MS.meses.map((m) => ({ ...m, val: num(v(r, m.c)) })).filter((m) => m.val);
      semCruzamento.push(
        `NF ${numero}${B ? ` (${bu}: matriz vazia)` : " (fora dos blocos por BU)"} — valor pela lista mestra`,
      );
    }
    if (!ms.length) {
      erros.push({
        modulo: "NF",
        linha: r + 1,
        coluna: letra(cNF),
        msg: `NF ${numero} sem valor na matriz`,
      });
      continue;
    }
    if (ms.length > 1)
      erros.push({
        modulo: "NF",
        linha: (rb ?? r) + 1,
        coluna: letra(ms[1]!.c),
        msg: `NF ${numero} com valor em mais de um mês (somado; competência do 1º)`,
      });
    const valor = ms.reduce((a, m) => a + (m.val ?? 0), 0);
    totalKD += valor;
    const col = ms[0]!;
    const anterior = col.iso <= fimAnoAnteriorISO();
    const vComp = v(r, cComp);
    const compMestra = typeof vComp === "number" ? serialISO(vComp).slice(0, 7) : null;
    const suf = sufixoMes(card);
    let competencia: string;
    if (B && rb != null) {
      competencia = anterior
        ? compMestra && compMestra < `${anoBase}-01`
          ? compMestra
          : `${anoBase - 1}-${pad(suf ?? 12)}`
        : col.iso.slice(0, 7);
    } else competencia = compMestra ?? col.iso.slice(0, 7);
    if (compMestra && compMestra !== competencia)
      divComp.push(`NF ${numero}: matriz ${competencia} × "Competência:" ${compMestra}`);
    if (suf == null)
      divSufixo.push(`NF ${numero}: título sem sufixo de mês ("${card}")`);
    else if (Number(competencia.slice(5, 7)) !== suf)
      divSufixo.push(
        `NF ${numero}: matriz ${competencia} × sufixo ${MESES[suf - 1]} ("${card}")`,
      );
    const cp = cel(r, cPipe);
    const linkPipe = cp?.l?.Target ?? (txt(r, cPipe) || null);
    const idm = linkPipe ? /deal\/(\d+)/.exec(linkPipe) : null;
    if (!idm) semIdPipe++;
    // Código NFS-e e data de pagamento: blocos por BU (cruzando pelo número da NF)
    const codigo = B && rb != null ? txt(rb, B.col("Código")) : "";
    const regime = regimeDoCodigo(codigo);
    if (regime === REGIME_NAO_IDENTIFICADO)
      codDesc.push(`NF ${numero}: código "${codigo}" — ${REGIME_NAO_IDENTIFICADO}`);
    const emissao = dataISO(r, cEmi, true),
      venc = dataISO(r, cVen, true),
      pag = B && rb != null ? dataISO(rb, B.col("Data Pagamento"), false) : null;
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
      bu,
      valor: Math.round(valor * 100) / 100,
      data_competencia: competencia,
      data_emissao: emissao,
      data_vencimento: venc,
      data_pagamento: pag,
      cod_verificacao: txt(r, cVer) || null,
    });
  }
  aviso("NFs da lista mestra sem cruzamento nos blocos por BU", semCruzamento);
  aviso("Clientes inferidos pela razão social", inferidos);
  aviso('NFs sem cliente ("Sem cliente")', semCliente);
  aviso("Excluídos da importação", excluidos);
  aviso("Códigos desconhecidos", codDesc);
  aviso("Inconsistência: sufixo do card × matriz por competência", divSufixo);
  aviso('Competência: matriz × coluna "Competência:" da lista mestra', divComp);
  aviso("Status da planilha × calculado (informativo)", divStatus);
  if (semIdPipe) aviso('NFs sem ID do Pipe (link "Não Localizado")', [`${semIdPipe} nota(s)`]);
  const aliasUsados = Object.entries(ALIAS_CLIENTES).map(([a, c]) => `${a} → ${c}`);
  aviso("Clientes unidos por alias", aliasUsados);
  const resumoP1 = {
    porBloco: Object.fromEntries([...lidos].map(([id, b]) => [id, b.nfs.size])) as Record<
      string,
      number
    >,
    porBU: {
      Advertising: notas.filter((n) => n.bu === "Advertising").length,
      Analytics: notas.filter((n) => n.bu === "Analytics").length,
      "Sem BU": notas.filter((n) => !n.bu).length,
    },
    cruzadas: notas.length - semCruzamento.length,
    semCruzamento: semCruzamento.length,
  };

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
    resumoP1,
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
