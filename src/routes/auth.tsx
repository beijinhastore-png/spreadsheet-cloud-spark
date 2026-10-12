import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Controladoria" },
      { name: "description", content: "Acesso restrito ao sistema de controladoria." },
      { property: "og:title", content: "Entrar — Controladoria" },
      { property: "og:description", content: "Acesso restrito ao sistema de controladoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");

  async function esqueci() {
    const email = (document.getElementById("email") as HTMLInputElement | null)?.value?.trim();
    if (!email) {
      toast.error("Informe seu e-mail no campo acima.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Não foi possível enviar o e-mail.");
      return;
    }
    toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setErro(null);
    if (modo === "criar") {
      const { error: errCad } = await supabase.auth.signUp({
        email: String(f.get("email")),
        password: String(f.get("senha")),
        options: { emailRedirectTo: window.location.origin },
      });
      setEnviando(false);
      if (errCad) {
        const msg = /registered|already/i.test(errCad.message)
          ? "Este e-mail já tem conta. Use Entrar."
          : /password/i.test(errCad.message)
            ? "Senha fraca: use ao menos 6 caracteres."
            : "Não foi possível criar a conta.";
        toast.error(msg);
        return setErro(msg);
      }
      toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
      setModo("entrar");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("senha")),
    });
    setEnviando(false);
    if (error) {
      toast.error("E-mail ou senha inválidos.");
      return setErro("E-mail ou senha inválidos.");
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div>
          <h1 className="text-xl font-semibold text-card-foreground">Controladoria</h1>
          <p className="text-sm text-muted-foreground">
            {modo === "entrar"
              ? "Acesso restrito. Entre com seu e-mail e senha."
              : "Crie sua conta. A primeira conta vira administradora; as demais entram como leitor."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            name="senha"
            type="password"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          onClick={() => void esqueci()}
          className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Esqueci a senha
        </button>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModo(modo === "entrar" ? "criar" : "entrar");
          }}
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {modo === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </form>
    </main>
  );
}
