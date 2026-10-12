/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures de teste parciais */
import { test, expect } from "vitest";
import * as M from "@/data/metricas";
const f: any = {
  de: "2026-01",
  ate: "2026-12",
  regime: "competencia",
  bu: "",
  produto: "",
  plataforma: "",
  contrato: "",
  categoria: "",
  clientes: [],
  dataReferencia: "2026-06-15",
};
const fato = (cliente: string | null, nivel: any, valor: number, bloco = "fat_competencia") => ({
  bloco,
  nivel,
  bu: "Advertising",
  plataforma: "DV360",
  contrato: "Licenciamento",
  produto: "Programática Licenciamento",
  itemCobranca: "Sub Licença Display&Video 360",
  cliente,
  categoria: cliente ? "Terceiro" : null,
  mes: "2026-03-01",
  anterior: false,
  valor,
});
test("soma bate", () => {
  const d: any = {
    fatos: [fato("A", "cliente", 100), fato("B", "cliente", 50), fato(null, "produto", 150)],
    negocios: [],
    notas: [
      {
        id: "1",
        numero: "1",
        negocioId: "",
        clienteId: "a",
        bu: "Advertising",
        contrato: "",
        competencia: "2026-03",
        valor: 30,
        status: "pendente",
        emissao: "2026-03-01",
        card: "x",
        vencimento: "2026-04-01",
      },
    ],
    clientes: [],
    cards: [],
  };
  const c = M.clientes360(d, f);
  expect(c.find((x) => x.id === "a")!.atrasado).toBe(30);
  const p = M.produtosPor(d, f, "produto");
  expect(p[0]!.faturado).toBe(p[0]!.faturadoResumo);
  expect(p[0]!.nClientes).toBe(2);
  const t0 = performance.now();
  const x = M.cliente360(d, f, "a", 2026);
  expect(performance.now() - t0).toBeLessThan(1000);
  expect(x.alertas.length).toBeGreaterThan(0);
  expect(M.terceiroXAnunciante(d, f)[0]!.categoria).toBe("Terceiro");
});
