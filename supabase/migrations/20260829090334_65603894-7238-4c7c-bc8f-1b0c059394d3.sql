-- =============== Phase 1: core auth tables ===============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  email text UNIQUE,
  mobile text,
  avatar_url text,
  bio text,
  status text NOT NULL DEFAULT 'PENDING_APPROVAL',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX profiles_username_idx ON public.profiles (lower(username));
CREATE INDEX profiles_status_idx ON public.profiles (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_status_history_user_idx ON public.user_status_history (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.user_status_history TO authenticated;
GRANT ALL ON public.user_status_history TO service_role;

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);
CREATE UNIQUE INDEX user_roles_active_uniq ON public.user_roles (user_id, role_id) WHERE removed_at IS NULL;
CREATE INDEX user_roles_user_idx ON public.user_roles (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- =============== Phase 2: permissions ===============
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

-- =============== Phase 3: audit logs ===============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_email text,
  user_role text,
  action text NOT NULL,
  module text,
  entity_type text,
  entity_id text,
  description text,
  old_values jsonb,
  new_values jsonb,
  request_url text,
  ip_address text,
  user_agent text,
  device text,
  browser text,
  os text,
  session_id text,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX audit_logs_module_idx ON public.audit_logs (module);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- =============== Phase 4: ownership on existing tables ===============
ALTER TABLE public.products
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid,
  ADD COLUMN is_shared boolean NOT NULL DEFAULT true;
ALTER TABLE public.product_images ADD COLUMN uploaded_by uuid;
ALTER TABLE public.product_estimates
  ADD COLUMN created_by uuid,
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz;
ALTER TABLE public.findings
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid;
ALTER TABLE public.finding_activity
  ADD COLUMN user_id uuid,
  ADD COLUMN ip_address text;

-- =============== Helper functions ===============
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _uid AND ur.removed_at IS NULL AND r.is_super_admin
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_active(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.status = 'ACTIVE');
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_super_admin(_uid) THEN true
    ELSE COALESCE(
      (SELECT up.allowed FROM public.user_permissions up
        JOIN public.permissions p ON p.id = up.permission_id
        WHERE up.user_id = _uid AND p.code = _code LIMIT 1),
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = _uid AND ur.removed_at IS NULL AND p.code = _code
      ))
  END;
$$;

CREATE OR REPLACE FUNCTION public.my_permission_codes()
RETURNS TABLE (code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.code FROM public.permissions p
  WHERE public.is_super_admin(auth.uid())
  UNION
  SELECT p.code FROM public.permissions p
  JOIN public.role_permissions rp ON rp.permission_id = p.id
  JOIN public.user_roles ur ON ur.role_id = rp.role_id
  WHERE ur.user_id = auth.uid() AND ur.removed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid() AND up.permission_id = p.id AND up.allowed = false)
  UNION
  SELECT p.code FROM public.permissions p
  JOIN public.user_permissions up ON up.permission_id = p.id
  WHERE up.user_id = auth.uid() AND up.allowed = true;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name text DEFAULT NULL, _username text DEFAULT NULL, _mobile text DEFAULT NULL)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _p public.profiles;
  _bootstrap text := 'lepdogroup@gmail.com';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;
  SELECT * INTO _p FROM public.profiles WHERE id = _uid;
  IF _p.id IS NULL THEN
    INSERT INTO public.profiles (id, email, username, full_name, mobile, status)
    VALUES (
      _uid, _email,
      COALESCE(NULLIF(trim(_username), ''), split_part(_email, '@', 1) || '-' || substr(_uid::text, 1, 4)),
      COALESCE(NULLIF(trim(_full_name), ''), split_part(_email, '@', 1)),
      NULLIF(trim(_mobile), ''),
      CASE WHEN lower(_email) = _bootstrap THEN 'ACTIVE' ELSE 'PENDING_APPROVAL' END
    )
    RETURNING * INTO _p;
    INSERT INTO public.user_status_history (user_id, old_status, new_status, reason, changed_by)
    VALUES (_uid, NULL, _p.status, 'Registration', _uid);
  END IF;

  IF lower(COALESCE(_email, '')) = _bootstrap THEN
    IF _p.status <> 'ACTIVE' THEN
      UPDATE public.profiles SET status = 'ACTIVE', updated_at = now() WHERE id = _uid;
    END IF;
    INSERT INTO public.user_roles (user_id, role_id, assigned_by)
    SELECT _uid, r.id, _uid FROM public.roles r WHERE r.code = 'SUPER_ADMIN'
    ON CONFLICT DO NOTHING;
    SELECT * INTO _p FROM public.profiles WHERE id = _uid;
  END IF;

  RETURN _p;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_status(_user_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) AND NOT public.has_permission(auth.uid(), 'USER_APPROVE') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT status INTO _old FROM public.profiles WHERE id = _user_id;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.user_status_history (user_id, old_status, new_status, reason, changed_by)
  VALUES (_user_id, _old, _status, _reason, auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text, text) TO authenticated;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== RLS ===============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'USER_VIEW'));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

ALTER TABLE public.user_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ush_select ON public.user_status_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY ush_insert ON public.user_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_write ON public.permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'USER_VIEW'));
CREATE POLICY user_roles_write ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY user_permissions_write ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'AUDIT_VIEW'));
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Existing data tables: signed-in active accounts only
DROP POLICY IF EXISTS products_all ON public.products;
DROP POLICY IF EXISTS product_images_all ON public.product_images;
DROP POLICY IF EXISTS product_estimates_all ON public.product_estimates;
DROP POLICY IF EXISTS categories_all ON public.categories;
DROP POLICY IF EXISTS team_members_all ON public.team_members;
DROP POLICY IF EXISTS etsy_accounts_all ON public.etsy_accounts;
DROP POLICY IF EXISTS findings_all ON public.findings;
DROP POLICY IF EXISTS finding_activity_all ON public.finding_activity;
DROP POLICY IF EXISTS finding_options_all ON public.finding_options;
DROP POLICY IF EXISTS finding_team_members_all ON public.finding_team_members;

REVOKE ALL ON public.products, public.product_images, public.product_estimates,
  public.categories, public.team_members, public.etsy_accounts, public.findings,
  public.finding_activity, public.finding_options, public.finding_team_members FROM anon;

CREATE POLICY products_active ON public.products FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY product_images_active ON public.product_images FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY product_estimates_active ON public.product_estimates FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY categories_active ON public.categories FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY team_members_active ON public.team_members FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY etsy_accounts_active ON public.etsy_accounts FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY findings_active ON public.findings FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY finding_activity_active ON public.finding_activity FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY finding_options_active ON public.finding_options FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));
CREATE POLICY finding_team_members_active ON public.finding_team_members FOR ALL TO authenticated
  USING (public.user_is_active(auth.uid())) WITH CHECK (public.user_is_active(auth.uid()));

-- Storage: signed-in active accounts only
DROP POLICY IF EXISTS jewelry_images_all ON storage.objects;
CREATE POLICY jewelry_images_active ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'jewelry-images' AND public.user_is_active(auth.uid()))
  WITH CHECK (bucket_id = 'jewelry-images' AND public.user_is_active(auth.uid()));

-- =============== Seed roles & permissions ===============
INSERT INTO public.roles (name, code, description, is_system, is_super_admin) VALUES
  ('Super Admin', 'SUPER_ADMIN', 'Unrestricted system access', true, true),
  ('Admin', 'ADMIN', 'High-level administrative functions', true, false),
  ('Manager', 'MANAGER', 'Department / team management', true, false),
  ('Staff', 'STAFF', 'Regular staff operations', true, false),
  ('User', 'USER', 'Basic read access', true, false);

INSERT INTO public.permissions (module, action, code, description) VALUES
  ('Products','VIEW','PRODUCT_VIEW','View products'),
  ('Products','ADD','PRODUCT_ADD','Add products'),
  ('Products','UPDATE','PRODUCT_UPDATE','Update products'),
  ('Products','DELETE','PRODUCT_DELETE','Delete products'),
  ('Products','DOWNLOAD','PRODUCT_DOWNLOAD','Download product data'),
  ('Products','IMPORT','PRODUCT_IMPORT','Import products'),
  ('Products','EXPORT','PRODUCT_EXPORT','Export products'),
  ('Images','VIEW','IMAGE_VIEW','View images'),
  ('Images','ADD','IMAGE_ADD','Upload images'),
  ('Images','UPDATE','IMAGE_UPDATE','Update images'),
  ('Images','DELETE','IMAGE_DELETE','Delete images'),
  ('Images','DOWNLOAD','IMAGE_DOWNLOAD','Download images'),
  ('Images','IMPORT','IMAGE_IMPORT','Import images'),
  ('Images','EXPORT','IMAGE_EXPORT','Export images'),
  ('Estimates','VIEW','ESTIMATE_VIEW','View estimates'),
  ('Estimates','ADD','ESTIMATE_ADD','Add estimates'),
  ('Estimates','UPDATE','ESTIMATE_UPDATE','Update estimates'),
  ('Estimates','DELETE','ESTIMATE_DELETE','Delete estimates'),
  ('Estimates','APPROVE','ESTIMATE_APPROVE','Approve estimates'),
  ('Estimates','EXPORT','ESTIMATE_EXPORT','Export estimates'),
  ('Findings','VIEW','FINDING_VIEW','View findings'),
  ('Findings','ADD','FINDING_ADD','Add findings'),
  ('Findings','UPDATE','FINDING_UPDATE','Update findings'),
  ('Findings','DELETE','FINDING_DELETE','Delete findings'),
  ('Findings','APPROVE','FINDING_APPROVE','Approve findings'),
  ('Users','VIEW','USER_VIEW','View users'),
  ('Users','ADD','USER_ADD','Add users'),
  ('Users','UPDATE','USER_UPDATE','Update users'),
  ('Users','DELETE','USER_DELETE','Delete users'),
  ('Users','APPROVE','USER_APPROVE','Approve registrations'),
  ('Users','MANAGE_ROLES','USER_MANAGE_ROLES','Manage user roles'),
  ('Users','MANAGE_PERMISSIONS','USER_MANAGE_PERMISSIONS','Manage user permissions'),
  ('Users','RESET_PASSWORD','USER_RESET_PASSWORD','Reset user passwords'),
  ('Audit','VIEW','AUDIT_VIEW','View audit logs'),
  ('Audit','EXPORT','AUDIT_EXPORT','Export audit logs'),
  ('Settings','VIEW','SETTINGS_VIEW','View settings'),
  ('Settings','UPDATE','SETTINGS_UPDATE','Update settings');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.code = 'ADMIN' AND p.module IN ('Products','Images','Estimates','Findings','Settings')
   OR (r.code = 'ADMIN' AND p.code IN ('AUDIT_VIEW','AUDIT_EXPORT'));

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.code = 'MANAGER' AND p.code IN (
  'PRODUCT_VIEW','PRODUCT_ADD','PRODUCT_UPDATE','PRODUCT_DOWNLOAD','PRODUCT_EXPORT',
  'IMAGE_VIEW','IMAGE_ADD','IMAGE_UPDATE','IMAGE_DOWNLOAD','IMAGE_EXPORT',
  'ESTIMATE_VIEW','ESTIMATE_ADD','ESTIMATE_UPDATE','ESTIMATE_APPROVE','ESTIMATE_EXPORT',
  'FINDING_VIEW','FINDING_ADD','FINDING_UPDATE','FINDING_APPROVE','SETTINGS_VIEW');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.code = 'STAFF' AND p.code IN (
  'PRODUCT_VIEW','PRODUCT_ADD','PRODUCT_UPDATE','IMAGE_VIEW','IMAGE_ADD','IMAGE_UPDATE',
  'ESTIMATE_VIEW','ESTIMATE_ADD','ESTIMATE_UPDATE','FINDING_VIEW','FINDING_ADD','FINDING_UPDATE','SETTINGS_VIEW');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.code = 'USER' AND p.code IN ('PRODUCT_VIEW','IMAGE_VIEW','ESTIMATE_VIEW','FINDING_VIEW','SETTINGS_VIEW');