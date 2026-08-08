CREATE TABLE public.etsy_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etsy_accounts TO anon, authenticated;
GRANT ALL ON public.etsy_accounts TO service_role;
ALTER TABLE public.etsy_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY etsy_accounts_all ON public.etsy_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.etsy_accounts (name)
SELECT DISTINCT btrim(etsy_account) FROM public.products
WHERE etsy_account IS NOT NULL AND btrim(etsy_account) <> ''
ON CONFLICT (name) DO NOTHING;