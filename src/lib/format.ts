const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function toDate(d: Date | string): Date {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

/** formatarBRL(1234.5) => "R$ 1.234,50" */
export function formatarBRL(valor: number): string {
  return brl.format(valor).replace(/\u00a0/g, " ");
}

/** dd/mm/aaaa */
export function formatarData(d: Date | string): string {
  const x = toDate(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
}

/** mmm/aa */
export function formatarMes(d: Date | string): string {
  const x = toDate(d);
  return `${meses[x.getMonth()]}/${String(x.getFullYear()).slice(-2)}`;
}

/** 0.125 => "12,5%" */
export function formatarPercentual(valor: number, casas = 1): string {
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(valor * 100) + "%"
  );
}

/** formatarBRLCompacto(1_234_000) => "R$ 1,2 mi"; 350_000 => "R$ 350 mil" */
export function formatarBRLCompacto(valor: number): string {
  const a = Math.abs(valor);
  const sinal = valor < 0 ? "-" : "";
  const f = (n: number) =>
    new Intl.NumberFormat("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : 1 }).format(n);
  if (a >= 1e9) return `${sinal}R$ ${f(a / 1e9)} bi`;
  if (a >= 1e6) return `${sinal}R$ ${f(a / 1e6)} mi`;
  if (a >= 1e3) return `${sinal}R$ ${f(a / 1e3)} mil`;
  return `${sinal}R$ ${f(a)}`;
}

/** 0.082 => "+8,2%"; -0.03 => "−3,0%" */
export function formatarPercentualSinal(valor: number, casas = 1): string {
  const base = formatarPercentual(Math.abs(valor), casas);
  if (valor > 0) return `+${base}`;
  if (valor < 0) return `−${base}`;
  return base;
}
