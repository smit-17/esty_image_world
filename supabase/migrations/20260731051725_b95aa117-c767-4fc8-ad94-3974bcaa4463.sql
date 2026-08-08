ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS etsy_listed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etsy_account text,
  ADD COLUMN IF NOT EXISTS etsy_listed_at timestamptz;