import type { ReactNode } from "react";
import { limparDados, obterNotaConfianca } from "@/data/repository";
import { FiltrosGlobais } from "@/components/filtros-globais";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useRouterState, useRouteContext } from "@tanstack/react-router";
import { podeEscrever, PAPEIS } from "@/data/repository";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Handshake,
  FileText,
  Wallet,
  TrendingUp,
  GitCompare,
  Calculator,
  Users,
  Layers,
  BarChart3,
  Upload,
  Info,
  Palette,
  UserCog,
  ScrollText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PageHeader, EmptyState } from "@/components/base";

export const modulos = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Negócios", url: "/negocios", icon: Handshake },
  { title: "Faturamento", url: "/faturamento", icon: FileText },
  { title: "Recebíveis", url: "/recebiveis", icon: Wallet },
  { title: "Fluxo de caixa", url: "/fluxo-de-caixa", icon: TrendingUp },
  { title: "Pipe × Faturado", url: "/pipe-x-faturado", icon: GitCompare },
  { title: "Controladoria operacional", url: "/controladoria", icon: Calculator },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Produtos e plataformas", url: "/dimensoes", icon: Layers },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Importação", url: "/importacao", icon: Upload },
  { title: "Qualidade dos dados", url: "/qualidade", icon: ShieldCheck },
] as const;

const administracao = [
  { title: "Usuários e papéis", url: "/usuarios", icon: UserCog },
  { title: "Auditoria", url: "/auditoria", icon: ScrollText },
] as const;

const sobre = [
  { title: "Escopo do sistema", url: "/sobre", icon: Info },
  { title: "Design system", url: "/design-system", icon: Palette },
] as const;

function NavGroup({
  label,
  items,
  path,
}: {
  label: string;
  items: readonly { title: string; url: string; icon: typeof Info }[];
  path: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((i) => (
            <SidebarMenuItem key={i.url}>
              <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                <Link to={i.url}>
                  <i.icon />
                  <span>{i.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { perfil } = useRouteContext({ from: "/_authenticated" });
  const papel = perfil?.papel;
  // O menu só esconde; o banco é quem bloqueia de fato.
  const modulosVisiveis = modulos.filter((m) => m.url !== "/importacao" || podeEscrever(papel));
  const atual = [...modulos, ...administracao, ...sobre].find((i) => i.url === path);
  const grupo = modulos.some((m) => m.url === path)
    ? "Módulos"
    : administracao.some((m) => m.url === path)
      ? "Administração"
      : "Sobre";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    limparDados();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              C
            </div>
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              Controladoria
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup label="Módulos" items={modulosVisiveis} path={path} />
          {papel === "admin" && (
            <NavGroup label="Administração" items={administracao} path={path} />
          )}
          <NavGroup label="Sobre" items={sobre} path={path} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>{grupo}</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{atual?.title ?? "Página"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <SeloConfianca />
            <span
              className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground md:inline"
              title={perfil?.email}
            >
              {PAPEIS.find((p) => p.valor === papel)?.rotulo ?? "Sem perfil"}
            </span>
            <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair">
              <LogOut />
            </Button>
          </div>
        </header>
        <FiltrosGlobais />
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function ModuloEmConstrucao({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Módulo em construção"
        description="Este módulo será implementado nas próximas fases."
      />
    </main>
  );
}

/** Selo de confiança (Fase 7): leva a /qualidade. */
export function SeloConfianca() {
  const n = obterNotaConfianca();
  const ok = n.erros === 0;
  const Icone = ok ? ShieldCheck : ShieldAlert;
  return (
    <Link
      to="/qualidade"
      title="Qualidade dos dados"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label font-medium",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      <Icone className="size-4" />
      {ok ? "✓" : "!"} {n.ok}/{n.total}
    </Link>
  );
}
