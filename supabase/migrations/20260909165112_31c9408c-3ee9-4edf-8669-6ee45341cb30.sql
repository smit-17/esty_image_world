ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_type text;
UPDATE public.products SET source_type = 'FINDING' WHERE finding_id IS NOT NULL AND source_type IS NULL;
CREATE INDEX IF NOT EXISTS products_source_type_idx ON public.products (source_type);