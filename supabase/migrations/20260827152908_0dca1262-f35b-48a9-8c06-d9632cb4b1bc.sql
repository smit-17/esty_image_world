ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS product_type text;

CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products (sku);

ALTER TABLE public.product_estimates
  ADD COLUMN IF NOT EXISTS metal_type text,
  ADD COLUMN IF NOT EXISTS metal_karat text,
  ADD COLUMN IF NOT EXISTS metal_colour text,
  ADD COLUMN IF NOT EXISTS diamond_type text;