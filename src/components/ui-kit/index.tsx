import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Download, Image, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarBRLCompacto, formatarPercentualSinal } from "@/lib/format";

/* ---------- Sparkline ---------- */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const id = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const w = 100;
  const h = 32;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / (max - min || 1)) * (h - 4) - 2,
  ]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-24 text-primary", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Selo ---------- */
export function SeloValidacao({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-0.5 text-label font-medium text-info",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      Necessita validação
    </span>
  );
}

/* ---------- KPI v2 ---------- */
export function KpiCard({
  label,
  value,
  variation,
  variationLabel,
  invertColors,
  sparkline,
  loading,
  needsValidation,
  icon,
}: {
  label: string;
  value?: string;
  /** fração: 0.082 = +8,2% */
  variation?: number;
  variationLabel?: string;
  /** quando subir é ruim (ex.: custos) */
  invertColors?: boolean;
  sparkline?: number[];
  loading?: boolean;
  needsValidation?: boolean;
  icon?: ReactNode;
}) {
  const positivo = (variation ?? 0) >= 0;
  const bom = invertColors ? !positivo : positivo;
  return (
    <div className="surface-card flex flex-col gap-3 p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-5">{icon}</span>}
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="num break-words text-[1.75rem] font-medium leading-9 text-card-foreground">
              {value ?? "—"}
            </p>
            {sparkline && (
              <Sparkline data={sparkline} className={bom ? "text-primary" : "text-danger"} />
            )}
          </div>
          <div className="flex min-h-5 flex-wrap items-center gap-2">
            {variation !== undefined && (
              <span
                className={cn(
                  "num inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-label font-medium",
                  bom ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
                )}
              >
                {positivo ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {formatarPercentualSinal(variation)}
              </span>
            )}
            {variationLabel && (
              <span className="text-label text-muted-foreground">{variationLabel}</span>
            )}
            {needsValidation && <SeloValidacao />}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Chips ---------- */
export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body font-medium transition-colors duration-150",
        selected
          ? "border-transparent bg-primary-container text-on-primary-container"
          : "border-outline-variant text-foreground hover:bg-foreground/5",
      )}
    >
      {selected && <Check className="size-4 animate-fade-in" />}
      {children}
    </button>
  );
}

export function AssistChip({
  icon,
  children,
  onClick,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-body font-medium text-foreground transition-colors duration-150 hover:bg-foreground/5 [&_svg]:size-4 [&_svg]:text-primary"
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Segmented control ---------- */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex h-9 overflow-hidden rounded-full border border-outline"
    >
      {options.map((o, i) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 text-body font-medium transition-colors duration-150",
              i > 0 && "border-l border-outline",
              ativo
                ? "bg-primary-container text-on-primary-container"
                : "text-foreground hover:bg-foreground/5",
            )}
          >
            {ativo && <Check className="size-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Tabs com indicador animado ---------- */
export function AnimatedTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs]);
  return (
    <div ref={ref} role="tablist" className="relative flex border-b border-outline-variant">
      {tabs.map((t) => (
        <button
          key={t.value}
          data-value={t.value}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            "px-4 pb-3 pt-2 text-body font-medium transition-colors duration-150",
            t.value === value ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
      <span
        className="absolute bottom-0 h-[3px] rounded-t-full bg-primary transition-all duration-250 ease-standard"
        style={{ left: ind.left + 8, width: Math.max(ind.width - 16, 0) }}
      />
    </div>
  );
}

/* ---------- Status badge ---------- */
export type StatusTom = "success" | "warning" | "danger" | "info" | "neutral";
const tons: Record<StatusTom, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-container-high text-muted-foreground",
};
export function StatusPill({ tom, children }: { tom: StatusTom; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label font-medium",
        tons[tom],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/* ---------- Empty state ---------- */
export function EmptyIllustration() {
  return (
    <svg viewBox="0 0 120 90" className="h-20 w-28" aria-hidden>
      <rect x="14" y="18" width="92" height="60" rx="10" className="fill-surface-container-high" />
      <rect x="24" y="30" width="40" height="6" rx="3" className="fill-outline-variant" />
      <rect x="24" y="42" width="60" height="6" rx="3" className="fill-outline-variant" />
      <rect x="24" y="54" width="28" height="6" rx="3" className="fill-outline-variant" />
      <circle cx="88" cy="26" r="14" className="fill-primary-container" />
      <path
        d="M82 26h12M88 20v12"
        className="stroke-on-primary-container"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] bg-surface-container-low px-6 py-12 text-center animate-fade-in">
      <EmptyIllustration />
      <p className="mt-4 text-title font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-body text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Section card ---------- */
export function SectionCard({
  title,
  subtitle,
  action,
  menu = true,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  menu?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-5 animate-slide-up", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-title font-medium text-card-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {menu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Mais opções"
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8"
              >
                <MoreVertical className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem disabled>
                  <Image className="size-4" /> Exportar imagem
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Download className="size-4" /> Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/* ---------- Tooltip de gráfico (compatível com Recharts) ---------- */
type TooltipItem = {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};
export function ChartTooltip({
  active,
  payload,
  label,
  deltaKey,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  deltaKey?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl bg-popover px-3 py-2 text-popover-foreground shadow-raised animate-fade-in">
      {label !== undefined && (
        <p className="mb-1 text-label font-medium text-muted-foreground">{label}</p>
      )}
      {payload.map((p, i) => {
        const delta = deltaKey ? (p.payload?.[deltaKey] as number | undefined) : undefined;
        return (
          <div key={i} className="flex items-center justify-between gap-4 text-body">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num font-medium">
              {typeof p.value === "number" ? formatarBRLCompacto(p.value) : p.value}
              {delta !== undefined && (
                <span
                  className={cn("ml-2 text-label", delta >= 0 ? "text-success" : "text-danger")}
                >
                  {formatarPercentualSinal(delta)}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
