import { describe, it, expect } from "vitest";
import * as M from "@/data/metricas";
import type { Fato } from "@/data/repository";
import type { NotaFiscal } from "@/data/tipos";
import { normalizarFiltros, FILTROS_PADRAO } from "@/lib/filtros";

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
const D = (fatos: Fato[], notas: NotaFiscal[] = []): M.Dados => ({
  fatos,
  notas,
  negocios: [],
  clientes: [],
  cards: [],
});
const F = (p: Partial<typeof FILTROS_PADRAO> = {}) =>
  normalizarFiltros({ ...FILTROS_PADRAO, periodo: "ano", ...p }, "2026-10-05", 2026);

describe("dashboard", () => {
  it("regime emissão usa faturado por emissão", () => {
    expect(M.blocoFaturado("emissao")).toBe("fat_emissao");
    expect(M.blocoFaturado("competencia")).toBe("fat_competencia");
  });
  it("variação vs mês anterior", () => {
    const s = [
      { chave: "2026-01", valor: 100 },
      { chave: "2026-02", valor: 150 },
    ];
    expect(M.variacaoMensal(s, "2026-02")).toBeCloseTo(0.5);
    expect(M.variacaoMensal(s, "2026-01")).toBeNull();
  });
  it("alerta de NF vencida há mais de 30 dias", () => {
    const d = D(
      [],
      [nf({ vencimento: "2026-08-01", valor: 70 }), nf({ id: "2", vencimento: "2026-09-20" })],
    );
    const a = M.alertas(d, F(), []);
    expect(a[0]).toMatchObject({ id: "nf-atraso", valor: 70, destino: "/recebiveis" });
  });
  it("alerta Pipe × Faturado só fora da tolerância de 5%", () => {
    const ok = D([fato({ bloco: "pipe", valor: 100 }), fato({ valor: 96 })]);
    const fora = D([fato({ bloco: "pipe", valor: 100 }), fato({ valor: 90 })]);
    expect(M.alertas(ok, F(), []).some((x) => x.id === "pipe-fat")).toBe(false);
    expect(M.alertas(fora, F(), []).some((x) => x.id === "pipe-fat")).toBe(true);
  });
  it("conversão da jornada entre etapas", () => {
    const e = M.etapasJornada(
      { pipe: 200, pipeAutorizado: 100, vencido: 10, aVencer: 40, recebido: 25 } as M.Cadeia,
      50,
    );
    expect(e.map((x) => x.conversao)).toEqual([null, 0.5, 0.5, 1, 0.5]);
  });
});
