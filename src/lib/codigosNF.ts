// Código de emissão da NFS-e → regime de PIS/Cofins (convenção da empresa). Editável.
// O sistema NÃO calcula PIS, Cofins, ISS nem créditos.
export const CODIGOS_NF: Record<string, "Não cumulativo" | "Cumulativo"> = {
  "2496": "Não cumulativo",
  "6394": "Não cumulativo",
  "2800": "Cumulativo",
  "2881": "Cumulativo",
};

export const REGIME_NAO_IDENTIFICADO = "Regime não identificado";

export const regimeDoCodigo = (codigo: string) => CODIGOS_NF[codigo] ?? REGIME_NAO_IDENTIFICADO;
