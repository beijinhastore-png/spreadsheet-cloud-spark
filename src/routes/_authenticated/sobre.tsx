import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sobre")({
  head: () => ({
    meta: [
      { title: "Escopo do sistema — Controladoria" },
      {
        name: "description",
        content: "Módulos planejados do sistema de controladoria financeira e operacional.",
      },
      { property: "og:title", content: "Escopo do sistema — Controladoria" },
      {
        property: "og:description",
        content: "Módulos planejados do sistema de controladoria financeira e operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const modulos = [
  ["Dashboard", "Visão consolidada dos principais indicadores."],
  ["Negócios (Pipe)", "Cards ganhos e seus valores previstos."],
  ["Faturamento", "Notas fiscais emitidas."],
  ["Recebíveis", "Títulos a receber e recebidos."],
  ["Fluxo de caixa", "Entradas e saídas por período."],
  ["Pipe × Faturado", "Comparação entre o vendido e o faturado."],
  ["Controladoria operacional", "Emissão, custos, impostos e créditos."],
  ["Clientes", "Cadastro e visão por cliente."],
  ["Relatórios", "Análises por BU, produto, plataforma e período."],
  ["Importação de planilha", "Carga de dados a partir de planilhas."],
];

function Index() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground">Escopo do sistema</h1>
      <p className="mt-2 text-muted-foreground">
        Controladoria financeira e operacional — BUs Advertising e Analytics.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map(([titulo, desc]) => (
          <div key={titulo} className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold text-card-foreground">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
