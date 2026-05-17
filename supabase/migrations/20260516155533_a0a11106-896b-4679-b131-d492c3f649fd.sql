
DROP FUNCTION IF EXISTS public.promote_to_admin(uuid, uuid);
CREATE OR REPLACE FUNCTION public.promote_to_admin(_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.promote_to_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.demote_from_admin(uuid, uuid);
CREATE OR REPLACE FUNCTION public.demote_from_admin(_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_demote_self'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin'::public.app_role;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.demote_from_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demote_from_admin(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.generate_cards(integer, uuid);
CREATE OR REPLACE FUNCTION public.generate_cards(_count integer)
RETURNS SETOF public.activation_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i integer; _code text; _row public.activation_cards%ROWTYPE; _admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR i IN 1.._count LOOP
    _code := 'YOMO-' || upper(
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4)
    );
    INSERT INTO public.activation_cards (code, created_by) VALUES (_code, _admin) RETURNING * INTO _row;
    RETURN NEXT _row;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.generate_cards(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_cards(integer) TO authenticated;

DROP FUNCTION IF EXISTS public.terminate_session(uuid, uuid);
CREATE OR REPLACE FUNCTION public.terminate_session(_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_sessions SET is_active = false, ended_at = now() WHERE id = _session_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.terminate_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terminate_session(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.activate_card(text, uuid);
CREATE OR REPLACE FUNCTION public.activate_card(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _card public.activation_cards%ROWTYPE;
  _existing_active integer;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;
  SELECT count(*) INTO _existing_active FROM public.activation_cards
   WHERE activated_by = _uid AND status = 'active' AND (expires_at IS NULL OR expires_at > now());
  IF _existing_active > 0 THEN
    RETURN jsonb_build_object('ok', true, 'message', 'already_active');
  END IF;
  SELECT * INTO _card FROM public.activation_cards WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF _card.status <> 'unused' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_used'); END IF;
  UPDATE public.activation_cards
    SET status = 'active', activated_by = _uid, activated_at = now(),
        expires_at = now() + interval '10 months'
    WHERE id = _card.id;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.activate_card(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_card(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_card_available(_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.activation_cards WHERE code = _code AND status = 'unused');
$$;
REVOKE ALL ON FUNCTION public.check_card_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_card_available(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anon can read unused cards" ON public.activation_cards;

DROP POLICY IF EXISTS "View lessons of viewable courses" ON public.lessons;
CREATE POLICY "View lessons of enrolled courses" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = lessons.course_id
      AND (
        c.instructor_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id AND e.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Admin update enrollments" ON public.enrollments;
CREATE POLICY "Admin update enrollments" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.user_has_valid_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_valid_card(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO authenticated;
