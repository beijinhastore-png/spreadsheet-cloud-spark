import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Controladoria" },
      {
        name: "description",
        content: "Defina uma nova senha de acesso ao sistema de controladoria.",
      },
      { property: "og:title", content: "Redefinir senha — Controladoria" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso ao sistema de controladoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setPronto(true);
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "PASSWORD_RECOVERY") setPronto(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const senha = String(f.get("senha"));
    if (senha.length < 8) {
      toast.error("Use ao menos 8 caracteres.");
      return;
    }
    if (senha !== String(f.get("confirmar"))) {
      toast.error("As senhas não conferem.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha.", { description: error.message });
      return;
    }
    await supabase.auth.signOut();
    toast.success("Senha redefinida. Entre com a nova senha.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold text-card-foreground">Redefinir senha</h1>
        {!pronto ? (
          <p className="text-sm text-muted-foreground">
            Abra esta página pelo link enviado ao seu e-mail.{" "}
            <Link to="/auth" className="text-primary underline">
              Voltar ao login
            </Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar senha</Label>
              <Input
                id="confirmar"
                name="confirmar"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
