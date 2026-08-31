ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS qc_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qc_by uuid;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_qc_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_qc_status_check
  CHECK (qc_status IN ('PENDING','PASS','HOLD','REJECT'));

CREATE INDEX IF NOT EXISTS products_qc_status_idx ON public.products (qc_status);