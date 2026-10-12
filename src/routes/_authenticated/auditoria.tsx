import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/base";
import { listarAuditoria } from "@/data/repository";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Controladoria" },
      {
        name: "description",
        content: "Registro de importações, mudanças de parâmetros, papéis e exportações.",
      },
      { property: "og:title", content: "Auditoria — Controladoria" },
      {
        property: "og:description",
        content: "Registro de importações, mudanças de parâmetros, papéis e exportações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (context.perfil?.papel !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: Auditoria,
});

const ACOES: Record<string, string> = {
  importacao: "Importação",
  parametro: "Parâmetro",
  exportacao: "Exportação",
  papel: "Mudança de papel",
};

function Auditoria() {
  const [filtro, setFiltro] = useState("todas");
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({ queryKey: ["auditoria"], queryFn: () => listarAuditoria() });
  const linhas = filtro === "todas" ? data : data.filter((r) => r.acao === filtro);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        title="Auditoria"
        description="Quem fez o quê e quando (últimos 500 registros)."
      />
      <div className="w-56">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger aria-label="Filtrar por ação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {Object.entries(ACOES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Quando</TableHead>
              <TableHead>Quem</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={4} className="text-destructive">
                  Não foi possível carregar a auditoria.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !linhas.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.criadoEm).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>{r.usuarioEmail || "—"}</TableCell>
                <TableCell>{ACOES[r.acao] ?? r.acao}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {Object.entries(r.detalhes)
                    .map(
                      ([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
                    )
                    .join(" · ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
