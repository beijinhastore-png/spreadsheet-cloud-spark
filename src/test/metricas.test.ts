import { describe, it, expect } from "vitest";
import * as M from "@/data/metricas";
import type { Fato } from "@/data/repository";
import type { NotaFiscal } from "@/data/tipos";
import { normalizarFiltros, FILTROS_PADRAO } from "@/lib/filtros";
import { mesReferencia, mesesDoAno, intervaloDoPeriodo } from "@/lib/periodo";

const fato = (p: Partial<Fato>): Fato => ({
  bloco: "fat_competencia",
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
const nf = (p: Partial<NotaFiscal>): NotaFiscal => ({
  id: "1",
  numero: "1",
  negocioId: "N1",
  clienteId: "Acme",
  bu: "Analytics",
  contrato: "Licença",
  competencia: "2026-03",
  valor: 100,
  status: "pendente",
  emissao: "2026-03-10",
  card: "GA4",
  vencimento: "2026-04-10",
  ...p,
});
const dados = (fatos: Fato[], notas: NotaFiscal[] = []): M.Dados => ({
  fatos,
  notas,
  negocios: [],
  clientes: [{ id: "Acme", nome: "Acme", categoria: "Anunciante" }],
  cards: [],
});
const F = (p: Partial<typeof FILTROS_PADRAO> = {}) =>
  normalizarFiltros({ ...FILTROS_PADRAO, periodo: "ano", ...p }, "2026-10-05", 2026);

describe("periodo", () => {
  it("mês de referência limitado ao ano-base", () => {
    expect(mesReferencia("2026-10-05", 2026)).toBe("2026-10");
    expect(mesReferencia("2027-02-01", 2026)).toBe("2026-12");
    expect(mesReferencia("2025-05-01", 2026)).toBe("2026-01");
  });
  it("12 meses do ano-base e trimestre", () => {
    expect(mesesDoAno(2026)).toHaveLength(12);
    expect(intervaloDoPeriodo({ tipo: "trimestre", trimestre: 3, ano: 2026 })).toEqual({
      de: "2026-07",
      ate: "2026-09",
    });
  });
});

describe("métricas", () => {
  it("bucket anterior (dez/2025) não cai em dez/2026", () => {
    const d = dados([
      fato({ mes: "2025-12-01", anterior: true, valor: 999 }),
      fato({ mes: "2026-12-01", valor: 10 }),
    ]);
    const s = M.serieMensal(d, "fat_competencia", F(), 2026);
    expect(s.at(-1)).toEqual({ chave: "2026-12", valor: 10 });
    expect(M.cadeiaDoDinheiro(d, F()).faturadoCompetencia).toBe(10);
  });
  it("custo com defasagem conta no mês de pagamento (inclusive após o ano-base)", () => {
    const d = dados([
      fato({ bloco: "custo_pagamento", mes: "2027-02-01", valor: 50 }),
      fato({ bloco: "custo_pagamento", mes: "2026-03-01", valor: 20 }),
    ]);
    expect(M.cadeiaDoDinheiro(d, F()).custoPagamento).toBe(20);
    expect(
      M.cadeiaDoDinheiro(d, F({ periodo: "intervalo", de: "2026-01", ate: "2027-02" }))
        .custoPagamento,
    ).toBe(70);
  });
  it("margem = fat competência − custos − impostos + créditos", () => {
    const d = dados([
      fato({ valor: 1000 }),
      fato({ bloco: "custo_pagamento", valor: 300 }),
      fato({ bloco: "impostos", valor: 100 }),
      fato({ bloco: "creditos", valor: 50 }),
    ]);
    const c = M.cadeiaDoDinheiro(d, F());
    expect(c.margem).toBe(650);
    expect(c.margemNecessitaValidacao).toBe(true);
  });
  it("filtro de mês e de BU alteram as métricas", () => {
    const d = dados([
      fato({ valor: 100 }),
      fato({ mes: "2026-04-01", valor: 40, bu: "Advertising" }),
    ]);
    expect(M.cadeiaDoDinheiro(d, F({ periodo: "mes", mes: "2026-04" })).faturadoCompetencia).toBe(
      40,
    );
    expect(M.cadeiaDoDinheiro(d, F({ bu: "Analytics" })).faturadoCompetencia).toBe(100);
  });
  it("filtro de cliente usa nível cliente (sem dupla contagem)", () => {
    const d = dados([
      fato({ valor: 100 }),
      fato({ nivel: "cliente", cliente: "Acme", categoria: "Anunciante", valor: 100 }),
    ]);
    expect(M.cadeiaDoDinheiro(d, F()).faturadoCompetencia).toBe(100);
    expect(M.cadeiaDoDinheiro(d, F({ clientes: ["Acme"] })).faturadoCompetencia).toBe(100);
    expect(M.cadeiaDoDinheiro(d, F({ clientes: ["Outro"] })).faturadoCompetencia).toBe(0);
  });
  it("vencido/a vencer e aging dependem da data de referência (fim do período)", () => {
    const d = dados(
      [],
      [
        nf({ vencimento: "2026-08-01", valor: 70 }),
        nf({ id: "2", vencimento: "2026-12-01", valor: 30 }),
      ],
    );
    const c = M.cadeiaDoDinheiro(d, F());
    expect(c.vencido).toBe(70);
    expect(c.aVencer).toBe(30);
    expect(M.aging(d, F()).find((a) => a.faixa === "61–90")?.valor).toBe(70);
    expect(M.cadeiaDoDinheiro(d, F({ periodo: "mes", mes: "2026-07" })).vencido).toBe(0);
  });
  it("curva ABC e topN", () => {
    const abc = M.curvaABC([
      { chave: "a", valor: 80 },
      { chave: "b", valor: 15 },
      { chave: "c", valor: 5 },
    ]);
    expect(abc.map((x) => x.classe)).toEqual(["A", "B", "C"]);
    expect(
      M.topN(
        [
          { chave: "x", valor: 1 },
          { chave: "y", valor: 2 },
        ],
        1,
      )[0]!.chave,
    ).toBe("y");
  });
});

describe("Fase 12 — faturamento", () => {
  it("dias de atraso e antecipação", () => {
    expect(
      M.diasAtrasoNF({ vencimento: "2026-04-10", dataPagamento: "2026-04-15" }, "2026-10-05"),
    ).toBe(5);
    expect(
      M.diasAtrasoNF({ vencimento: "2026-04-10", dataPagamento: "2026-04-08" }, "2026-10-05"),
    ).toBe(-2);
    expect(M.diasAtrasoNF({ vencimento: "2026-11-10" }, "2026-10-05")).toBeNull();
  });
  it("bucket anterior a 2026 fica fora do faturado e das médias", () => {
    const d = dados(
      [],
      [
        nf({ id: "a", valor: 100 }),
        nf({ id: "b", valor: 300, competencia: "2025-11", emissao: "2025-11-05" }),
      ],
    );
    const k = M.kpisFaturamento(d, F({ tipoPeriodo: "ano" } as never), "competencia");
    expect(k.faturado).toBe(100);
    expect(k.ticketMedio).toBe(100);
    expect(k.anterior).toEqual({ valor: 300, qtd: 1 });
  });
  it("conferência NFs × Parte 2 aponta divergência", () => {
    const d = dados([fato({ valor: 90 })], [nf({ valor: 100 })]);
    const c = M.conferenciaFaturado(d, F({ tipoPeriodo: "ano" } as never), "competencia");
    expect(c.diferenca).toBe(10);
    expect(c.diverge).toBe(true);
  });
});
