import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { filtrosSchema } from "@/lib/filtros";
import { dadosQueryOptions } from "@/hooks/use-dados";
import { obterMeuPerfil } from "@/data/repository";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Filtros globais na URL: herdados por todas as telas internas.
  validateSearch: zodValidator(filtrosSchema),
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Papel lido do banco a cada navegação protegida (nunca do localStorage).
    const [perfil] = await Promise.all([
      obterMeuPerfil(),
      context.queryClient.ensureQueryData(dadosQueryOptions()),
    ]);
    return { user: data.user, perfil };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
