ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS ganho_em text,
  ADD COLUMN IF NOT EXISTS autorizada boolean;
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS cliente_inferido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card text,
  ADD COLUMN IF NOT EXISTS link_pipe text,
  ADD COLUMN IF NOT EXISTS link_nf text,
  ADD COLUMN IF NOT EXISTS regime text,
  ADD COLUMN IF NOT EXISTS bu text;
CREATE TABLE public.valores_agregados (
  id bigserial PRIMARY KEY,
  tipo text NOT NULL,
  bu text,
  produto text,
  categoria text,
  mes text,
  valor numeric(16,4) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.valores_agregados TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.valores_agregados_id_seq TO authenticated;
GRANT ALL ON public.valores_agregados TO service_role;
ALTER TABLE public.valores_agregados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários logados acessam agregados" ON public.valores_agregados FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.substituir_planilha(p_negocios jsonb, p_notas jsonb, p_agregados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notas_fiscais WHERE numero_nf IS NOT NULL;
  DELETE FROM public.negocios WHERE id_pipe IS NOT NULL;
  DELETE FROM public.valores_agregados WHERE id IS NOT NULL;
  INSERT INTO public.negocios (id_pipe, cliente, titulo, ganho_em, bu, plataforma, tipo_contrato, autorizada, valor, data_competencia)
    SELECT id_pipe, cliente, titulo, ganho_em, bu, plataforma, tipo_contrato, autorizada, valor, data_competencia
    FROM jsonb_populate_recordset(NULL::public.negocios, p_negocios);
  INSERT INTO public.notas_fiscais (numero_nf, id_pipe, cliente, cliente_inferido, razao_social, card, link_pipe, link_nf, codigo, regime, bu, valor, data_competencia, data_emissao, data_vencimento, data_pagamento)
    SELECT numero_nf, id_pipe, cliente, coalesce(cliente_inferido, false), razao_social, card, link_pipe, link_nf, codigo, regime, bu, valor, data_competencia, data_emissao, data_vencimento, data_pagamento
    FROM jsonb_populate_recordset(NULL::public.notas_fiscais, p_notas);
  INSERT INTO public.valores_agregados (tipo, bu, produto, categoria, mes, valor)
    SELECT tipo, bu, produto, categoria, mes, valor
    FROM jsonb_populate_recordset(NULL::public.valores_agregados, p_agregados);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.substituir_planilha(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.substituir_planilha(jsonb, jsonb, jsonb) TO authenticated;