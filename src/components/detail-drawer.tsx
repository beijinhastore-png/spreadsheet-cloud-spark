import { useSyncExternalStore, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/base";
import { obterClientes, obterNegocios, obterNotasFiscais } from "@/data/repository";
import { formatarBRL, formatarData } from "@/lib/format";
import { diasAtrasoNF } from "@/data/metricas";
import { hojeISO } from "@/lib/periodo";

export type Detalhe = { tipo: "negocio" | "nf" | "cliente"; id: string } | null;

let atual: Detalhe = null;
const ouvintes = new Set<() => void>();
export function abrirDetalhe(d: Detalhe) {
  atual = d;
  ouvintes.forEach((f) => f());
}
const assinar = (f: () => void) => (ouvintes.add(f), () => ouvintes.delete(f));

function Linha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

function Link({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-primary underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

export function LinkCliente({ id, nome }: { id: string; nome: string }) {
  return <Link onClick={() => abrirDetalhe({ tipo: "cliente", id })}>{nome}</Link>;
}

export function DetailDrawer() {
  const d = useSyncExternalStore(
    assinar,
    () => atual,
    () => null,
  );
  const clientes = obterClientes();
  const nomeCliente = (id: string) => clientes.find((c) => c.id === id)?.nome ?? "—";
  let titulo = "";
  let corpo: ReactNode = <p className="text-sm text-muted-foreground">Registro não encontrado.</p>;

  if (d?.tipo === "negocio") {
    const n = obterNegocios().find((x) => x.id === d.id);
    titulo = "Negócio";
    if (n) {
      const nfs = obterNotasFiscais().filter((f) => f.negocioId === n.id);
      const nf = nfs[0];
      const emis = nfs
        .map((f) => f.emissao)
        .filter(Boolean)
        .sort()[0];
      const venc = nfs
        .map((f) => f.vencimento)
        .filter(Boolean)
        .sort()
        .at(-1);
      const pagos = nfs.filter((f) => f.dataPagamento);
      const receb =
        nfs.length && pagos.length === nfs.length
          ? pagos
              .map((f) => f.dataPagamento!)
              .sort()
              .at(-1)
          : undefined;
      const etapas: [string, boolean, string][] = [
        ["Ganho", !!n.ganhoEm, n.ganhoEm ? formatarData(n.ganhoEm) : "—"],
        ["Autorizado", n.autorizada, n.autorizada ? "Sim (sem data na planilha)" : "Não"],
        ["NF emitida", !!emis, emis ? formatarData(emis) : "Não localizada"],
        ["Vencimento", !!venc, venc ? formatarData(venc) : "—"],
        [
          "Recebido",
          !!receb,
          receb
            ? formatarData(receb)
            : pagos.length
              ? `Parcial (${pagos.length}/${nfs.length})`
              : "—",
        ],
      ];
      corpo = (
        <>
          <ol className="mb-4 space-y-3 border-l-2 pl-4">
            {etapas.map(([t, ok, det]) => (
              <li key={t} className="relative">
                <span
                  className={`absolute -left-[23px] top-1 size-3 rounded-full ${ok ? "bg-success" : "bg-muted"}`}
                />
                <p className="text-sm font-medium text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{det}</p>
              </li>
            ))}
          </ol>
          <Linha label="Título">{n.titulo}</Linha>
          <Linha label="Cliente">
            <LinkCliente id={n.clienteId} nome={nomeCliente(n.clienteId)} />
          </Linha>
          <Linha label="Categoria">
            {clientes.find((c) => c.id === n.clienteId)?.categoria ?? "—"}
          </Linha>
          <Linha label="BU">{n.bu}</Linha>
          <Linha label="Produto">{n.produto}</Linha>
          <Linha label="Item de cobrança">
            {nf?.nomeCard || `${n.plataforma} · ${n.contrato}`}
          </Linha>
          <Linha label="Contrato">{n.contrato}</Linha>
          <Linha label="Plataforma">{n.plataforma}</Linha>
          <Linha label="Valor">{formatarBRL(n.valor)}</Linha>
          <Linha label="Faturado (NFs)">{formatarBRL(nfs.reduce((a, f) => a + f.valor, 0))}</Linha>
          <Linha label="Nota(s) fiscal(is)">
            {nfs.length
              ? nfs.map((f) => (
                  <span key={f.id} className="ml-2">
                    <Link onClick={() => abrirDetalhe({ tipo: "nf", id: f.id })}>{f.numero}</Link>
                  </span>
                ))
              : "Não localizada"}
          </Linha>
          <Linha label="Pipe">
            <a
              href={`https://predicta2.pipedrive.com/deal/${n.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Abrir no Pipe ↗
            </a>
          </Linha>
        </>
      );
    }
  } else if (d?.tipo === "nf") {
    const f = obterNotasFiscais().find((x) => x.id === d.id);
    titulo = "Nota fiscal";
    if (f) {
      corpo = (
        <>
          <Linha label="Número">{f.numero}</Linha>
          <Linha label="Cliente">
            <LinkCliente id={f.clienteId} nome={nomeCliente(f.clienteId)} />
          </Linha>
          <Linha label="Negócio relacionado">
            {f.negocioId && obterNegocios().some((g) => g.id === f.negocioId) ? (
              <Link onClick={() => abrirDetalhe({ tipo: "negocio", id: f.negocioId })}>
                Ver negócio {f.negocioId}
              </Link>
            ) : (
              "Sem negócio vinculado"
            )}
          </Linha>
          <Linha label="BU">{f.bu}</Linha>
          <Linha label="Razão social">{f.razaoSocial || "—"}</Linha>
          <Linha label="Card">{f.nomeCard || f.card}</Linha>
          <Linha label="Código / regime">{f.codigo ? `${f.codigo} · ${f.regime}` : "—"}</Linha>
          {f.clienteInferido && <Linha label="Cliente">Inferido pela razão social</Linha>}
          {f.linkNF && (
            <Linha label="NF">
              <a
                href={f.linkNF}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Abrir NF ↗
              </a>
            </Linha>
          )}
          <div className="py-3">
            <p className="mb-2 text-label text-muted-foreground">Linha do tempo</p>
            <ol className="flex items-start justify-between gap-2 text-label">
              {(
                [
                  ["Emissão", f.emissao],
                  ["Vencimento", f.vencimento],
                  ["Pagamento", f.dataPagamento],
                ] as const
              ).map(([l, dt]) => (
                <li key={l} className="flex flex-1 flex-col items-center text-center">
                  <span
                    className={`mb-1 size-3 rounded-full ${dt ? "bg-primary" : "border border-border bg-background"}`}
                  />
                  <span className="font-medium text-foreground">{l}</span>
                  <span className="text-muted-foreground">{dt ? formatarData(dt) : "—"}</span>
                </li>
              ))}
            </ol>
          </div>
          {(() => {
            const dd = diasAtrasoNF(f, hojeISO());
            return (
              <Linha label={f.dataPagamento ? "Pago em relação ao vencimento" : "Atraso"}>
                {dd == null
                  ? "—"
                  : dd > 0
                    ? `${dd} dia(s) de atraso`
                    : dd < 0
                      ? `${-dd} dia(s) de antecipação`
                      : "No dia"}
              </Linha>
            );
          })()}
          {f.negocioId && (
            <Linha label="Pipe">
              <a
                href={f.linkPipe || `https://predicta2.pipedrive.com/deal/${f.negocioId}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Abrir no Pipe ↗
              </a>
            </Linha>
          )}
          <Linha label="Status">
            <StatusBadge status={f.status} />
          </Linha>
          <Linha label="Valor">{formatarBRL(f.valor)}</Linha>
        </>
      );
    }
  } else if (d?.tipo === "cliente") {
    const c = clientes.find((x) => x.id === d.id);
    titulo = "Cliente";
    if (c) {
      const neg = obterNegocios().filter((n) => n.clienteId === c.id);
      const nfs = obterNotasFiscais().filter((n) => n.clienteId === c.id);
      corpo = (
        <>
          <Linha label="Nome">{c.nome}</Linha>
          <Linha label="Categoria">{c.categoria}</Linha>
          <Linha label="Negócios">{neg.length}</Linha>
          <Linha label="Notas fiscais">{nfs.length}</Linha>
          <Linha label="Total faturado">{formatarBRL(nfs.reduce((a, n) => a + n.valor, 0))}</Linha>
        </>
      );
    }
  }

  return (
    <Sheet open={!!d} onOpenChange={(o) => !o && abrirDetalhe(null)}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>Detalhes do registro</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{corpo}</div>
      </SheetContent>
    </Sheet>
  );
}
