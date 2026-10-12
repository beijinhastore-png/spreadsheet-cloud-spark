# Escopo do Sistema — Controladoria Financeira e Operacional

## 1. Visão do produto
Sistema web de controladoria financeira e operacional para uma empresa que comercializa licenciamento, serviços e operação de plataformas de mídia e analytics (DV360, CM360, SA360, GA360, Meta e similares), com duas unidades de negócio: **Advertising** e **Analytics**. Objetivo: acompanhar do negócio ganho (Pipe) até o recebimento, com visão de faturamento, caixa, custos, impostos e margem.

## 2. Módulos
1. **Dashboard** — visão consolidada dos principais indicadores.
2. **Negócios (Pipe)** — cards ganhos e seus valores previstos.
3. **Faturamento** — notas fiscais emitidas.
4. **Recebíveis** — títulos a receber e recebidos.
5. **Fluxo de caixa** — entradas e saídas por período.
6. **Pipe × Faturado** — comparação entre o vendido e o faturado.
7. **Controladoria operacional** — emissão, custos, impostos e créditos.
8. **Clientes** — cadastro e visão por cliente.
9. **Relatórios** — relatórios por BU, produto, plataforma e período.
10. **Importação de planilha** — carga de dados a partir de planilhas.

## 3. Mapa de navegação (rotas previstas)
| Rota | Módulo |
|---|---|
| `/` | Redireciona para `/dashboard` |
| `/dashboard` | Dashboard |
| `/sobre` | Escopo do sistema |
| `/negocios` | Negócios (Pipe) |
| `/faturamento` | Faturamento |
| `/recebiveis` | Recebíveis |
| `/fluxo-de-caixa` | Fluxo de caixa |
| `/pipe-x-faturado` | Pipe × Faturado |
| `/controladoria` | Controladoria operacional |
| `/clientes` | Clientes |
| `/relatorios` | Relatórios |
| `/importacao` | Importação de planilha |


## 4. Glossário
- **Negócio / Pipe** — card ganho no funil comercial.
- **NF** — nota fiscal emitida ao cliente.
- **Competência** — mês a que a receita/custo se refere.
- **Emissão** — data de emissão da NF.
- **Vencimento** — data prevista de pagamento.
- **Recebimento** — data em que o valor efetivamente entrou.
- **BU** — unidade de negócio: Advertising ou Analytics.
- **Produto** — item comercializado.
- **Tipo de contrato** — Licenciamento, Serviço ou Operação.
- **Plataforma** — DV360, CM360, SA360, GA360, Meta etc.
- **Categoria** — Terceiro ou Anunciante.

## 5. Premissas
- Uma única empresa.
- Moeda: BRL.
- Ano-base: 2026 (janeiro a dezembro).
- Quatro visões de data: competência, emissão, vencimento e recebimento.

## 6. Fonte de dados
Planilha com duas abas — **Parte1** (detalhe de negócios e NFs) e **Parte2** (história financeira consolidada, colunas A até GW). Detalhes em `docs/CONTEXTO_DADOS.md`.

## 7. Decisões tomadas
- "Código" = código de serviço da NFS-e.
- Impostos, créditos e custos vêm da planilha (Parte2); o sistema não os calcula.

## 8. Necessita validação
- Fórmula de margem.
- Regra de "Total p/ Card".
- Critério Terceiro/Anunciante.

## 9. Roadmap (20 fases)
Fases 1–2 concluídas; fases 3–20 pendentes. Checklist em `docs/ROADMAP.md`.
