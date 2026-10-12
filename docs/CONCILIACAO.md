# Conciliação — Rodada 1 (confiança dos dados)

Planilha analisada: `controladoria.xlsx` (Parte1: 2.654 linhas · Parte2: 540 linhas). Nada na planilha foi alterado e nenhum número foi forçado a fechar.

## Divergências

| Diferença | Valor | Causa | Ação sugerida | Quem decide |
|---|---|---|---|---|
| Total faturado: NFs × Parte2 | R$ 10,00 | Linha **"Teste"** do resumo da Parte2 (linha 18, set/2026), ignorada de propósito. **A NF 23596 NÃO explica**: ela vale **R$ 48.960,00** (cliente TESTE, emissão 07/01/2026, competência fev/2026), fica fora da Parte1 e também não aparece na Parte2. | Na tela /qualidade aparece agora como "Informativo". Remover a linha "Teste" da Parte2 (opcional). | Planilha |
| Faturado por produto × por cliente (ano) | R$ 160.000,00 | Linha **"Não Localizado"** do resumo (linha 17, set/2026) sem nenhuma seção de clientes. É a **única** contribuição: "Meta" × "META" só difere em maiúsculas e se anula. | Atribuir os R$ 160 mil a um produto e a um cliente na planilha. | Planilha |
| Saldo anterior a 2026 (competência): por produto × por cliente | R$ 920.558,28 | O leitor do app **não tem erro** aqui: em todas as seções a soma dos clientes é igual à linha "Totais:". A diferença é da planilha e tem duas partes: **(1) R$ 644.897,66**: nas seções, a coluna AX ("<31/12/2025" por competência) é menor que a AI (por emissão), mas no resumo AX = AI. Por seção: CM360 Lic. R$ 314.492,76 · DV360 Lic. R$ 253.506,50 · SA360 Lic. R$ 76.276,56 · CM360 Serv. R$ 621,84. **(2) R$ 275.660,62**: há saldo anterior no resumo sem nenhum cliente nas seções: Programática Serviço R$ 215.116,17 · AdServer Serviço R$ 45.665,76 · Adserver Lic. R$ 7.756,21 · Programática Lic. R$ 7.122,48. A origem desse saldo é **causa não identificada**. | Decidir qual competência vale para o saldo anterior (resumo ou seções) e lançar os clientes que faltam. | Planilha |
| Soma dos clientes × linha "Totais" (custos) | R$ 82,50 (DV360 Serv.) + R$ 259,77 em diversas colunas (CM360 Serv.) | **Erro do app (corrigido)**: 23 linhas com custos e sem nome de cliente (linhas 177–195 e outras) eram descartadas, mas entram no "Totais:". Agora são lidas como "(sem cliente)". O aviso caiu de 39 para 12 grupos e de 117 para 103 divergências. | Preencher o cliente nessas linhas. | App (feito) + planilha |
| Cards a Liberar (coluna E) | R$ 59.728,69 | Valor só existe na linha "Totais:" (DV360 Lic./Serv., CM360 Lic.), sem valor nos clientes. | Distribuir por cliente. | Planilha |
| Coluna DF (anterior das diferenças venc. × receb.) | 9 seções | A linha "Totais:" traz o saldo por vencimento; os clientes trazem a diferença (com sinal invertido). | Uniformizar a coluna. | Planilha |
| Diferenças custos × recebimentos: seções × resumo | 81 combinações produto × mês | O resumo usa outra conta que não é a soma das seções. **Causa não identificada.** | Revisar as fórmulas do bloco. | Planilha |

## Os 16 grupos de avisos da importação

Classes: (a) erro de leitura do app · (b) inconsistência da planilha · (c) diferença esperada.

| Grupo | Classe |
|---|---|
| Clientes inferidos pela razão social (5) | c |
| Excluídos da importação, NF 23596 TESTE (1) | c |
| Sufixo do card × coluna da matriz (2) | b |
| Competência × coluna PE (2, mesmas NFs) | b |
| Status da planilha × calculado (75): status parado na data de preenchimento | c |
| NFs sem ID do Pipe (5) | b |
| Clientes unidos por alias (6) | c |
| Total p/ Card × soma (1, linha 175) | b |
| Ajustes de layout, coluna DF (1) | c |
| "Não Localizado" no resumo (7) | b |
| Sinal invertido nas diferenças (121) | c |
| Produto "Teste" ignorado (7) | c |
| Seção GA360 Serviço sem "Totais" (1) | b |
| Soma dos clientes × Totais (39 → 12) | **a** (corrigido, com teste em `src/test/parte2-sem-cliente.test.ts`) + b no restante |
| Seções × resumo: divergência (117 → 103) | b |
| Produto da coluna A × seção (4) | b |

Na tela /qualidade, a aba "Avisos da importação" mostra esses grupos por classe, com o que significa, o impacto em R$ e o detalhe expansível.
