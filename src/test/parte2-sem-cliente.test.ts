import { describe, expect, it } from "vitest";
import { lerParte2, SEM_CLIENTE } from "@/lib/importador/parte2";
import { classificarAvisos } from "@/lib/conciliacao";
import type { Cel } from "@/lib/importador/tipos";

const TIT = [
  "Resumo Pipe", "Resumo Pipe - Emissão autorizada", "Resumo Faturado - Por Emissão (RPS)",
  "Resumo Faturado - Por Competência", "Diferenças - Entre Resumo Pipe e Faturado",
  "Resumo Faturado - Por Recebimento", "Resumo Faturado - Por Vencimento",
  "Diferenças - Entre Faturado por vencimento e por recebimento", "Custos por Pagamento",
  "Diferenças - Entre Resumo Faturado - Custos", "Custos por Emissão", "Impostos", "Créditos",
];
const JAN26 = 46023; // serial Excel de 01/01/2026
const c = (v: unknown): Cel => ({ v, t: typeof v === "number" ? "n" : "s" });

function grade(): Cel[][] {
  const W = 6 + TIT.length;
  const linha = () => Array.from({ length: W }, () => undefined as Cel);
  const r2 = linha(), r3 = linha();
  r3[3] = c("BU");
  r3[4] = c("Produto");
  TIT.forEach((t, i) => {
    r2[6 + i] = c(t);
    r3[6 + i] = c(JAN26);
  });
  const resumo = linha();
  resumo[3] = c("Advertising");
  resumo[4] = c("Programática Serviço");
  const custo = 6 + 8; // coluna "Custos por Pagamento"
  resumo[custo] = c(100);
  const hdr = linha(); hdr[1] = c("DV360"); hdr[2] = c("Serviço");
  const sub = linha(); sub[2] = c("Cliente:");
  const cli = linha(); cli[0] = c("Programática Serviço"); cli[2] = c("Acme"); cli[3] = c("Terceiro"); cli[custo] = c(110);
  const sem = linha(); sem[0] = c("Programática Serviço"); sem[custo] = c(-10);
  const tot = linha(); tot[1] = c("Totais:"); tot[2] = c("1 Clientes"); tot[3] = c("Programática Serviço"); tot[custo] = c(100);
  return [linha(), r2, r3, resumo, linha(), hdr, sub, cli, sem, tot];
}

describe("Parte2 — linhas de seção sem cliente (Rodada 1)", () => {
  const p = lerParte2(grade());
  it("lê a linha sem cliente para fechar com a linha Totais", () => {
    const f = p.fatos.filter((x) => x.nivel === "cliente" && x.bloco === "custo_pagamento");
    expect(f.reduce((a, x) => a + x.valor, 0)).toBe(100);
    expect(f.some((x) => x.cliente === SEM_CLIENTE)).toBe(true);
  });
  it("não acusa divergência de Totais nem de contagem de clientes", () => {
    const t = p.avisos.map((a) => a.titulo).join("|");
    expect(t).not.toMatch(/linha Totais da seção/);
    expect(t).not.toMatch(/"N Clientes"/);
    expect(t).toMatch(/Linhas sem cliente com valores/);
    expect(p.clientes.map((x) => x.nome)).toEqual(["Acme"]);
  });
  it("classifica o aviso como inconsistência da planilha", () => {
    const g = classificarAvisos(p.avisos).find((x) => /sem cliente/.test(x.titulo))!;
    expect(g.classe).toBe("planilha");
  });
});
