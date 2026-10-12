CREATE TABLE IF NOT EXISTS public.visoes_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}',
  configuracao jsonb NOT NULL DEFAULT '{}',
  compartilhada boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visoes_salvas TO authenticated;
GRANT ALL ON public.visoes_salvas TO service_role;
ALTER TABLE public.visoes_salvas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver próprias ou compartilhadas" ON public.visoes_salvas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR compartilhada);
CREATE POLICY "criar próprias" ON public.visoes_salvas FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "editar próprias" ON public.visoes_salvas FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "apagar próprias" ON public.visoes_salvas FOR DELETE TO authenticated USING (usuario_id = auth.uid());