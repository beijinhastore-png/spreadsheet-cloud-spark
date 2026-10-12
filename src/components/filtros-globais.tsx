// Fase 8 — barra de filtros globais (chips), estado 100% na URL.
import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  obterBUs,
  obterCategorias,
  obterContratos,
  obterPlataformas,
  obterProdutos,
} from "@/data/repository";
import { useDados, useFiltros } from "@/hooks/use-dados";
import {
  FILTROS_PADRAO,
  REGIMES,
  TIPOS_PERIODO,
  listarVisoes,
  removerVisao,
  salvarVisao,
  type FiltrosURL,
} from "@/lib/filtros";
import { formatarMes } from "@/lib/format";
import { mesesDoAno, obterAnoBase } from "@/lib/periodo";

const campo = "h-8 rounded-full border border-input bg-background px-3 text-xs text-foreground";

export function FiltrosGlobais() {
  const { bruto, filtros, definir, limpar } = useFiltros();
  const dados = useDados();
  const [visoes, setVisoes] = useState(listarVisoes);
  const meses = mesesDoAno();
  const set = <K extends keyof FiltrosURL>(k: K, v: FiltrosURL[K]) => definir({ [k]: v });

  const selects: {
    k: "bu" | "produto" | "plataforma" | "contrato" | "categoria";
    label: string;
    xs: string[];
  }[] = [
    { k: "bu", label: "BU", xs: obterBUs() },
    { k: "produto", label: "Produto", xs: obterProdutos() },
    { k: "plataforma", label: "Plataforma", xs: obterPlataformas() },
    { k: "contrato", label: "Contrato", xs: obterContratos() },
    { k: "categoria", label: "Categoria", xs: obterCategorias() },
  ];
  const ativos = (Object.keys(FILTROS_PADRAO) as (keyof FiltrosURL)[]).filter(
    (k) => JSON.stringify(bruto[k]) !== JSON.stringify(FILTROS_PADRAO[k]),
  );

  function salvar() {
    const nome = window.prompt("Nome da visão:");
    if (!nome) return;
    salvarVisao({ nome, filtros: bruto });
    setVisoes(listarVisoes());
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2"
      aria-label="Filtros globais"
    >
      <select
        aria-label="Período"
        className={campo}
        value={bruto.periodo}
        onChange={(e) => set("periodo", e.target.value)}
      >
        {TIPOS_PERIODO.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {bruto.periodo === "mes" && (
        <select
          aria-label="Mês"
          className={campo}
          value={filtros.de}
          onChange={(e) => set("mes", e.target.value)}
        >
          {meses.map((m) => (
            <option key={m} value={m}>
              {formatarMes(`${m}-01`)}
            </option>
          ))}
        </select>
      )}
      {bruto.periodo === "trimestre" && (
        <select
          aria-label="Trimestre"
          className={campo}
          value={bruto.tri}
          onChange={(e) => set("tri", Number(e.target.value))}
        >
          {[1, 2, 3, 4].map((t) => (
            <option key={t} value={t}>
              {t}º tri/{String(obterAnoBase()).slice(-2)}
            </option>
          ))}
        </select>
      )}
      {bruto.periodo === "intervalo" && (
        <>
          <input
            aria-label="De"
            type="month"
            className={campo}
            value={filtros.de}
            onChange={(e) => set("de", e.target.value)}
          />
          <input
            aria-label="Até"
            type="month"
            className={campo}
            value={filtros.ate}
            onChange={(e) => set("ate", e.target.value)}
          />
        </>
      )}
      <select
        aria-label="Regime de data"
        className={campo}
        value={filtros.regime}
        onChange={(e) => set("regime", e.target.value)}
      >
        {REGIMES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {selects.map((s) => (
        <select
          key={s.k}
          aria-label={s.label}
          className={campo}
          value={bruto[s.k]}
          onChange={(e) => set(s.k, e.target.value)}
        >
          <option value="">{s.label}: todos</option>
          {s.xs.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 rounded-full text-xs">
            Clientes{bruto.clientes.length ? ` (${bruto.clientes.length})` : ": todos"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-h-80 w-72 overflow-auto p-2">
          {dados.clientes.map((c) => {
            const on = bruto.clientes.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={() =>
                    set(
                      "clientes",
                      on ? bruto.clientes.filter((x) => x !== c.id) : [...bruto.clientes, c.id],
                    )
                  }
                />
                {c.nome}
              </label>
            );
          })}
          {!dados.clientes.length && (
            <p className="p-2 text-xs text-muted-foreground">Sem clientes importados.</p>
          )}
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground" aria-label="Posição">
        Posição em {filtros.dataReferencia.split("-").reverse().join("/")}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {visoes.length > 0 && (
          <select
            aria-label="Visões salvas"
            className={campo}
            value=""
            onChange={(e) => {
              const v = visoes.find((x) => x.nome === e.target.value);
              if (v) definir(() => ({ ...FILTROS_PADRAO, ...v.filtros }));
            }}
          >
            <option value="">Visões salvas</option>
            {visoes.map((v) => (
              <option key={v.nome} value={v.nome}>
                {v.nome}
              </option>
            ))}
          </select>
        )}
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={salvar}>
          <Bookmark className="size-3.5" /> Salvar visão
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={limpar}
          disabled={!ativos.length}
        >
          Limpar
        </Button>
        {visoes.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Remover última visão"
            title="Remover última visão salva"
            onClick={() => {
              removerVisao(visoes[visoes.length - 1]!.nome);
              setVisoes(listarVisoes());
            }}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
