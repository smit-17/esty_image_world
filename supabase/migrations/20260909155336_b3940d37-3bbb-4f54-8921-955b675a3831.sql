ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS source_sku text,
  ADD COLUMN IF NOT EXISTS main_image text,
  ADD COLUMN IF NOT EXISTS image_seeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra jsonb NOT NULL DEFAULT '[]'::jsonb;