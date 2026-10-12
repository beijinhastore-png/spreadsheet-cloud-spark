// Fase 19 — papéis e auditoria. O papel vem sempre do banco (tabela perfis, RLS);
// nunca do localStorage. O front só esconde menus; quem bloqueia é o banco.
import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "controladoria" | "leitor";
export interface Perfil {
  userId: string;
  nome: string;
  email: string;
  papel: Papel;
  criadoEm: string;
}
export interface RegistroAuditoria {
  id: number;
  criadoEm: string;
  usuarioEmail: string;
  acao: string;
  detalhes: Record<string, unknown>;
}

export const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: "admin", rotulo: "Administrador", descricao: "Tudo, inclusive usuários e auditoria" },
  {
    valor: "controladoria",
    rotulo: "Controladoria",
    descricao: "Importa a planilha e edita parâmetros",
  },
  { valor: "leitor", rotulo: "Leitor", descricao: "Somente leitura" },
];

export const podeEscrever = (p?: Papel | null) => p === "admin" || p === "controladoria";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPerfil = (x: any): Perfil => ({
  userId: x.user_id,
  nome: x.nome ?? "",
  email: x.email ?? "",
  papel: x.papel,
  criadoEm: x.criado_em,
});

export async function obterMeuPerfil(): Promise<Perfil | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("perfis").select("*").eq("user_id", u.user.id).maybeSingle();
  return data ? mapPerfil(data) : null;
}

export async function listarPerfis(): Promise<Perfil[]> {
  const { data, error } = await supabase.from("perfis").select("*").order("criado_em");
  if (error) throw error;
  return (data ?? []).map(mapPerfil);
}

export async function alterarPapel(userId: string, papel: Papel) {
  const { error } = await supabase.from("perfis").update({ papel }).eq("user_id", userId);
  if (error) throw error;
}

export async function listarAuditoria(limite = 500): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from("auditoria")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((x) => ({
    id: Number(x.id),
    criadoEm: x.criado_em,
    usuarioEmail: x.usuario_email ?? "",
    acao: x.acao,
    detalhes: (x.detalhes ?? {}) as Record<string, unknown>,
  }));
}

/** Registra exportação ou mudança de parâmetro. Importações são auditadas pelo próprio banco. */
export async function registrarAuditoria(
  acao: "exportacao" | "parametro",
  detalhes: Record<string, unknown>,
) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("auditoria").insert({
      acao,
      detalhes: detalhes as never,
      usuario_id: u.user.id,
      usuario_email: u.user.email ?? null,
    });
  } catch {
    /* auditoria nunca bloqueia a ação do usuário */
  }
}
