import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { hashArquivo, lerParte1, lerPlanilha, selecionarParte1 } from "@/lib/importador";
import { gerarPlanilha } from "./fixtures/planilhaMinima";

// Parte1 isolada: a fixture não traz uma Parte2 válida (a leitura completa exige os blocos).
const lerPlanilhaSync = (buf: ArrayBuffer) => {
  const { nome, data } = selecionarParte1(XLSX.read(buf, { type: "array", dense: true }));

  const { canon, ...p1 } = lerParte1(data);
  return { aba: nome, ...p1 };
};

const avisos = (l: { avisos: { titulo: string; itens: string[] }[] }, t: string) =>
  l.avisos.find((a) => a.titulo.startsWith(t))?.itens ?? [];

describe("importador v2 — Parte1", () => {
  const l = lerPlanilhaSync(gerarPlanilha());

  it("seleciona a aba Parte1 pelo nome e aceita cabeçalho com espaço (' Plataforma')", () => {
    expect(l.aba).toBe("Parte1");
    expect(l.negocios.find((n) => n.id_pipe === "11")?.plataforma).toBe("DV360");
  });

  it("fallback: primeira aba com os títulos; erro claro se não houver", () => {
    expect(lerPlanilhaSync(gerarPlanilha({ nomeAba: "Dados" })).aba).toBe("Dados");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["nada"]]), "X");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    expect(() => selecionarParte1(XLSX.read(buf, { type: "array", dense: true }))).toThrow(
      "Aba Parte1 não encontrada",
    );
  });

  it("NF repetida vira erro e não duplica", () => {
    expect(l.notas.filter((n) => n.numero_nf === "100")).toHaveLength(1);
    expect(l.erros.some((e) => /NF 100 repetida/.test(e.msg))).toBe(true);
  });

  it('cliente "Teste" é excluído', () => {
    expect(l.notas.some((n) => n.numero_nf === "102")).toBe(false);
  });

  it('"Não localizado" é inferido pela razão social e ligado pela coluna "NF:"', () => {
    const n = l.notas.find((x) => x.numero_nf === "101")!;
    expect(n.cliente).toBe("Acme");
    expect(n.cliente_inferido).toBe(true);
    expect(n.id_pipe).toBe("12");
  });

  it("competência = sufixo do card + ano da coluna; divergência vira aviso", () => {
    expect(l.notas.find((x) => x.numero_nf === "103")!.data_competencia).toBe("2026-03");
    expect(avisos(l, "Inconsistência: sufixo").join()).toMatch(/NF 103/);
  });

  it('NF da coluna "NF:" inexistente vira aviso de vínculo', () => {
    expect(avisos(l, "Vínculo negócio × NF divergente").join()).toMatch(/NF 999/);
    expect(l.totalKD).toBe(1800);
  });

  it("gera hash SHA-256 do arquivo", async () => {
    expect(await hashArquivo(gerarPlanilha())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("leitura completa exige os blocos da Parte2 (erro claro)", async () => {
    await expect(lerPlanilha(gerarPlanilha())).rejects.toThrow("Parte2");
  });
});
