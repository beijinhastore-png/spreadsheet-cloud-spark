// Fase 18 — exportação de relatórios. Exporta exatamente a TabelaRelatorio exibida na tela.
// TODO (fora da Fase 18): agendamento de envio periódico de relatórios (ex.: cron + e-mail).
import type { TabelaRelatorio } from "@/data/metricas";
import { registrarAuditoria } from "@/data/acesso";
import { formatarBRL, formatarPercentual } from "@/lib/format";

export interface Contexto {
  filtros: string[];
  geradoEm: string;
  periodo: string;
  dataReferencia: string;
}

export const formatarCelula = (v: string | number | undefined, tipo: string) =>
  v == null || v === ""
    ? ""
    : tipo === "brl"
      ? formatarBRL(Number(v))
      : tipo === "pct"
        ? formatarPercentual(Number(v))
        : String(v);

const nomeArquivo = (t: TabelaRelatorio, ext: string) =>
  `${t.titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\W+/g, "_")
    .toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${ext}`;

function baixar(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function cabecalho(t: TabelaRelatorio, c: Contexto): string[][] {
  return [
    [t.titulo],
    [`Período: ${c.periodo}`],
    [`Posição em: ${c.dataReferencia}`],
    [`Filtros: ${c.filtros.join(" · ") || "nenhum"}`],
    [`Gerado em: ${c.geradoEm}`],
    [],
  ];
}

export function exportarCSV(t: TabelaRelatorio, c: Contexto) {
  void registrarAuditoria("exportacao", {
    formato: "csv",
    relatorio: t.titulo,
    linhas: t.linhas.length,
    filtros: c.filtros,
    periodo: c.periodo,
  });
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const linhas = [
    ...cabecalho(t, c),
    t.colunas.map((x) => x.rotulo),
    ...[...t.linhas, ...(t.total ? [t.total] : [])].map((l) =>
      t.colunas.map((x) => formatarCelula(l[x.chave], x.tipo)),
    ),
    [],
    ...t.notas.map((n) => [n]),
  ];
  baixar(
    new Blob(["\ufeff" + linhas.map((l) => l.map(esc).join(";")).join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
    nomeArquivo(t, "csv"),
  );
}

export async function exportarXLSX(t: TabelaRelatorio, c: Contexto) {
  void registrarAuditoria("exportacao", {
    formato: "xlsx",
    relatorio: t.titulo,
    linhas: t.linhas.length,
    filtros: c.filtros,
    periodo: c.periodo,
  });
  const XLSX = await import("xlsx");
  const topo = cabecalho(t, c);
  const corpo = [...t.linhas, ...(t.total ? [t.total] : [])].map((l) =>
    t.colunas.map((x) => (x.tipo === "texto" ? String(l[x.chave] ?? "") : Number(l[x.chave] ?? 0))),
  );
  const aoa = [...topo, t.colunas.map((x) => x.rotulo), ...corpo, [], ...t.notas.map((n) => [n])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const r0 = topo.length + 1;
  corpo.forEach((_, i) =>
    t.colunas.forEach((col, j) => {
      const cel = ws[XLSX.utils.encode_cell({ r: r0 + i, c: j })];
      if (cel && col.tipo === "brl") cel.z = '"R$" #,##0.00;-"R$" #,##0.00;"-"';
      if (cel && col.tipo === "pct") cel.z = "0.0%";
    }),
  );
  ws["!cols"] = t.colunas.map((x) => ({ wch: Math.max(14, x.rotulo.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, nomeArquivo(t, "xlsx"));
}

export const imprimir = (titulo?: string) => {
  void registrarAuditoria("exportacao", { formato: "impressao", relatorio: titulo ?? "" });
  window.print();
};
