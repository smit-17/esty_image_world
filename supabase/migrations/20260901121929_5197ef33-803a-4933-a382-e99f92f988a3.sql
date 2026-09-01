ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS qc_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qc_note text,
  ADD COLUMN IF NOT EXISTS qc_by uuid,
  ADD COLUMN IF NOT EXISTS qc_updated_at timestamp with time zone;