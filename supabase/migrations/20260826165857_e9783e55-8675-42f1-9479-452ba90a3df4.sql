CREATE TABLE public.finding_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finding_team_members TO anon, authenticated;
GRANT ALL ON public.finding_team_members TO service_role;
ALTER TABLE public.finding_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY finding_team_members_all ON public.finding_team_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.finding_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finding_options TO anon, authenticated;
GRANT ALL ON public.finding_options TO service_role;
ALTER TABLE public.finding_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY finding_options_all ON public.finding_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  product_url text,
  platform text NOT NULL DEFAULT 'Other',
  brand text,
  category text,
  gender text,
  style text,
  priority text NOT NULL DEFAULT 'Medium',
  note text,
  finding_by text,
  image_path text,
  thumb_path text,
  assigned_to text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO anon, authenticated;
GRANT ALL ON public.findings TO service_role;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_all ON public.findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER findings_set_updated_at BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX findings_created_at_idx ON public.findings (created_at DESC);
CREATE INDEX findings_assigned_to_idx ON public.findings (assigned_to);

CREATE TABLE public.finding_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid REFERENCES public.findings(id) ON DELETE SET NULL,
  finding_code text,
  user_name text,
  activity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finding_activity TO anon, authenticated;
GRANT ALL ON public.finding_activity TO service_role;
ALTER TABLE public.finding_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY finding_activity_all ON public.finding_activity FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX finding_activity_created_at_idx ON public.finding_activity (created_at DESC);

INSERT INTO public.finding_options (kind, value) VALUES
  ('category','Ring'),('category','Earring'),('category','Necklace'),('category','Bracelet'),
  ('platform','Etsy'),('platform','Pinterest'),('platform','Google'),('platform','Brand Website'),('platform','Other'),
  ('style','Classic'),('style','Regular'),('style','Unique Cut Diamond'),('style','Gemstone Jewelry');