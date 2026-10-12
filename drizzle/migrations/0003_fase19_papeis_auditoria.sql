CREATE TYPE public.papel_app AS ENUM ('admin', 'controladoria', 'leitor');
CREATE TABLE public.perfis (
  user_id uuid PRIMARY KEY,
  nome text,
  email text,
  papel public.papel_app NOT NULL DEFAULT 'leitor',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auditoria (
  id bigserial PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  usuario_email text,
  acao text NOT NULL CHECK (acao IN ('importacao','parametro','exportacao','papel')),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX auditoria_criado_em ON public.auditoria (criado_em DESC);

CREATE OR REPLACE FUNCTION public.tem_papel(_user_id uuid, _papel public.papel_app)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE user_id = _user_id AND papel = _papel)
$$;
CREATE OR REPLACE FUNCTION public.pode_escrever(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE user_id = _user_id AND papel IN ('admin','controladoria'))
$$;
CREATE OR REPLACE FUNCTION public.tem_perfil(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.tem_papel(uuid, public.papel_app) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_escrever(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tem_perfil(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_papel(uuid, public.papel_app) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_escrever(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_perfil(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_perfil_no_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis (user_id, nome, email, papel)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email,
    CASE WHEN EXISTS (SELECT 1 FROM public.perfis WHERE papel = 'admin') THEN 'leitor'::public.papel_app ELSE 'admin'::public.papel_app END)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_no_cadastro() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ao_criar_usuario AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_no_cadastro();

CREATE OR REPLACE FUNCTION public.auditar_papel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := OLD.user_id; NEW.email := OLD.email; NEW.criado_em := OLD.criado_em;
  IF NEW.papel IS DISTINCT FROM OLD.papel THEN
    IF OLD.papel = 'admin' AND NOT EXISTS (SELECT 1 FROM public.perfis WHERE papel = 'admin' AND user_id <> OLD.user_id) THEN
      RAISE EXCEPTION 'É preciso manter ao menos um administrador.';
    END IF;
    INSERT INTO public.auditoria (usuario_id, usuario_email, acao, detalhes)
    VALUES (coalesce(auth.uid(), OLD.user_id), (SELECT email FROM public.perfis WHERE user_id = auth.uid()), 'papel',
      jsonb_build_object('alvo', OLD.email, 'de', OLD.papel, 'para', NEW.papel));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auditar_papel() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER perfis_auditar_papel BEFORE UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.auditar_papel();

GRANT SELECT, UPDATE ON public.perfis TO authenticated;
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.auditoria_id_seq TO authenticated;
GRANT ALL ON public.perfis, public.auditoria TO service_role;
REVOKE UPDATE, DELETE ON public.importacoes FROM authenticated;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Troca das políticas abertas por políticas por papel
DROP POLICY IF EXISTS "Usuários logados acessam negocios" ON public.negocios;
DROP POLICY IF EXISTS "Usuários logados acessam notas" ON public.notas_fiscais;
DROP POLICY IF EXISTS "Usuários logados acessam agregados" ON public.valores_agregados;
DROP POLICY IF EXISTS "Usuários logados acessam fato_mensal" ON public.fato_mensal;
DROP POLICY IF EXISTS "Usuários logados acessam cards_liberar" ON public.cards_liberar;
DROP POLICY IF EXISTS "Usuários logados acessam controles" ON public.controles_planilha;
DROP POLICY IF EXISTS "Usuários logados acessam clientes_dim" ON public.clientes_dim;
DROP POLICY IF EXISTS "Usuários logados leem importacoes" ON public.importacoes;
DROP POLICY IF EXISTS "Usuário registra a própria importação" ON public.importacoes;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['negocios','notas_fiscais','valores_agregados','fato_mensal','cards_liberar','controles_planilha','clientes_dim'] LOOP
    EXECUTE format('CREATE POLICY "leitura para papéis" ON public.%I FOR SELECT TO authenticated USING (public.tem_perfil(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "inserir: admin/controladoria" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.pode_escrever(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "editar: admin/controladoria" ON public.%I FOR UPDATE TO authenticated USING (public.pode_escrever(auth.uid())) WITH CHECK (public.pode_escrever(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "apagar: admin/controladoria" ON public.%I FOR DELETE TO authenticated USING (public.pode_escrever(auth.uid()))', t);
  END LOOP;
END $$;

CREATE POLICY "leitura de importações" ON public.importacoes FOR SELECT TO authenticated USING (public.tem_perfil(auth.uid()));
CREATE POLICY "registrar importação: admin/controladoria" ON public.importacoes FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND public.pode_escrever(auth.uid()));

CREATE POLICY "ver o próprio perfil" ON public.perfis FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin vê todos os perfis" ON public.perfis FOR SELECT TO authenticated USING (public.tem_papel(auth.uid(), 'admin'));
CREATE POLICY "admin altera perfis" ON public.perfis FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'admin')) WITH CHECK (public.tem_papel(auth.uid(), 'admin'));

CREATE POLICY "admin lê auditoria" ON public.auditoria FOR SELECT TO authenticated USING (public.tem_papel(auth.uid(), 'admin'));
CREATE POLICY "registrar exportação" ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND acao = 'exportacao' AND public.tem_perfil(auth.uid()));
CREATE POLICY "registrar parâmetro/importação" ON public.auditoria FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND acao IN ('parametro','importacao') AND public.pode_escrever(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.substituir_planilha(jsonb, jsonb, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.substituir_planilha_v2(p_negocios jsonb, p_notas jsonb, p_fatos jsonb, p_cards jsonb,
  p_controles jsonb, p_clientes jsonb, p_meta jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  IF NOT public.pode_escrever(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para importar (papel admin ou controladoria exigido).' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.notas_fiscais WHERE numero_nf IS NOT NULL;
  DELETE FROM public.negocios WHERE id_pipe IS NOT NULL;
  DELETE FROM public.fato_mensal WHERE id IS NOT NULL;
  DELETE FROM public.cards_liberar WHERE id IS NOT NULL;
  DELETE FROM public.controles_planilha WHERE id IS NOT NULL;
  DELETE FROM public.clientes_dim WHERE nome IS NOT NULL;
  INSERT INTO public.negocios (id_pipe, cliente, titulo, ganho_em, bu, plataforma, tipo_contrato, autorizada, valor, data_competencia)
    SELECT id_pipe, cliente, titulo, to_data(ganho_em), bu, plataforma, tipo_contrato, autorizada, valor, to_data(data_competencia)
    FROM jsonb_to_recordset(coalesce(p_negocios, '[]')) AS x(id_pipe text, cliente text, titulo text, ganho_em text, bu text,
      plataforma text, tipo_contrato text, autorizada boolean, valor numeric, data_competencia text);
  INSERT INTO public.notas_fiscais (numero_nf, id_pipe, cliente, cliente_inferido, razao_social, card, link_pipe, link_nf, codigo, regime, bu, valor, data_competencia, data_emissao, data_vencimento, data_pagamento)
    SELECT numero_nf, id_pipe, cliente, coalesce(cliente_inferido, false), razao_social, card, link_pipe, link_nf, codigo, regime, bu, valor,
      to_data(data_competencia), to_data(data_emissao), to_data(data_vencimento), to_data(data_pagamento)
    FROM jsonb_to_recordset(coalesce(p_notas, '[]')) AS x(numero_nf text, id_pipe text, cliente text, cliente_inferido boolean, razao_social text,
      card text, link_pipe text, link_nf text, codigo text, regime text, bu text, valor numeric,
      data_competencia text, data_emissao text, data_vencimento text, data_pagamento text);
  INSERT INTO public.fato_mensal (bloco, nivel, bu, plataforma, contrato, produto, item_cobranca, cliente, categoria, mes, anterior, valor)
    SELECT bloco, nivel, bu, plataforma, contrato, produto, item_cobranca, cliente, categoria,
      CASE WHEN coalesce(anterior, false) THEN DATE '2025-12-01' ELSE date_trunc('month', to_data(mes))::date END,
      coalesce(anterior, false), coalesce(valor, 0)
    FROM jsonb_to_recordset(coalesce(p_fatos, '[]')) AS x(bloco text, nivel text, bu text, plataforma text, contrato text, produto text,
      item_cobranca text, cliente text, categoria text, mes text, anterior boolean, valor numeric);
  INSERT INTO public.cards_liberar (cliente, produto, plataforma, contrato, categoria, valor)
    SELECT cliente, produto, plataforma, contrato, categoria, coalesce(valor, 0)
    FROM jsonb_to_recordset(coalesce(p_cards, '[]')) AS x(cliente text, produto text, plataforma text, contrato text, categoria text, valor numeric);
  INSERT INTO public.controles_planilha (bloco, mes, valor_planilha, descricao)
    SELECT bloco, date_trunc('month', to_data(mes))::date, valor_planilha, descricao
    FROM jsonb_to_recordset(coalesce(p_controles, '[]')) AS x(bloco text, mes text, valor_planilha numeric, descricao text);
  INSERT INTO public.clientes_dim (nome, categoria, ativo)
    SELECT DISTINCT ON (nome) nome, categoria, coalesce(ativo, true)
    FROM jsonb_to_recordset(coalesce(p_clientes, '[]')) AS x(nome text, categoria text, ativo boolean)
    WHERE nome IS NOT NULL;
  INSERT INTO public.importacoes (usuario_id, nome_arquivo, hash_sha256, qtd_negocios, qtd_nfs, qtd_fatos, total_faturado, avisos, erros)
  VALUES (auth.uid(), p_meta->>'nome_arquivo', p_meta->>'hash_sha256',
    jsonb_array_length(coalesce(p_negocios, '[]')), jsonb_array_length(coalesce(p_notas, '[]')), jsonb_array_length(coalesce(p_fatos, '[]')),
    (SELECT coalesce(sum(valor), 0) FROM public.notas_fiscais),
    coalesce(p_meta->'avisos', '[]'), coalesce(p_meta->'erros', '[]'))
  RETURNING id INTO v_id;
  INSERT INTO public.auditoria (usuario_id, usuario_email, acao, detalhes)
  VALUES (auth.uid(), (SELECT email FROM public.perfis WHERE user_id = auth.uid()), 'importacao',
    jsonb_build_object('importacao_id', v_id, 'arquivo', p_meta->>'nome_arquivo', 'hash', p_meta->>'hash_sha256',
      'negocios', jsonb_array_length(coalesce(p_negocios, '[]')), 'nfs', jsonb_array_length(coalesce(p_notas, '[]')),
      'fatos', jsonb_array_length(coalesce(p_fatos, '[]'))));
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.substituir_planilha_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_planilha_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;