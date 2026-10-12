// Fase 17 — gaveta "Cliente 360°" e modo comparar. Lê só de @/data/metricas via hooks.
import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import * as M from "@/data/metricas";
import { useDados } from "@/hooks/use-dados";
import type { FiltrosGlobais } from "@/lib/filtros";
import { obterAnoBase } from "@/lib/periodo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChartTooltip,
  SectionCard,
  SeloValidacao,
  StatusPill,
  type StatusTom,
} from "@/components/ui-kit";
import { DataTableV2 } from "@/components/ui-kit/data-table-v2";
import {
  formatarBRL,
  formatarBRLCompacto,
  formatarData,
  formatarMes,
  formatarPercentual,
} from "@/lib/format";

export const STATUS_RECEB: Record<M.StatusReceb, { label: string; tom: StatusTom }> = {
  quitado: { label: "Quitado", tom: "success" },
  em_dia: { label: "Em aberto (em dia)", tom: "info" },
  atrasado: { label: "Com atraso", tom: "danger" },
  sem_nf: { label: "Sem NF", tom: "neutral" },
};

const eixo = { fontSize: 11, fill: "var(--color-muted-foreground)" };
const rotMes = (m: string) => formatarMes(`${m}-01T12:00:00`);
const SERIES = [
  { key: "pipe", nome: "Pipe", cor: "var(--color-chart-3)" },
  { key: "faturado", nome: "Faturado", cor: "var(--color-chart-1)" },
  { key: "recebido", nome: "Recebido", cor: "var(--color-chart-2)" },
  { key: "custo", nome: "Custo", cor: "var(--color-chart-5)" },
  { key: "margem", nome: "Margem", cor: "var(--color-chart-4)" },
] as const;

function Mini({ label, valor, selo }: { label: string; valor: string; selo?: boolean }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className="num mt-1 text-title font-medium text-card-foreground">{valor}</p>
      {selo && <SeloValidacao className="mt-1" />}
    </div>
  );
}

export function KpisCliente({ l }: { l: M.LinhaCliente | null }) {
  if (!l) return <p className="text-body text-muted-foreground">Sem valores no período.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Mini label="Faturado" valor={formatarBRL(l.faturado)} />
      <Mini label="Recebido" valor={formatarBRL(l.recebido)} />
      <Mini label="Em aberto" valor={formatarBRL(l.emAberto)} />
      <Mini label="Atrasado" valor={formatarBRL(l.atrasado)} />
      <Mini label="Custo" valor={formatarBRL(l.custo)} />
      <Mini label="Margem" valor={formatarBRL(l.margem)} selo />
      <Mini label="Margem %" valor={formatarPercentual(l.margemPct, 1)} selo />
      <Mini
        label="NFs"
        valor={`${l.nNFs}${l.ultimaNF ? ` · última ${formatarData(l.ultimaNF)}` : ""}`}
      />
    </div>
  );
}

export function LinhaMensal({ serie, altura = 240 }: { serie: M.SerieCliente[]; altura?: number }) {
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer>
        <LineChart data={serie} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="mes" tickFormatter={rotMes} tick={eixo} />
          <YAxis tickFormatter={formatarBRLCompacto} tick={eixo} width={64} />
          <Tooltip content={<ChartTooltip />} labelFormatter={rotMes} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium text-card-foreground">{titulo}</h4>
      {children}
    </div>
  );
}

export function Cliente360Gaveta({
  id,
  filtros,
  onClose,
}: {
  id: string | null;
  filtros: FiltrosGlobais;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {id && <Corpo id={id} filtros={filtros} />}
      </SheetContent>
    </Sheet>
  );
}

function Corpo({ id, filtros }: { id: string; filtros: FiltrosGlobais }) {
  const d = useDados();
  const c = M.cliente360(d, filtros, id, obterAnoBase());
  const l = c.linha;
  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle className="text-headline">{l?.nome ?? id}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              tom={
                l?.categoria === "Terceiro"
                  ? "info"
                  : l?.categoria === "Anunciante"
                    ? "success"
                    : "neutral"
              }
            >
              {l?.categoria ?? "—"}
            </StatusPill>
            {l && (
              <StatusPill tom={STATUS_RECEB[l.status].tom}>
                {STATUS_RECEB[l.status].label}
              </StatusPill>
            )}
            {l?.bus.map((b) => (
              <StatusPill key={b} tom="neutral">
                {b}
              </StatusPill>
            ))}
            <span className="text-label text-muted-foreground">
              Aliases: {c.aliases.length ? c.aliases.join(", ") : "nenhum"}
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>

      {c.alertas.length > 0 && (
        <ul className="space-y-1.5">
          {c.alertas.map((a) => (
            <li
              key={a.texto}
              className={
                a.tom === "danger"
                  ? "flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-body text-danger"
                  : "flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-body text-warning"
              }
            >
              <AlertTriangle className="size-4 shrink-0" /> {a.texto}
            </li>
          ))}
        </ul>
      )}

      <KpisCliente l={l} />

      <Bloco titulo="Linha mensal — Pipe → Faturado → Recebido → Custo → Margem">
        <LinhaMensal serie={c.serie} />
      </Bloco>

      <Bloco titulo={`Produtos contratados (${c.produtos.length})`}>
        <DataTableV2
          rows={c.produtos}
          rowKey={(p) => `${p.produto}|${p.itemCobranca}`}
          pagina={20}
          columns={[
            { key: "item", header: "Item de cobrança", value: (p) => p.itemCobranca },
            { key: "produto", header: "Produto", value: (p) => p.produto },
            { key: "plat", header: "Plataforma", value: (p) => p.plataforma },
            {
              key: "fat",
              header: "Faturado",
              align: "right",
              value: (p) => p.faturado,
              render: (p) => <span className="num">{formatarBRL(p.faturado)}</span>,
            },
            {
              key: "rec",
              header: "Recebido",
              align: "right",
              value: (p) => p.recebido,
              render: (p) => <span className="num">{formatarBRL(p.recebido)}</span>,
            },
            {
              key: "cus",
              header: "Custo",
              align: "right",
              value: (p) => p.custo,
              render: (p) => <span className="num">{formatarBRL(p.custo)}</span>,
            },
          ]}
        />
      </Bloco>

      <Bloco titulo={`Notas fiscais (${c.notas.length})`}>
        <DataTableV2
          rows={c.notas}
          rowKey={(n) => n.id}
          pagina={15}
          columns={[
            { key: "num", header: "NF", value: (n) => n.numero },
            {
              key: "em",
              header: "Emissão",
              value: (n) => n.emissao,
              render: (n) => formatarData(n.emissao),
            },
            {
              key: "venc",
              header: "Vencimento",
              value: (n) => n.vencimento,
              render: (n) => formatarData(n.vencimento),
            },
            { key: "card", header: "Produto", value: (n) => n.card },
            {
              key: "st",
              header: "Status",
              value: (n) => M.statusNaData(n, filtros.dataReferencia),
              render: (n) => {
                const s = M.statusNaData(n, filtros.dataReferencia);
                return (
                  <StatusPill tom={s === "pago" ? "success" : s === "atrasado" ? "danger" : "info"}>
                    {s === "pago" ? "Pago" : s === "atrasado" ? "Atrasado" : "A vencer"}
                  </StatusPill>
                );
              },
            },
            {
              key: "v",
              header: "Valor",
              align: "right",
              value: (n) => n.valor,
              render: (n) => <span className="num">{formatarBRL(n.valor)}</span>,
            },
          ]}
        />
      </Bloco>

      <Bloco titulo={`Negócios (${c.negocios.length})`}>
        <DataTableV2
          rows={c.negocios}
          rowKey={(g) => g.id}
          pagina={15}
          columns={[
            { key: "t", header: "Título", value: (g) => g.titulo },
            { key: "p", header: "Produto", value: (g) => g.produto },
            {
              key: "c",
              header: "Competência",
              value: (g) => g.competencia,
              render: (g) => rotMes(g.competencia),
            },
            {
              key: "nf",
              header: "NF",
              value: (g) => (g.temNF ? "Sim" : "Não"),
              render: (g) => (
                <StatusPill tom={g.temNF ? "success" : "warning"}>
                  {g.temNF ? "Com NF" : "Sem NF"}
                </StatusPill>
              ),
            },
            {
              key: "v",
              header: "Valor",
              align: "right",
              value: (g) => g.valor,
              render: (g) => <span className="num">{formatarBRL(g.valor)}</span>,
            },
          ]}
        />
      </Bloco>

      <Bloco titulo={`Cards a liberar (${c.cards.length})`}>
        {c.cards.length ? (
          <ul className="divide-y rounded-xl border">
            {c.cards.map((k, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2 text-body">
                <span>
                  {k.produto} · {k.plataforma} {k.contrato}
                </span>
                <span className="num">{formatarBRL(k.valor)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Nenhum card a liberar.</p>
        )}
      </Bloco>
    </div>
  );
}

export function CompararClientes({
  a,
  b,
  filtros,
  opcoes,
  onA,
  onB,
}: {
  a: string;
  b: string;
  filtros: FiltrosGlobais;
  opcoes: { id: string; nome: string }[];
  onA: (v: string) => void;
  onB: (v: string) => void;
}) {
  const d = useDados();
  const ano = obterAnoBase();
  const lados = [
    { id: a, set: onA },
    { id: b, set: onB },
  ];
  return (
    <SectionCard
      title="Comparar clientes"
      subtitle="Dois clientes lado a lado, com os mesmos filtros."
      menu={false}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {lados.map((s, i) => {
          const c = s.id ? M.cliente360(d, filtros, s.id, ano) : null;
          return (
            <div key={i} className="space-y-4">
              <select
                aria-label={`Cliente ${i + 1}`}
                value={s.id}
                onChange={(e) => s.set(e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-body"
              >
                <option value="">Escolha um cliente…</option>
                {opcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
              {c && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tom="neutral">{c.linha?.categoria ?? "—"}</StatusPill>
                    {c.linha && (
                      <StatusPill tom={STATUS_RECEB[c.linha.status].tom}>
                        {STATUS_RECEB[c.linha.status].label}
                      </StatusPill>
                    )}
                  </div>
                  <KpisCliente l={c.linha} />
                  <LinhaMensal serie={c.serie} altura={200} />
                  <p className="text-label text-muted-foreground">
                    {c.produtos.length} produto(s) · {c.negocios.length} negócio(s) ·{" "}
                    {c.alertas.length} alerta(s)
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
