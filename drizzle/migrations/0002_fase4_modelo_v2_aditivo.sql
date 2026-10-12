CREATE OR REPLACE FUNCTION public.to_data(p text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN NULL
    WHEN p ~ '^\d{4}-\d{2}$' THEN (p || '-01')::date
    WHEN p ~ '^\d{4}-\d{2}-\d{2}' THEN substr(p, 1, 10)::date
    WHEN p ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date(p, 'DD/MM/YYYY')
    ELSE NULL END
$$;
REVOKE EXECUTE ON FUNCTION public.to_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.to_data(text) TO authenticated;

COMMENT ON TABLE public.valores_agregados IS 'LEGADO: mantida por compatibilidade até a Fase 8; substituída por fato_mensal';

CREATE TABLE public.fato_mensal (
  id bigserial PRIMARY KEY,
  bloco text NOT NULL CHECK (bloco IN ('pipe','pipe_autorizado','fat_emissao','fat_competencia','dif_pipe_fat','a_liberar','recebimento','vencimento','dif_venc_receb','custo_pagamento','dif_custo_receb','custo_emissao','impostos','creditos')),
  nivel text NOT NULL CHECK (nivel IN ('produto','cliente')),
  bu text, plataforma text, contrato text, produto text, item_cobranca text, cliente text,
  categoria text CHECK (categoria IS NULL OR categoria IN ('Terceiro','Anunciante')),
  mes date NOT NULL CHECK (extract(day FROM mes) = 1),
  anterior boolean NOT NULL DEFAULT false,
  valor numeric(16,4) NOT NULL DEFAULT 0
);
CREATE INDEX fato_mensal_bloco_mes ON public.fato_mensal (bloco, mes);
CREATE INDEX fato_mensal_bu_prod_mes ON public.fato_mensal (bu, produto, mes);
CREATE INDEX fato_mensal_cli_bloco_mes ON public.fato_mensal (cliente, bloco, mes);
CREATE TABLE public.cards_liberar (
  id bigserial PRIMARY KEY, cliente text, produto text, plataforma text, contrato text, categoria text,
  valor numeric(16,4) NOT NULL DEFAULT 0
);
CREATE TABLE public.controles_planilha (
  id bigserial PRIMARY KEY, bloco text, mes date, valor_planilha numeric(16,4), descricao text
);
CREATE TABLE public.importacoes (
  id bigserial PRIMARY KEY, criado_em timestamptz NOT NULL DEFAULT now(), usuario_id uuid DEFAULT auth.uid(),
  nome_arquivo text, hash_sha256 text, qtd_negocios integer, qtd_nfs integer, qtd_fatos integer,
  total_faturado numeric(16,2), avisos jsonb NOT NULL DEFAULT '[]'::jsonb, erros jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE public.clientes_dim (nome text PRIMARY KEY, categoria text, ativo boolean NOT NULL DEFAULT true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fato_mensal, public.cards_liberar, public.controles_planilha, public.importacoes, public.clientes_dim TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.fato_mensal_id_seq, public.cards_liberar_id_seq, public.controles_planilha_id_seq, public.importacoes_id_seq TO authenticated;
GRANT ALL ON public.fato_mensal, public.cards_liberar, public.controles_planilha, public.importacoes, public.clientes_dim TO service_role;

ALTER TABLE public.fato_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards_liberar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controles_planilha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_dim ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários logados acessam fato_mensal" ON public.fato_mensal FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários logados acessam cards_liberar" ON public.cards_liberar FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários logados acessam controles" ON public.controles_planilha FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários logados leem importacoes" ON public.importacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuário registra a própria importação" ON public.importacoes FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Usuários logados acessam clientes_dim" ON public.clientes_dim FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.substituir_planilha_v2(p_negocios jsonb, p_notas jsonb, p_fatos jsonb, p_cards jsonb,
  p_controles jsonb, p_clientes jsonb, p_meta jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
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
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.substituir_planilha_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_planilha_v2(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;