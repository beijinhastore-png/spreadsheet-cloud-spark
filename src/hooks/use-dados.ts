// Fase 8 — React Query de verdade sobre a camada de acesso (repository).
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { carregarDados, obterDados } from "@/data/repository";
import * as M from "@/data/metricas";
import {
  FILTROS_PADRAO,
  normalizarFiltros,
  type FiltrosGlobais,
  type FiltrosURL,
} from "@/lib/filtros";
import { hojeISO, obterAnoBase } from "@/lib/periodo";

export const dadosQueryOptions = () =>
  queryOptions({
    queryKey: ["dados"],
    queryFn: async () => {
      await carregarDados(true);
      return obterDados();
    },
    staleTime: Infinity,
  });

export function useDados() {
  return useSuspenseQuery(dadosQueryOptions()).data;
}

/** Invalida o cache após importação. */
export function useInvalidarDados() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ["dados"] }), [qc]);
}

/** Filtros globais (URL) — leitura normalizada + escrita. */
export function useFiltros() {
  const bruto = useSearch({ from: "/_authenticated" });
  const navigate = useNavigate();
  const ano = obterAnoBase();
  const filtros = useMemo(() => normalizarFiltros(bruto, hojeISO(), ano), [bruto, ano]);
  const definir = useCallback(
    (p: Partial<FiltrosURL> | ((prev: FiltrosURL) => FiltrosURL)) =>
      navigate({
        to: ".",
        search: ((prev: FiltrosURL) =>
          typeof p === "function" ? p({ ...FILTROS_PADRAO, ...prev }) : { ...prev, ...p }) as never,
        replace: true,
      }),
    [navigate],
  );
  const limpar = useCallback(
    () => navigate({ to: ".", search: FILTROS_PADRAO as never, replace: true }),
    [navigate],
  );
  return { bruto, filtros, definir, limpar };
}

/** Métricas já ligadas aos dados e filtros (memoizadas na camada de métricas). */
export function useMetricas(filtros: FiltrosGlobais) {
  const d = useDados();
  return useMemo(
    () => ({
      dados: d,
      cadeia: M.cadeiaDoDinheiro(d, filtros),
      serieMensal: (b: M.Bloco) => M.serieMensal(d, b, filtros),
      porBU: (b: M.Bloco) => M.porBU(d, b, filtros),
      porProduto: (b: M.Bloco) => M.porProduto(d, b, filtros),
      porCliente: (b: M.Bloco) => M.porCliente(d, b, filtros),
      notas: M.notasFiltradas(d, filtros),
      aging: M.aging(d, filtros),
      projecaoCaixa: (meses?: number) => M.projecaoCaixa(d, filtros, meses),
    }),
    [d, filtros],
  );
}
