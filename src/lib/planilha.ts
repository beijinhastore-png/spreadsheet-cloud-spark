// Ponto de entrada da leitura da planilha — implementação em src/lib/importador/.
export * from "./importador";

// ===== Comparação com os dados atuais =====
export interface Contagem {
  novos: number;
  alterados: number;
  inalterados: number;
  removidos: number;
  comErro: number;
}
export function comparar<T extends Record<string, unknown>>(
  novos: T[],
  atuais: Record<string, unknown>[],
  chave: keyof T & string,
): Contagem & { removidosLista: string[] } {
  const sig = (o: Record<string, unknown>) =>
    Object.keys(novos[0] ?? {})
      .map((k) => {
        const x = o[k];
        return x == null || x === ""
          ? ""
          : typeof x === "number" ||
              (typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x) && k === "valor")
            ? Number(x).toFixed(2)
            : String(x);
      })
      .join("|");
  const mapa = new Map(atuais.map((a) => [String(a[chave]), a]));
  let n = 0,
    alt = 0,
    ina = 0;
  for (const x of novos) {
    const a = mapa.get(String(x[chave]));
    if (!a) n++;
    else if (sig(a) === sig(x)) ina++;
    else alt++;
  }
  const chavesNovas = new Set(novos.map((x) => String(x[chave])));
  const removidosLista = [...mapa.keys()].filter((k) => !chavesNovas.has(k));
  return {
    novos: n,
    alterados: alt,
    inalterados: ina,
    removidos: removidosLista.length,
    comErro: 0,
    removidosLista,
  };
}
