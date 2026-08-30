REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_is_active(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_permission_codes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_profile(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_permission_codes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;