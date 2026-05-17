-- Promote a user to admin (callable by an existing admin only)
CREATE OR REPLACE FUNCTION public.promote_to_admin(_target uuid, _admin uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.demote_from_admin(_target uuid, _admin uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = _admin THEN RAISE EXCEPTION 'cannot_demote_self'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin'::public.app_role;
  RETURN true;
END;
$$;

-- Bootstrap helper: if there is no admin yet, the very first signed-in caller can self-promote.
-- After at least one admin exists, this becomes a no-op.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_admin boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) INTO _has_admin;
  IF _has_admin THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- Lock down execute privileges. The functions are SECURITY DEFINER so they enforce
-- their own admin checks; we still revoke broad EXECUTE from the public role and
-- expose them only to authenticated users.
REVOKE ALL ON FUNCTION public.generate_cards(integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.terminate_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_to_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.demote_from_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_cards(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_from_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;