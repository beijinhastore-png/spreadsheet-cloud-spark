// Planilha mínima (aba Parte1) gerada por código para os testes do importador.
import * as XLSX from "xlsx";

export const serial = (iso: string) => Math.round(Date.parse(iso) / 864e5 + 25569);
const MESES = [serial("2026-01-01"), serial("2026-02-01"), serial("2026-03-01")];

type NF = {
  numero: string;
  cliente: string;
  razao: string;
  card: string;
  deal: string | null;
  bu: "Advertising" | "Analytics";
  mes: number; // índice 0..2 da matriz
  valor: number;
};

export const NFS: NF[] = [
  {
    numero: "100",
    cliente: "Acme",
    razao: "ACME LTDA",
    card: "Acme Mídia JAN",
    deal: "11",
    bu: "Advertising",
    mes: 0,
    valor: 1000,
  },
  {
    numero: "101",
    cliente: "Não localizado",
    razao: "ACME LTDA",
    card: "Acme Extra FEV",
    deal: null,
    bu: "Advertising",
    mes: 1,
    valor: 500,
  },
  {
    numero: "102",
    cliente: "Teste",
    razao: "TESTE SA",
    card: "Teste JAN",
    deal: "13",
    bu: "Analytics",
    mes: 0,
    valor: 50,
  },
  // competência divergente: sufixo MAR × coluna FEV
  {
    numero: "103",
    cliente: "Beta",
    razao: "BETA SA",
    card: "Beta GA4 MAR",
    deal: "14",
    bu: "Analytics",
    mes: 1,
    valor: 300,
  },
  // NF repetida (mesmo número)
  {
    numero: "100",
    cliente: "Acme",
    razao: "ACME LTDA",
    card: "Acme Mídia JAN",
    deal: "11",
    bu: "Advertising",
    mes: 0,
    valor: 1000,
  },
];

const HDR_JC = [
  "Cliente:",
  "Razão Social",
  "Nome do Card no Pipe",
  "Pipe",
  "Nota Fiscal",
  "NF",
  "Código",
  "Emissão:",
  "Vencimento:",
  "Data Pagamento:",
  "Status:",
];

export function gerarPlanilha(opts: { nomeAba?: string } = {}): ArrayBuffer {
  const rows: unknown[][] = [[], []];
  const set = (r: number, c: number, val: unknown) => {
    while (rows.length <= r) rows.push([]);
    rows[r]![c] = val;
  };
  // Negócios A:J (" Plataforma" com espaço à esquerda)
  [
    "PIPE: Negócio - Título",
    "Negócio - Ganho em",
    "Contrato",
    " Plataforma",
    "Negócio - Valor",
    "Total p/ Card",
    "Cliente:",
    "Pipe:",
    "Autorizada emissão",
    "NF:",
  ].forEach((h, c) => set(0, c, h));
  const negs = [
    [
      "Acme Mídia JAN",
      serial("2026-01-05"),
      "Serviço",
      "DV360",
      1000,
      1000,
      "Acme",
      "11",
      "Sim",
      "100",
    ],
    [
      "Acme Extra FEV",
      serial("2026-02-05"),
      "Serviço",
      "DV360",
      500,
      500,
      "Acme",
      "12",
      "Sim",
      "101",
    ],
    [
      "Beta GA4 MAR",
      serial("2026-03-05"),
      "Licenciamento",
      "GA360",
      300,
      300,
      "Beta",
      "14",
      "Sim",
      "999",
    ],
  ];
  negs.forEach((n, i) => n.forEach((x, c) => set(i + 1, c, x)));

  let c0 = 12;
  const bloco = (titulo: string, filtro: (n: NF) => boolean, extra: "JC" | "PE" | "") => {
    set(0, c0, titulo);
    const hdr =
      extra === "JC" ? HDR_JC : extra === "PE" ? ["Nota Fiscal", "Competência"] : ["Nota Fiscal"];
    hdr.forEach((h, i) => set(1, c0 + i, h));
    const cm = c0 + hdr.length;
    MESES.forEach((m, i) => set(1, cm + i, m));
    set(1, cm + MESES.length, "Total:");
    let r = 2;
    for (const n of NFS.filter(filtro)) {
      if (extra === "JC") {
        const vals = [
          n.cliente,
          n.razao,
          n.card,
          n.deal ? "link" : "Não Localizado",
          n.numero,
          "nf",
          "01.07",
          serial("2026-01-10"),
          serial("2026-02-10"),
          "",
          "A vencer",
        ];
        vals.forEach((x, i) => set(r, c0 + i, x));
      } else {
        set(r, c0, n.numero);
        if (extra === "PE") set(r, c0 + 1, MESES[n.mes]);
      }
      set(r, cm + n.mes, n.valor);
      r++;
    }
    c0 = cm + MESES.length + 2;
  };
  const todas = () => true;
  bloco("FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF", todas, "JC");
  bloco("FATURADO POR COMPETENCIA - POR NF", todas, "");
  bloco(
    "ADVERTISING - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF",
    (n) => n.bu === "Advertising",
    "",
  );
  bloco(
    "ADVERTISING - FATURADO POR CLIENTE - POR EMISSÃO - POR NF",
    (n) => n.bu === "Advertising",
    "",
  );
  bloco(
    "Analytics - FATURADO POR CLIENTE - POR COMPETÊNCIA - POR NF",
    (n) => n.bu === "Analytics",
    "",
  );
  bloco("Analytics - FATURADO POR CLIENTE - POR EMISSÃO - POR NF", (n) => n.bu === "Analytics", "");
  bloco("FATURADO POR EMISSÃO - POR NF", todas, "PE");

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // hyperlinks do Pipe
  const cPipe = 12 + 3;
  NFS.forEach((n, i) => {
    if (n.deal)
      ws[XLSX.utils.encode_cell({ r: i + 2, c: cPipe })].l = {
        Target: `https://x.pipedrive.com/deal/${n.deal}`,
      };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["capa"]]), "Capa");
  XLSX.utils.book_append_sheet(wb, ws, opts.nomeAba ?? "Parte1");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "Parte2");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
