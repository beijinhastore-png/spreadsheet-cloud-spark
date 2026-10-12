# Manual do usuário — Controladoria

## 1. Como importar a planilha
1. Entre com seu usuário (papel admin ou editor) e abra **Importação**.
2. Selecione o arquivo .xlsx com as abas **Parte1** (negócios e NFs) e **Parte2** (história financeira consolidada, colunas A–GW).
3. Acompanhe a barra de progresso (Parte1 → Parte2 → validação).
4. Revise os avisos (vínculos negócio × NF, fórmulas com erro, textos não numéricos). Avisos não bloqueiam; erros de estrutura (aba ou bloco ausente) bloqueiam com mensagem clara.
5. Confirme. O arquivo recebe um código (hash) — importar o mesmo arquivo de novo é identificado.
6. Confira **Qualidade dos dados** após cada carga.

## 2. Como ler a Jornada do Dinheiro
A Jornada mostra o caminho de cada real: **Pipe (vendido) → Faturado (NF emitida) → A vencer → Recebido**, com os custos ao lado.
- Use os filtros do topo (período, regime, BU, produto, cliente). Eles ficam no endereço da página, então um link compartilhado abre com os mesmos filtros.
- Diferenças entre etapas indicam dinheiro "parado": vendido e não faturado, faturado e não recebido.
- O mapa de calor por mês destaca onde a diferença passa da tolerância.
- Itens com o selo **Necessita validação** usam regras ainda não confirmadas pela controladoria.

## 3. Como interpretar o semáforo
- **Verde** — dentro do esperado (ex.: recebido no prazo, diferença Pipe × Faturado dentro da tolerância, padrão 5%).
- **Amarelo** — atenção (próximo do vencimento, diferença pequena acima da tolerância).
- **Vermelho** — ação necessária (atrasado, negócio sem NF, divergência relevante).
O semáforo sempre vem acompanhado de texto, nunca só de cor. Os limiares estão marcados como "Necessita validação".

## 4. Dicas
- Navegação completa por teclado (Tab / Shift+Tab, Enter, Esc fecha painéis).
- Relatórios exportam em Excel/CSV/PDF na tela **Relatórios**.
