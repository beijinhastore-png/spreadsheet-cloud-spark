// Mapa editável alias → nome canônico do cliente (coluna "Cliente").
// Diferenças só de espaços/maiúsculas já são unidas automaticamente.
export const ALIAS_CLIENTES: Record<string, string> = {
  RMP: "Rae Mp",
  "Blue Media Services": "BMS Blue Media Services",
  "Adidas do Brasil Ltda": "Adidas",
  "Fundação Cásper Líbero": "Cásper Libero",
  Artplan: "Artplan Comunicação S.A",
  "Ecossistema Ânima": "Ânima Holding S.A",
};

/** Clientes excluídos da importação (listados na prévia como "excluído"). */
export const CLIENTES_EXCLUIDOS = ["Teste"];

export const chaveCliente = (nome: string) => nome.trim().replace(/\s+/g, " ").toLowerCase();
