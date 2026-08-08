ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS etsy_status text NOT NULL DEFAULT 'not_listed',
  ADD COLUMN IF NOT EXISTS etsy_url text,
  ADD COLUMN IF NOT EXISTS etsy_listed_by text;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS thumb_path text;

UPDATE public.products SET etsy_status = 'live' WHERE etsy_listed = true AND etsy_status = 'not_listed';