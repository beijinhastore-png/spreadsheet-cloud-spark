import { describe, it, expect } from "vitest";
import {
  checarFaturadoCompetencia,
  checarFaturadoEmissao,
  checarALiberar,
  checarControlesCheck,
  checarTotalGeral,
  checarPendencias,
  checarDefasagemCustos,
  notaConfianca,
  executarChecagens,
  mesDe,
  divergenciasCSV,
  type EntradaQualidade,
  type QFato,
  type QNF,
} from "@/lib/qualidade";

const nf = (p: Partial<QNF>): QNF => ({
  id: "1",
  negocioId: "N1",
  clienteId: "Acme",
  bu: "Analytics",
  card: "GA4",
  competencia: "2026-03",
  emissao: "2026-03-10",
  vencimento: "2026-04-10",
  valor: 100,
  regime: "ISS",
  ...p,
});
const fato = (p: Partial<QFato>): QFato => ({
  bloco: "fat_competencia",
  nivel: "produto",
  bu: "Analytics",
  produto: "GA4",
  plataforma: null,
  contrato: null,
  cliente: null,
  categoria: null,
  mes: "2026-03-01",
  anterior: false,
  valor: 100,
  ...p,
});
const base = (p: Partial<EntradaQualidade> = {}): EntradaQualidade => ({
  notas: [nf({})],
  negocios: [
    {
      id: "N1",
      clienteId: "Acme",
      bu: "Analytics",
      produto: "GA4",
      competencia: "2026-03",
      valor: 100,
      autorizada: true,
    },
  ],
  fatos: [fato({})],
  controles: [],
  ...p,
});

describe("qualidade", () => {
  it("mesDe aceita formatos", () => {
    expect(mesDe("15/09/2026")).toBe("2026-09");
    expect(mesDe("2026-09-15")).toBe("2026-09");
  });
  it("faturado por competência bate", () => {
    expect(checarFaturadoCompetencia(base()).severidade).toBe("ok");
  });
  it("faturado por competência divergente aponta o mês", () => {
    const c = checarFaturadoCompetencia(base({ fatos: [fato({ valor: 90 })] }));
    expect(c.severidade).toBe("erro");
    expect(c.diferenca).toBe(10);
    expect(c.detalhes[0]?.chave).toBe("2026-03");
  });
  it("emissão antes de 2026 cai no bucket anterior", () => {
    const e = base({
      notas: [nf({ emissao: "2025-11-20" })],
      fatos: [fato({ bloco: "fat_emissao", anterior: true, mes: "2025-12-01" })],
    });
    expect(checarFaturadoEmissao(e).severidade).toBe("ok");
  });
  it("a liberar = pipe − pipe autorizado", () => {
    const e = base({
      negocios: [
        {
          id: "A",
          clienteId: "x",
          bu: "Analytics",
          produto: "GA4",
          competencia: "2026-01",
          valor: 300,
          autorizada: true,
        },
        {
          id: "B",
          clienteId: "x",
          bu: "Analytics",
          produto: "GA4",
          competencia: "2026-01",
          valor: 50,
          autorizada: false,
        },
      ],
      fatos: [fato({ bloco: "a_liberar", valor: 50 })],
    });
    expect(checarALiberar(e).severidade).toBe("ok");
  });
  it("linha Check: diferente de zero é erro", () => {
    const c = checarControlesCheck(
      base({
        controles: [{ bloco: "x", mes: null, valorPlanilha: 5, descricao: "Linha 23 B: Check:" }],
      }),
    );
    expect(c.severidade).toBe("erro");
  });
  it("total geral: diferença de R$ 10,00 lista NF candidata", () => {
    const e = base({
      notas: [nf({ id: "A", valor: 1000 }), nf({ id: "B", valor: 10 })],
      controles: [
        {
          bloco: "fat_competencia",
          mes: null,
          valorPlanilha: 1020,
          descricao: "Linha 23 AV: Total",
        },
      ],
    });
    const c = checarTotalGeral(e);
    expect(c.diferenca).toBe(-10);
    expect(c.detalhes.some((d) => d.ref?.id === "B")).toBe(true);
  });
  it("pendências: NF sem negócio e Não Localizado", () => {
    const ps = checarPendencias(
      base({
        notas: [nf({ negocioId: "" })],
        fatos: [fato({ produto: "Não Localizado", valor: 160000 })],
      }),
    );
    expect(ps.find((p) => p.id === "nf_sem_negocio")!.encontrado).toBe(1);
    expect(ps.find((p) => p.id === "nao_localizado")!.severidade).toBe("aviso");
  });
  it("defasagem de custos é informativa e nunca erro", () => {
    const e = base({
      fatos: [
        fato({ bloco: "custo_emissao", mes: "2026-01-01", valor: 40 }),
        fato({ bloco: "custo_pagamento", mes: "2026-03-01", valor: 99 }),
      ],
    });
    const c = checarDefasagemCustos(e);
    expect(c.informativo).toBe(true);
    expect(c.severidade).toBe("ok");
    expect(c.detalhes).toHaveLength(1);
  });
  it("nota de confiança ignora informativos", () => {
    const cs = executarChecagens(base());
    const n = notaConfianca(cs);
    expect(n.total).toBe(cs.filter((c) => !c.informativo).length);
  });
  it("CSV traz cabeçalho e linhas", () => {
    const csv = divergenciasCSV([
      checarFaturadoCompetencia(base({ fatos: [fato({ valor: 90 })] })),
    ]);
    expect(csv.split("\n")[0]).toContain("esperado");
    expect(csv.split("\n").length).toBeGreaterThan(1);
  });
});
