// Rodada 1 — Confiança dos dados. Classifica os avisos da importação por causa.
// Função pura: só descreve; nunca corrige números.

export type ClasseAviso = "app" | "planilha" | "esperado";
export interface AvisoImportacao {
  titulo: string;
  itens: string[];
}
export interface GrupoClassificado {
  titulo: string;
  classe: ClasseAviso;
  significado: string;
  quemDecide: "app" | "planilha";
  impacto: number | null; // R$ (soma das diferenças citadas), null = não monetário
  itens: string[];
}

export const ROTULO_CLASSE: Record<ClasseAviso, string> = {
  app: "Erro de leitura do app",
  planilha: "Inconsistência da planilha",
  esperado: "Diferença esperada",
};

type Regra = {
  t: RegExp;
  classe: ClasseAviso;
  significado: string;
  quem?: "app" | "planilha";
};

// Ordem importa: a primeira regra que casar com o título vence.
const REGRAS: Regra[] = [
  { t: /Clientes inferidos pela razão social/, classe: "esperado", significado: "NF com cliente “Não localizado”; o app usou a razão social para achar o cliente. Confira se o cliente está certo." },
  { t: /Excluídos da importação/, classe: "esperado", significado: "NFs do cliente “Teste” não entram nos números (regra combinada)." },
  { t: /sufixo do card × coluna/, classe: "planilha", significado: "O mês no nome do card não bate com a coluna de mês onde a NF foi lançada." },
  { t: /Competência × coluna Competência/, classe: "planilha", significado: "Mesmas NFs do item acima: a competência do sistema e a do bloco PE diferem." },
  { t: /Status da planilha × calculado/, classe: "esperado", significado: "O status escrito na planilha fica parado no dia em que foi preenchido; o app recalcula pela data de referência (ex.: “Pendente” que já venceu vira “atrasado”)." , quem: "app" },
  { t: /NFs sem ID do Pipe/, classe: "planilha", significado: "NFs com link do Pipe “Não Localizado”; não dá para ligá-las a um negócio." },
  { t: /Clientes unidos por alias/, classe: "esperado", significado: "Nomes diferentes do mesmo cliente unidos pela lista de apelidos." , quem: "app" },
  { t: /Total p\/ Card × soma calculada/, classe: "planilha", significado: "O total escrito no card não é a soma dos meses do próprio card." },
  { t: /Ajustes de layout/, classe: "esperado", significado: "Coluna DF repete o título “Por Vencimento”; o app a trata como saldo anterior do bloco de diferenças.", quem: "app" },
  { t: /Não Localizado" com valores no resumo/, classe: "planilha", significado: "O resumo tem a linha “Não Localizado” (R$ 160 mil em set/2026) sem nenhuma seção de clientes correspondente. É a causa da diferença “por produto × por cliente”." },
  { t: /sinal invertido/, classe: "esperado", significado: "Nos blocos de diferenças, as seções usam o sinal oposto ao do resumo. Os valores batem em módulo.", quem: "planilha" },
  { t: /Produto "Teste" ignorado/, classe: "esperado", significado: "Linha “Teste” do resumo (R$ 10,00 em set/2026) não entra nos números. Explica a diferença de R$ 10,00 no total faturado." },
  { t: /Seções sem linha Totais/, classe: "planilha", significado: "A seção não tem linha “Totais:”; o produto foi deduzido pela plataforma/contrato." },
  { t: /Linhas sem cliente com valores/, classe: "planilha", significado: "Linhas com custos mas sem nome de cliente. Antes o app as ignorava (erro corrigido); agora entram como “(sem cliente)”. Falta o nome do cliente na planilha." },
  { t: /Clientes lidos × "N Clientes"/, classe: "planilha", significado: "A contagem “N Clientes” da linha Totais não bate com as linhas da seção." },
  { t: /Soma dos clientes × linha Totais/, classe: "planilha", significado: "Cards a Liberar (coluna E) só existe na linha Totais, sem valor nos clientes; e na coluna DF a linha Totais traz o saldo por vencimento enquanto os clientes trazem a diferença." },
  { t: /só centavos/, classe: "esperado", significado: "Arredondamento de centavos entre seções e resumo." },
  { t: /Soma das seções × resumo BU×produto — divergência/, classe: "planilha", significado: "Saldo anterior a 2026: nas seções a coluna “<31/12/2025” de competência é menor que a de emissão, mas no resumo as duas são iguais; e o resumo traz saldos sem clientes. Diferenças entre custos e recebimentos: o resumo usa outra conta — causa não identificada." },
  { t: /Total <BU>|Total Analytics/, classe: "planilha", significado: "Soma do resumo não bate com as linhas “Total Analytics/Advertising”." },
  { t: /Produto da coluna A × seção/, classe: "planilha", significado: "A coluna A do cliente indica outro produto que o da seção; o app usa o da seção." },
  { t: /Categoria fora|categorias diferentes/, classe: "planilha", significado: "Categoria do cliente ausente ou diferente entre seções." },
];

/** Soma |diferença| citada em textos "A 123.45 × B 456.78" (planilha × calculado, seções × resumo...). */
export function impactoItens(itens: string[]): number | null {
  let soma = 0,
    achou = false;
  for (const i of itens) {
    const m = /(-?\d+(?:\.\d+)?)\s*×\s*[^\d-]*(-?\d+(?:\.\d+)?)\s*$/.exec(i);
    if (m) {
      achou = true;
      soma += Math.abs(Number(m[1]) - Number(m[2]));
    } else {
      const s = /:\s*(-?\d+(?:\.\d+)?)$/.exec(i);
      if (s) {
        achou = true;
        soma += Math.abs(Number(s[1]));
      }
    }
  }
  return achou ? Math.round(soma * 100) / 100 : null;
}

export function classificarAvisos(avisos: AvisoImportacao[]): GrupoClassificado[] {
  return avisos.map((a) => {
    const r = REGRAS.find((x) => x.t.test(a.titulo));
    const classe = r?.classe ?? "planilha";
    return {
      titulo: a.titulo,
      classe,
      significado: r?.significado ?? "Causa não identificada — veja os registros.",
      quemDecide: r?.quem ?? (classe === "app" ? "app" : "planilha"),
      impacto: /Status|alias|inferidos|Ajustes|sem ID|Excluídos/.test(a.titulo)
        ? null
        : impactoItens(a.itens),
      itens: a.itens,
    };
  });
}
