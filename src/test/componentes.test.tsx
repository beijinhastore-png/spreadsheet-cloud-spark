import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KpiCard } from "@/components/ui-kit";
import { DataTableV2, type ColunaV2 } from "@/components/ui-kit/data-table-v2";
import { FILTROS_PADRAO, filtrosSchema, normalizarFiltros } from "@/lib/filtros";

afterEach(cleanup);

describe("KpiCard", () => {
  it("mostra rótulo, valor e selo de validação", () => {
    render(<KpiCard label="Faturado" value="R$ 10" variation={0.1} needsValidation />);
    expect(screen.getByText("Faturado")).toBeTruthy();
    expect(screen.getByText("R$ 10")).toBeTruthy();
    expect(screen.getByText("Necessita validação")).toBeTruthy();
  });
  it("sem valor exibe travessão; em carregamento não exibe valor", () => {
    render(<KpiCard label="A" />);
    expect(screen.getByText("—")).toBeTruthy();
    cleanup();
    render(<KpiCard label="B" value="X" loading />);
    expect(screen.queryByText("X")).toBeNull();
  });
});

describe("DataTableV2", () => {
  type L = { id: string; nome: string; v: number };
  const cols: ColunaV2<L>[] = [
    { key: "nome", header: "Nome", value: (r) => r.nome },
    { key: "v", header: "Valor", value: (r) => r.v, align: "right" },
  ];
  it("renderiza linhas e mensagem de vazio", () => {
    render(
      <DataTableV2 rows={[{ id: "1", nome: "Acme", v: 5 }]} columns={cols} rowKey={(r) => r.id} />,
    );
    expect(screen.getByText("Acme")).toBeTruthy();
    cleanup();
    render(<DataTableV2 rows={[]} columns={cols} rowKey={(r) => r.id} vazio="Nada aqui" />);
    expect(screen.getByText("Nada aqui")).toBeTruthy();
  });
  it("ordena ao clicar no cabeçalho", () => {
    render(
      <DataTableV2
        rows={[
          { id: "1", nome: "B", v: 1 },
          { id: "2", nome: "A", v: 2 },
        ]}
        columns={cols}
        rowKey={(r) => r.id}
      />,
    );
    fireEvent.click(screen.getByText("Nome"));
    const txt = document.body.textContent ?? "";
    expect(txt.indexOf("A")).toBeLessThan(txt.lastIndexOf("B"));
  });
});

describe("filtros na URL", () => {
  it("valores inválidos voltam ao padrão", () => {
    const f = filtrosSchema.parse({ regime: 3, clientes: "x", tri: "a" });
    expect(f.regime).toBe("competencia");
    expect(f.clientes).toEqual([]);
    expect(f.tri).toBe(1);
  });
  it("normaliza regime e deriva a data de referência", () => {
    const n = normalizarFiltros(
      { ...FILTROS_PADRAO, regime: "xyz" },
      "2026-10-06",
      2026,
    );
    expect(n.regime).toBe("competencia");
    expect(n.dataReferencia).toBe("2026-10-06");
    expect(n.de <= n.ate).toBe(true);
  });
  it("padrão do filtro é o mês corrente", () => {
    expect(FILTROS_PADRAO.periodo).toBe("mes");
  });
  it("ano inteiro: referência é hoje, não 31/12", () => {
    const n = normalizarFiltros({ ...FILTROS_PADRAO, periodo: "ano" }, "2026-10-06", 2026);
    expect(n.periodo).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
    expect(n.dataReferencia).toBe("2026-10-06");
  });
  it("período encerrado: referência é o fim do período", () => {
    const n = normalizarFiltros({ ...FILTROS_PADRAO, periodo: "trimestre", tri: 1 }, "2026-10-06", 2026);
    expect(n.dataReferencia).toBe("2026-03-31");
  });
});
