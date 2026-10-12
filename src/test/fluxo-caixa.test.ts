import { describe, it, expect } from "vitest";
import * as M from "@/data/metricas";
import type { Fato } from "@/data/repository";
import { normalizarFiltros, FILTROS_PADRAO } from "@/lib/filtros";

const fato = (p: Partial<Fato>): Fato => ({
  bloco: "recebimento",
  nivel: "produto",
  bu: "Analytics",
  plataforma: "GA",
  contrato: "Licença",
  produto: "GA4",
  itemCobranca: null,
  cliente: null,
  categoria: null,
  mes: "2026-03-01",
  anterior: false,
  valor: 100,
  ...p,
});
const d: M.Dados = {
  negocios: [],
  notas: [],
  clientes: [],
  cards: [],
  fatos: [
    fato({ bloco: "recebimento", mes: "2026-01-01", valor: 100 }),
    fato({ bloco: "vencimento", mes: "2026-01-01", valor: 120 }),
    fato({ bloco: "vencimento", mes: "2026-03-01", valor: 200 }),
    fato({ bloco: "impostos", mes: "2025-12-01", anterior: true, valor: 5 }),
    fato({ bloco: "custo_pagamento", mes: "2027-02-01", valor: 30 }),
    fato({ bloco: "creditos", mes: "2026-01-01", valor: 7 }),
  ],
};
const F = normalizarFiltros({ ...FILTROS_PADRAO, periodo: "ano" }, "2026-01-31", 2026);
const base: M.ParamsCaixa = { visao: "misto", cenario: "base", atrasoPct: 0.5, atrasoDias: 60 };

describe("fluxo de caixa", () => {
  it("misto: recebido até o corte, vencimento depois; custos até fev/27; créditos fora do saldo", () => {
    const l = M.fluxoCaixa(d, F, base);
    expect(l.map((x) => x.mes)).toEqual(["anterior", "2026-01", "2026-03", "2027-02"]);
    expect(l[1]!.entradas).toBe(100);
    expect(l[2]!.entradas).toBe(200);
    expect(l.at(-1)!.acumulado).toBe(-5 + 100 + 200 - 30);
  });
  it("cenário atraso: 50% das entradas projetadas atrasam 60 dias (2 meses)", () => {
    const l = M.fluxoCaixa(d, F, { ...base, cenario: "atraso" });
    expect(l[2]!.entradas).toBe(100);
    expect(l.at(-1)!.acumulado).toBe(-5 + 100 + 100 - 30); // parte deslocada além do horizonte de meses existentes
  });
  it("% do previsto já realizado até o corte", () => {
    expect(M.resumoCaixa(M.fluxoCaixa(d, F, base), "2026-01-31").pctRealizado).toBeCloseTo(
      100 / 120,
    );
  });
});
