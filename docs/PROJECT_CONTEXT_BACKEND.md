# Backend — modelo de dados v2 (Fase 4)

## Tabelas
- `negocios`, `notas_fiscais` — detalhe da Parte1. Datas ainda em `text` (conversão para `date` pendente de liberação; ver abaixo). O app normaliza competência com `.slice(0,7)`.
- `valores_agregados` — **LEGADO**, mantida até a Fase 8 (substituída por `fato_mensal`).
- `fato_mensal` — bloco × linha × mês da Parte2. Colunas: bloco (pipe, pipe_autorizado, fat_emissao, fat_competencia, dif_pipe_fat, a_liberar, recebimento, vencimento, dif_venc_receb, custo_pagamento, dif_custo_receb, custo_emissao, impostos, creditos), nivel (produto|cliente), bu, plataforma, contrato, produto, item_cobranca, cliente, categoria (Terceiro|Anunciante|null), mes (date, sempre dia 1), anterior (true para "<31/12/2025"/"31/12/2025", com mes = 2025-12-01), valor numeric(16,4). Índices (bloco,mes), (bu,produto,mes), (cliente,bloco,mes).
- `cards_liberar` — coluna "Cards a Liberar" / BZ "A liberar".
- `controles_planilha` — linhas "Check:" e totais gerais da Parte2.
- `importacoes` — histórico de cargas (arquivo, hash, contagens, total faturado, avisos, erros).
- `clientes_dim` — nome canônico, categoria, ativo (substitui `categoria_cliente` de valores_agregados).

Todas com RLS: acesso a usuários logados; `importacoes` só leitura + inserção do próprio usuário.

## Funções
- `to_data(text)` — converte "AAAA-MM" (dia 1), "AAAA-MM-DD" ou "DD/MM/AAAA" em date.
- `substituir_planilha(negocios, notas, agregados)` — antiga, usada pelo importador atual até a Fase 6.
- `substituir_planilha_v2(p_negocios, p_notas, p_fatos, p_cards, p_controles, p_clientes, p_meta)` — SECURITY INVOKER, transação única, tudo-ou-nada; normaliza `mes` para dia 1 e grava em `importacoes` (retorna o id). EXECUTE só para authenticated. `p_meta`: { nome_arquivo, hash_sha256, avisos[], erros[] }.

SQL completo: `drizzle/migrations/0002_fase4_modelo_v2_aditivo.sql`.

## Pendente de liberação (mudança incompatível)
```sql
ALTER TABLE negocios ALTER COLUMN data_competencia TYPE date USING to_data(data_competencia),
  ALTER COLUMN ganho_em TYPE date USING to_data(ganho_em);
ALTER TABLE notas_fiscais ALTER COLUMN data_competencia TYPE date USING to_data(data_competencia),
  ALTER COLUMN data_emissao TYPE date USING to_data(data_emissao),
  ALTER COLUMN data_vencimento TYPE date USING to_data(data_vencimento),
  ALTER COLUMN data_pagamento TYPE date USING to_data(data_pagamento);
ALTER TABLE negocios DROP COLUMN razao_social, DROP COLUMN codigo, DROP COLUMN status;
ALTER TABLE notas_fiscais DROP COLUMN plataforma, DROP COLUMN tipo_contrato, DROP COLUMN status;
-- e recriar substituir_planilha usando jsonb_to_recordset + to_data()
```
