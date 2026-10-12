<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Telas internas ficam em src/routes/_authenticated/ (login obrigatório); /auth é a única rota pública. Por quê: uso interno restrito.
- Telas leem só de src/data/repository.ts ou src/data/metricas.ts (via useDados/useMetricas em src/hooks/use-dados.ts, React Query chave ["dados"], invalidada após importação); o repository carrega negocios/notas_fiscais e o modelo v2 (valores_agregados é legado e não é lido); a planilha é lida no navegador (src/lib/importador/: parte1.ts puro, index.ts orquestra e escolhe a aba; planilha.ts reexporta) e gravada pela função substituir_planilha (tudo-ou-nada). Por quê: fonte de dados isolada e reenvio atômico.
- Código NF→regime em src/lib/codigosNF.ts e aliases de clientes em src/lib/aliasClientes.ts (constantes editáveis, não banco). Por quê: decisão do usuário.

- Domain types live in src/data/tipos.ts; no mock data in the app — all data comes from the imported spreadsheet via src/data/repository.ts (limparDados() on logout).
- A single FilterBar (src/components/filter-bar.tsx) is used everywhere; "/" redirects to /dashboard.
- Reusable Material-3 style components (KpiCard v2, chips, SegmentedControl, AnimatedTabs, SectionCard, ChartTooltip, EmptyState) live in src/components/ui-kit/; base.tsx re-exports for older screens. Why: one design kit for phases 9–17.
- Data-quality checks are pure functions in src/lib/qualidade.ts (Parte1 × Parte2, never auto-correct); screens read them via obterChecagens()/obterNotaConfianca() in the repository. Why: testable and one source for /qualidade and the header seal.
- Datas: o único controle é o filtro de período (URL, padrão mês corrente); periodo {inicio,fim} filtra valores e dataReferencia (fim do período limitado a hoje, derivada, nunca editável) só decide status/atraso/aging/a vencer/realizado×previsto; tudo isso e o ano-base vivem só em src/lib/periodo.ts. Por quê: uma única data visível, sem "mês fixo".
- Filtros globais vivem na URL (validateSearch em _authenticated/route.tsx, schema em src/lib/filtros.ts) e são editados pela barra src/components/filtros-globais.tsx no AppShell. Por quê: estado compartilhado e recarregável.
- Tabelas novas usam DataTableV2 (src/components/ui-kit/data-table-v2.tsx: colunas, densidade, filtro por coluna, ordenação múltipla, expansão, CSV). Por quê: um padrão de tabela para as fases 11–17.
- Relatórios (Fase 18): relatorioDinamico/relatorioAging/relatorioCards e MODELOS_RELATORIO em src/data/metricas.ts geram uma TabelaRelatorio; a tela e todas as exportações (src/lib/exportar.ts: CSV, XLSX, impressão via #area-impressao) usam o mesmo objeto. Visões salvas na tabela visoes_salvas (RLS por usuário, compartilhada opcional) com fallback no localStorage. Por quê: o exportado reproduz exatamente a tela.
- Papéis (Fase 19): enum papel_app + tabela perfis; o banco decide (RLS com tem_papel/pode_escrever, substituir_planilha_v2 recusa leitor e grava auditoria). O front lê o perfil do banco no beforeLoad de _authenticated (context.perfil) só para esconder menus e guardar rotas; nunca guardar papel no navegador. Acesso/auditoria em src/data/acesso.ts (reexportado pelo repository). Por quê: segurança não pode depender da tela.

- Regras por fase das métricas (fases 9–17) ficam em src/data/AGENTS.md.