ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'OUR',
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.product_images
  DROP CONSTRAINT IF EXISTS product_images_kind_check;
ALTER TABLE public.product_images
  ADD CONSTRAINT product_images_kind_check CHECK (kind IN ('OUR','REFERENCE'));

CREATE INDEX IF NOT EXISTS product_images_kind_idx ON public.product_images (product_id, kind);

UPDATE public.product_images pi
SET kind = 'REFERENCE'
FROM public.products p
WHERE p.id = pi.product_id
  AND COALESCE(p.source_type, '') = 'FINDING'
  AND pi.kind = 'OUR';

UPDATE public.products p
SET cover_url = NULL
WHERE COALESCE(p.source_type, '') = 'FINDING'
  AND p.cover_url IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.product_images pi
    WHERE pi.product_id = p.id AND pi.path = p.cover_url AND pi.kind = 'REFERENCE'
  );