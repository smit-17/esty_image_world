CREATE TABLE public.product_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  gold_weight numeric NOT NULL DEFAULT 0,
  diamonds jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_estimates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_estimates TO anon;
GRANT ALL ON public.product_estimates TO service_role;
ALTER TABLE public.product_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_estimates_all ON public.product_estimates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER product_estimates_set_updated_at BEFORE UPDATE ON public.product_estimates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();