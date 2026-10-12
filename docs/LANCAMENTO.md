# Checklist de lançamento (Fase 20)

- [x] Variáveis de ambiente (URL e chave pública do backend) presentes no .env
- [x] Favicon (public/favicon.ico), título "Controladoria", descrição e og: em pt-BR, `lang="pt-BR"`
- [x] robots.txt
- [x] Tema padrão claro; contraste por tokens do design system
- [ ] Usuários iniciais e papéis: primeira conta criada vira admin (necessita validação); admin cadastra os demais em **Usuários**
- [ ] Backup da base antes da primeira carga em produção (exportar tabelas pelo painel do backend)
- [ ] Rodar Lighthouse (desktop) na versão publicada: meta ≥ 90 em performance e acessibilidade
- [x] `bun run lint` e `bun run test` passando
