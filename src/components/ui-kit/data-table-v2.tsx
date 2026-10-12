// DataTable v2 — colunas configuráveis, densidade, filtro por coluna,
// ordenação múltipla (Shift+clique) e linha expansível.
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Columns3, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "./index";
import { cn } from "@/lib/utils";

export interface ColunaV2<T> {
  key: string;
  header: string;
  /** valor bruto usado em ordenação e filtro */
  value: (r: T) => string | number;
  render?: (r: T) => ReactNode;
  align?: "left" | "right";
  oculta?: boolean;
}
type Ord = { key: string; dir: 1 | -1 };

export function DataTableV2<T>({
  rows,
  columns,
  rowKey,
  expand,
  onRowClick,
  vazio = "Nenhum registro.",
  pagina = 50,
}: {
  rows: T[];
  columns: ColunaV2<T>[];
  rowKey: (r: T) => string;
  expand?: (r: T) => ReactNode;
  onRowClick?: (r: T) => void;
  vazio?: string;
  pagina?: number;
}) {
  const [visiveis, setVisiveis] = useState(
    () => new Set(columns.filter((c) => !c.oculta).map((c) => c.key)),
  );
  const [densidade, setDensidade] = useState<"confortavel" | "compacta">("confortavel");
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [ord, setOrd] = useState<Ord[]>([]);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(pagina);
  const cols = columns.filter((c) => visiveis.has(c.key));

  const dados = useMemo(() => {
    const fs = Object.entries(filtros).filter(([, v]) => v.trim());
    let out = rows.filter((r) =>
      fs.every(([k, v]) => {
        const c = columns.find((x) => x.key === k);
        return !c || String(c.value(r)).toLowerCase().includes(v.toLowerCase());
      }),
    );
    if (ord.length)
      out = [...out].sort((a, b) => {
        for (const o of ord) {
          const c = columns.find((x) => x.key === o.key);
          if (!c) continue;
          const va = c.value(a),
            vb = c.value(b);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb), "pt-BR");
          if (cmp) return cmp * o.dir;
        }
        return 0;
      });
    return out;
  }, [rows, columns, filtros, ord]);

  const ordenar = (key: string, multi: boolean) =>
    setOrd((prev) => {
      const at = prev.find((o) => o.key === key);
      const prox: Ord | null = !at ? { key, dir: 1 } : at.dir === 1 ? { key, dir: -1 } : null;
      const base = multi ? prev.filter((o) => o.key !== key) : [];
      return prox ? [...base, prox] : base;
    });
  const py = densidade === "compacta" ? "py-1.5" : "py-3";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-muted-foreground">
          {dados.length} registro(s){ord.length > 1 && ` · ordenação múltipla (${ord.length})`} ·
          Shift+clique para ordenar por várias colunas
        </p>
        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="Densidade"
            value={densidade}
            onChange={setDensidade}
            options={[
              { value: "confortavel", label: "Confortável" },
              { value: "compacta", label: "Compacta" },
            ]}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="size-4" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visiveis.has(c.key)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(v) =>
                    setVisiveis((s) => {
                      const n = new Set(s);
                      if (v) n.add(c.key);
                      else n.delete(c.key);
                      return n;
                    })
                  }
                >
                  {c.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border bg-card">
        <table className="w-full text-body">
          <thead className="bg-surface-container-low text-label text-muted-foreground">
            <tr>
              {expand && <th className="w-8" />}
              {cols.map((c) => {
                const o = ord.findIndex((x) => x.key === c.key);
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 pt-2 font-medium",
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={(e) => ordenar(c.key, e.shiftKey)}
                    >
                      {c.header}
                      {o >= 0 &&
                        (ord[o]?.dir === 1 ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        ))}
                      {o >= 0 && ord.length > 1 && <span className="text-[10px]">{o + 1}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr>
              {expand && <th />}
              {cols.map((c) => (
                <th key={c.key} className="px-3 pb-2">
                  <input
                    aria-label={`Filtrar ${c.header}`}
                    placeholder="Filtrar…"
                    value={filtros[c.key] ?? ""}
                    onChange={(e) => {
                      setFiltros((f) => ({ ...f, [c.key]: e.target.value }));
                      setLimite(pagina);
                    }}
                    className="h-7 w-full min-w-16 rounded-md border bg-background px-2 text-label font-normal text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.slice(0, limite).map((r) => {
              const id = rowKey(r);
              const aberta = abertas.has(id);
              return (
                <Fragment key={id}>
                  <tr
                    className={cn(
                      "border-t transition-colors hover:bg-surface-container-low",
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={() => onRowClick?.(r)}
                  >
                    {expand && (
                      <td className="pl-2">
                        <button
                          type="button"
                          aria-label={aberta ? "Recolher" : "Expandir"}
                          className="rounded p-1 text-muted-foreground hover:bg-surface-container"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAbertas((s) => {
                              const n = new Set(s);
                              if (n.has(id)) n.delete(id);
                              else n.add(id);
                              return n;
                            });
                          }}
                        >
                          {aberta ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                    )}
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={cn("px-3", py, c.align === "right" && "text-right tabular-nums")}
                      >
                        {c.render ? c.render(r) : c.value(r)}
                      </td>
                    ))}
                  </tr>
                  {expand && aberta && (
                    <tr className="bg-surface-container-low">
                      <td colSpan={cols.length + 1} className="px-6 py-3">
                        {expand(r)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!dados.length && (
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dados.length > limite && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setLimite((l) => l + pagina)}>
            Mostrar mais ({dados.length - limite} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}

/** Exporta linhas como CSV (separador ";" para Excel pt-BR). */
export function baixarCSV(nome: string, cabecalho: string[], linhas: (string | number)[][]) {
  const esc = (x: string | number) => {
    const s = typeof x === "number" ? x.toFixed(2).replace(".", ",") : x;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
