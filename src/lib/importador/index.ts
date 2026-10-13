// Importador v2 — orquestração (Fase 5). Parte 2 entra na Fase 6.
import * as XLSX from "xlsx";
import { lerParte1, norm } from "./parte1";
import { lerParte2 } from "./parte2";
import type { Cel, Leitura } from "./tipos";
import { ABAS, compacto } from "./mapa-planilha";
export * from "./mapa-planilha";

export * from "./tipos";
export { lerParte1, lerAgregadosLegado } from "./parte1";
export { lerParte2 } from "./parte2";
export type { FatoRow, CardLiberarRow, ControleRow, ClienteDimRow, ProblemaP2, Parte2 } from "./parte2";

const dados = (ws: XLSX.WorkSheet) => (ws["!data"] ?? []) as Cel[][];

/** Seleciona a aba pelo nome normalizado (sem espaços/acentos/maiúsculas); erro claro se faltar. */
function selecionarAba(wb: XLSX.WorkBook, alvo: string, rotulo: string) {
  const nome = wb.SheetNames.find((n) => compacto(n) === alvo);
  if (!nome)
    throw new Error(
      `Aba ${rotulo} não encontrada (abas no arquivo: ${wb.SheetNames.map((n) => `"${n}"`).join(", ")})`,
    );
  return { nome, data: dados(wb.Sheets[nome]!) };
}
export const selecionarParte1 = (wb: XLSX.WorkBook) => selecionarAba(wb, ABAS.parte1, "Parte 1");

/** SHA-256 (hex) do arquivo, para registrar em `importacoes`. */
export async function hashArquivo(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Etapa = "parte1" | "parte2" | "validando" | "pronto";

export const selecionarParte2 = (wb: XLSX.WorkBook) => selecionarAba(wb, ABAS.parte2, "Parte 2");

/** Lê a planilha (síncrono, sem hash). */
export function lerPlanilhaSync(
  buf: ArrayBuffer,
  progresso?: (e: Etapa) => void,
): Omit<Leitura, "hash"> {
  const wb = XLSX.read(buf, { type: "array", dense: true, cellDates: false });
  progresso?.("parte1");
  const { nome, data } = selecionarParte1(wb);
  const { canon, ...p1 } = lerParte1(data);
  progresso?.("parte2");
  const p2 = selecionarParte2(wb);
  const parte2 = lerParte2(p2.data, canon);
  progresso?.("validando");
  const avisos = [
    ...p1.avisos,
    ...parte2.avisos.map((a) => ({ ...a, titulo: `Parte2 · ${a.titulo}` })),
  ];
  progresso?.("pronto");
  return { aba: nome, agregados: [], ...p1, avisos, parte2 };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Lê a planilha em etapas (cede a vez à tela entre elas, para a barra de progresso). */
export async function lerPlanilha(
  buf: ArrayBuffer,
  progresso?: (e: Etapa) => void,
): Promise<Leitura> {
  progresso?.("parte1");
  await tick();
  const hash = await hashArquivo(buf);
  const wb = XLSX.read(buf, { type: "array", dense: true, cellDates: false });
  const { nome, data } = selecionarParte1(wb);
  const { canon, ...p1 } = lerParte1(data);
  progresso?.("parte2");
  await tick();
  const parte2 = lerParte2(selecionarParte2(wb).data, canon);
  progresso?.("validando");
  await tick();
  const avisos = [
    ...p1.avisos,
    ...parte2.avisos.map((a) => ({ ...a, titulo: `Parte2 · ${a.titulo}` })),
  ];
  progresso?.("pronto");
  return { aba: nome, agregados: [], ...p1, avisos, parte2, hash };
}
