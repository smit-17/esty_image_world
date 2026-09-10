ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS finding_id uuid,
  ADD COLUMN IF NOT EXISTS finding_code text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS source_brand text,
  ADD COLUMN IF NOT EXISTS source_seller text,
  ADD COLUMN IF NOT EXISTS source_listing_id text,
  ADD COLUMN IF NOT EXISTS source_sku text,
  ADD COLUMN IF NOT EXISTS source_price text,
  ADD COLUMN IF NOT EXISTS source_currency text,
  ADD COLUMN IF NOT EXISTS source_description text,
  ADD COLUMN IF NOT EXISTS source_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_found_by text,
  ADD COLUMN IF NOT EXISTS source_assigned_to text,
  ADD COLUMN IF NOT EXISTS source_priority text;

CREATE INDEX IF NOT EXISTS products_finding_id_idx ON public.products (finding_id);
CREATE INDEX IF NOT EXISTS products_source_url_idx ON public.products (source_url);