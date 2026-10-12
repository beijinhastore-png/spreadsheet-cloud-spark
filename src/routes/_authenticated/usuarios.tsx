import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/base";
import { listarPerfis, alterarPapel, PAPEIS, type Papel } from "@/data/repository";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarData } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e papéis — Controladoria" },
      {
        name: "description",
        content: "Administração de papéis de acesso ao sistema de controladoria.",
      },
      { property: "og:title", content: "Usuários e papéis — Controladoria" },
      {
        property: "og:description",
        content: "Administração de papéis de acesso ao sistema de controladoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: ({ context }) => {
    if (context.perfil?.papel !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: Usuarios,
});

function Usuarios() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data = [], isLoading } = useQuery({ queryKey: ["perfis"], queryFn: listarPerfis });

  async function mudar(id: string, papel: Papel) {
    try {
      await alterarPapel(id, papel);
      toast.success("Papel atualizado.");
    } catch (e) {
      toast.error("Não foi possível alterar o papel.", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
    await qc.invalidateQueries({ queryKey: ["perfis"] });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        title="Usuários e papéis"
        description="Novas contas são criadas pelo painel do backend; aqui você define o que cada pessoa pode fazer."
      />
      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
        {PAPEIS.map((p) => (
          <li key={p.valor} className="rounded-lg border bg-card p-3">
            <span className="font-medium text-foreground">{p.rotulo}</span> — {p.descricao}
          </li>
        ))}
      </ul>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="w-48">Papel</TableHead>
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
            {data.map((p) => (
              <TableRow key={p.userId}>
                <TableCell>
                  {p.nome}
                  {p.userId === user.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  )}
                </TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{formatarData(p.criadoEm)}</TableCell>
                <TableCell>
                  <Select value={p.papel} onValueChange={(v) => void mudar(p.userId, v as Papel)}>
                    <SelectTrigger aria-label={`Papel de ${p.email}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPEIS.map((x) => (
                        <SelectItem key={x.valor} value={x.valor}>
                          {x.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
