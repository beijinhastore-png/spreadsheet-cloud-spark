// Produto a partir de plataforma + contrato (nomenclatura dos resumos da planilha). Puro.
/** Produto derivado de plataforma + contrato (mesma nomenclatura dos resumos da planilha). */
export function produtoDe(plataforma: string, contrato: string): string {
  const p = plataforma.toUpperCase();
  const base: Record<string, string> = {
    GA360: "GA4",
    DV360: "Programática",
    CM360: "Adserver",
    SA360: "Search",
  };
  if (base[p]) return contrato ? `${base[p]} ${contrato}` : base[p]!;
  if (p === "DIRETO") return "DOOH";
  if (p === "META") return "Meta";
  if (p === "GAMA") return "GAMA";
  return plataforma || "Não localizado";
}
