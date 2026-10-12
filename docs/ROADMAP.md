# Roadmap — 20 fases

- [x] Fase 1 — Alinhamento, documentação e faxina técnica (concluída)
- [x] Fase 2 — Design system estilo Google (Material 3) (concluída)
- [x] Fase 3 — Shell do app e navegação moderna (concluída)
- [x] Fase 4 — Modelo de dados v2 (concluída; conversão de datas e remoção de colunas aguardam liberação)
- [x] Fase 5 — Importador v2, Parte 1 (concluída; conferência com o arquivo real aguarda a planilha)
- [x] Fase 6 — (concluída)
- [x] Fase 7 — Conferência cruzada e qualidade dos dados (concluída)
- [x] Fase 8 — Camada de dados, filtros globais na URL e período dinâmico (concluída; telas além do Dashboard migram para useMetricas nas fases 9–17)
- [x] Fase 9 — Dashboard executivo (concluída; /jornada é placeholder até a Fase 10; limiares de alerta necessitam validação)
- [x] Fase 10 — Jornada do Dinheiro (concluída; tolerância do mapa de calor, margem, defasagem de custos e Recebido − Custos necessitam validação)
- [x] Fase 11 — Negócios (Pipe) e Cards a liberar (concluída; semáforo Sem NF, "Total p/ Card" e critério Terceiro/Anunciante necessitam validação)
- [x] Fase 12 — Faturamento (NFs) (concluída; cliente inferido, faixas de valor e meta = Pipe autorizado necessitam validação)
- [x] Fase 13 — Recebíveis, aging e inadimplência (concluída; taxa de recebimento, atraso médio, semáforo por cliente e aging por categoria necessitam validação)
- [x] Fase 14 — Fluxo de caixa (concluída; saldo inicial zero, pior caso, cobertura de caixa e nota Faturado − (Recebido − Custos) necessitam validação)
- [x] Fase 15 — Pipe × Faturado v2 (concluída; tolerância padrão 5%, regras de causas prováveis e convenção de sinal da diferença necessitam validação)
- [x] Fase 16 — Controladoria operacional v2 (concluída; fórmula oficial de margem, defasagem de 2 meses dos custos, créditos = PIS/Cofins não cumulativo, limiar "fora da média" (2σ) e conciliação necessitam validação)
- [x] Fase 17 — Clientes 360° e Produtos/Plataformas (concluída; margem, inadimplência = atrasado ÷ faturado, concentração top 5 e status de recebimento necessitam validação)
- [x] Fase 18 — Relatórios e exportações (concluída; fórmula de margem do construtor, criação da tabela visoes_salvas no banco e agendamento (TODO em src/lib/exportar.ts) pendentes/necessitam validação)
- [x] Fase 19 — Segurança, papéis e auditoria (concluída; "primeira conta vira admin", limpeza de todas as preferências locais no logout e o ano-base como único parâmetro auditado necessitam validação)
- [x] Fase 20 — Performance, acessibilidade, testes e lançamento (concluída; Lighthouse medido só após publicar, virtualização de tabelas e resumo textual em todos os gráficos ficam como pendências)

**Progresso: 20/20 concluídas — projeto finalizado.**

- [x] Datas unificadas — "data de corte" removida; período do filtro (URL, padrão mês corrente) filtra os valores e a data de referência derivada (fim do período limitado a hoje) define status/atraso/aging. O problema conhecido "datas de referência fixas" foi resolvido.
