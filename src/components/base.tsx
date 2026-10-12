import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusPill, SeloValidacao, type StatusTom } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div>
        <h1 className="text-headline font-normal text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export { KpiCard, EmptyState } from "@/components/ui-kit";

export type Status = "pago" | "pendente" | "atrasado";
const statusMap: Record<Status, [string, StatusTom]> = {
  pago: ["Pago", "success"],
  pendente: ["Pendente", "warning"],
  atrasado: ["Atrasado", "danger"],
};

export function StatusBadge({ status }: { status: Status }) {
  const [label, tom] = statusMap[status];
  return <StatusPill tom={tom}>{label}</StatusPill>;
}

export function ValidacaoBadge() {
  return <SeloValidacao />;
}

export type Column<T> = {
  key: keyof T;
  header: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  emptyText = "Nenhum registro encontrado",
  searchable = true,
  footer,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string;
  emptyText?: string;
  searchable?: boolean;
  footer?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: keyof T; dir: 1 | -1 } | null>(null);
  const [busca, setBusca] = useState("");
  const [porPagina, setPorPagina] = useState(10);
  const [pagina, setPagina] = useState(0);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let r = q
      ? rows.filter((row) =>
          columns.some((c) =>
            String(row[c.key] ?? "")
              .toLowerCase()
              .includes(q),
          ),
        )
      : rows;
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = a[sort.key] as unknown,
          y = b[sort.key] as unknown;
        if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
        return (
          String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true }) * sort.dir
        );
      });
    }
    return r;
  }, [rows, columns, busca, sort]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const pag = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtradas.slice(pag * porPagina, pag * porPagina + porPagina);
  const ordenar = (key: keyof T) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  const fixa = "sticky left-0 z-10 bg-card";

  return (
    <div className="space-y-2">
      {searchable && (
        <Input
          placeholder="Buscar na tabela..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          className="h-9 w-64"
        />
      )}
      <div className="overflow-x-auto surface-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              {columns.map((c, ci) => (
                <TableHead
                  key={String(c.key)}
                  className={cn(
                    "whitespace-nowrap text-xs uppercase tracking-wide",
                    c.align === "right" && "text-right",
                    ci === 0 && "sticky left-0 z-10 bg-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => ordenar(c.key)}
                    className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                  >
                    {c.header}
                    <span className="text-[10px]">
                      {sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={String(c.key)}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-danger">
                  Não foi possível carregar os dados: {error}
                </TableCell>
              </TableRow>
            ) : visiveis.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((r, i) => (
                <TableRow
                  key={i}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "group",
                    onRowClick &&
                      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  {columns.map((c, ci) => (
                    <TableCell
                      key={String(c.key)}
                      className={cn(
                        "whitespace-nowrap",
                        c.align === "right" && "text-right num",
                        ci === 0 && fixa,
                      )}
                    >
                      {c.render ? c.render(r) : String(r[c.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {!loading && !error && footer}
          </TableBody>
        </Table>
      </div>
      {!loading && !error && filtradas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Por página</span>
            {[10, 25, 50].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={porPagina === n ? "default" : "outline"}
                onClick={() => {
                  setPorPagina(n);
                  setPagina(0);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span>
              {pag * porPagina + 1}–{Math.min(filtradas.length, (pag + 1) * porPagina)} de{" "}
              {filtradas.length}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pag === 0}
              onClick={() => setPagina(pag - 1)}
            >
              ‹
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pag >= totalPaginas - 1}
              onClick={() => setPagina(pag + 1)}
            >
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Skeleton };
