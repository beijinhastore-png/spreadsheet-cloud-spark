CREATE TABLE public.negocios (
  id_pipe text PRIMARY KEY,
  razao_social text,
  codigo text,
  bu text,
  plataforma text,
  tipo_contrato text,
  status text,
  valor numeric(14,2),
  data_competencia text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notas_fiscais (
  numero_nf text PRIMARY KEY,
  id_pipe text,
  razao_social text,
  codigo text,
  plataforma text,
  tipo_contrato text,
  status text,
  valor numeric(14,2),
  data_competencia text,
  data_emissao text,
  data_vencimento text,
  data_pagamento text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negocios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.negocios TO service_role;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários logados acessam negocios" ON public.negocios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários logados acessam notas" ON public.notas_fiscais FOR ALL TO authenticated USING (true) WITH CHECK (true);