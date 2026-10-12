import { describe, it, expect } from "vitest";
import * as M from "@/data/metricas";
import type { Fato } from "@/data/repository";
import type { NotaFiscal } from "@/data/tipos";
import { normalizarFiltros, FILTROS_PADRAO } from "@/lib/filtros";
import { statusDerivado } from "@/lib/calculos";

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
  emissao: "2026-03-01",
  card: "GA4",
  vencimento: "2026-04-10",
  ...p,
});
const fato = (p: Partial<Fato>): Fato => ({
  bloco: "vencimento",
  nivel: "produto",
  bu: "Analytics",
  plataforma: "GA",
  contrato: "Licença",
  produto: "GA4",
  itemCobranca: null,
  cliente: null,
  categoria: null,
  mes: "2026-04-01",
  anterior: false,
  valor: 100,
  ...p,
});
const dados = (notas: NotaFiscal[], fatos: Fato[] = []): M.Dados => ({
  fatos,
  notas,
  negocios: [],
  clientes: [{ id: "Acme", nome: "Acme", categoria: "Anunciante" }],
  cards: [],
});
// Ano inteiro: a posição é HOJE (aqui, a data informada).
const F = (hoje: string) => normalizarFiltros({ ...FILTROS_PADRAO, periodo: "ano" }, hoje, 2026);

describe("Fase 13 — status pela data de corte", () => {
  it("pagamento após a data de corte ainda conta como atrasado", () => {
    const n = { vencimento: "2026-04-10", dataPagamento: "2026-05-20" };
    expect(statusDerivado(n, "2026-05-01")).toBe("atrasado");
    expect(statusDerivado(n, "2026-05-20")).toBe("pago");
    expect(M.statusNaData(n, "2026-04-01")).toBe("pendente");
  });
});

describe("Fase 13 — recebíveis", () => {
  const notas = [
    nf({ id: "a", valor: 1000, vencimento: "2026-04-05" }), // 26 dias de atraso em 01/05
    nf({ id: "b", valor: 500, vencimento: "2026-02-15" }), // 75 dias
    nf({ id: "c", valor: 200, vencimento: "2026-05-06" }), // a vencer em 5 dias
    nf({
      id: "d",
      valor: 300,
      vencimento: "2026-04-20",
      emissao: "2026-04-01",
      dataPagamento: "2026-04-21",
    }),
  ];
  const d = dados(notas);
  const f = F("2026-05-01");

  it("KPIs a vencer e vencido", () => {
    const k = M.kpisRecebiveis(d, f);
    expect(k.aVencer7).toBe(200);
    expect(k.vencido).toBe(1500);
    expect(k.prazoMedio).toBe(20);
  });
  it("lista de cobrança ordenada por valor × dias", () => {
    const l = M.listaCobranca(d, f);
    expect(l.map((x) => x.nota.id)).toEqual(["b", "a"]); // 500×75 > 1000×26
  });
  it("semáforo vermelho com atraso acima de 30 dias", () => {
    const [cli] = M.agingPor(d, f, "cliente");
    expect(M.tomAgingCliente(cli!)).toBe("danger");
  });
  it("previsto × realizado com bucket anterior e divergência", () => {
    const d2 = dados(
      [nf({ vencimento: "2025-11-10", valor: 50 })],
      [fato({ anterior: true, mes: "2025-12-01", valor: 50 }), fato({ valor: 70 })],
    );
    const r = M.previstoRealizado(d2, f);
    expect(r[0]).toMatchObject({ mes: "anterior", vencimento: 50, diverge: false });
    expect(r.find((x) => x.mes === "2026-04")).toMatchObject({
      vencimento: 70,
      diferenca: -70,
      diverge: true,
    });
  });
  it("texto de cobrança preenche marcadores", () => {
    expect(
      M.textoCobranca("{cliente}-{nf}-{dias}", {
        cliente: "X",
        nf: "9",
        valor: "",
        vencimento: "",
        dias: 3,
      }),
    ).toBe("X-9-3");
  });
});
