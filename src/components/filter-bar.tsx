import { Button } from "@/components/ui/button";

export type TipoData = "competencia" | "emissao" | "vencimento" | "recebimento";
export interface Filtros {
  de: string;
  ate: string;
  tipoData: TipoData;
  bu: string;
  produto: string;
  contrato: string;
  plataforma: string;
  categoria: string;
  cliente: string;
  status: string;
}
export const filtrosIniciais: Filtros = {
  de: "",
  ate: "",
  tipoData: "competencia",
  bu: "",
  produto: "",
  contrato: "",
  plataforma: "",
  categoria: "",
  cliente: "",
  status: "",
};

type Opcao = { value: string; label: string };
const rotulos: Record<keyof Filtros, string> = {
  de: "De",
  ate: "Até",
  tipoData: "Tipo de data",
  bu: "BU",
  produto: "Produto",
  contrato: "Contrato",
  plataforma: "Plataforma",
  categoria: "Categoria",
  cliente: "Cliente",
  status: "Status",
};
const tiposData: Opcao[] = [
  { value: "competencia", label: "Competência" },
  { value: "emissao", label: "Emissão" },
  { value: "vencimento", label: "Vencimento" },
  { value: "recebimento", label: "Recebimento" },
];
const campo = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export function FilterBar({
  value,
  onChange,
  opcoes,
}: {
  value: Filtros;
  onChange: (f: Filtros) => void;
  opcoes: Record<
    "bu" | "produto" | "contrato" | "plataforma" | "categoria" | "cliente" | "status",
    Opcao[]
  >;
}) {
  const set = (k: keyof Filtros, v: string) => onChange({ ...value, [k]: v });
  const ativos = (Object.keys(value) as (keyof Filtros)[]).filter(
    (k) => value[k] !== filtrosIniciais[k],
  );
  const label = (k: keyof Filtros) => {
    const v = value[k];
    if (k === "tipoData") return tiposData.find((t) => t.value === v)?.label;
    if (k === "de" || k === "ate") return v;
    return opcoes[k as keyof typeof opcoes].find((o) => o.value === v)?.label ?? v;
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          De
          <br />
          <input
            type="month"
            className={campo}
            value={value.de}
            onChange={(e) => set("de", e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Até
          <br />
          <input
            type="month"
            className={campo}
            value={value.ate}
            onChange={(e) => set("ate", e.target.value)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Tipo de data
          <br />
          <select
            className={campo}
            value={value.tipoData}
            onChange={(e) => set("tipoData", e.target.value)}
          >
            {tiposData.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {(Object.keys(opcoes) as (keyof typeof opcoes)[]).map((k) => (
          <label key={k} className="text-xs text-muted-foreground">
            {rotulos[k]}
            <br />
            <select className={campo} value={value[k]} onChange={(e) => set(k, e.target.value)}>
              <option value="">Todos</option>
              {opcoes[k].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(filtrosIniciais)}
          disabled={!ativos.length}
        >
          Limpar
        </Button>
      </div>
      {ativos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ativos.map((k) => (
            <button
              key={k}
              onClick={() => set(k, filtrosIniciais[k])}
              className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              {rotulos[k]}: {label(k)} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
