
-- Move any teachers to students
UPDATE public.user_roles SET role = 'student' WHERE role = 'teacher';

-- Default new users to student
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'student'::public.app_role)
  on conflict do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Activation cards
CREATE TABLE public.activation_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','active','expired','revoked')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid,
  activated_at timestamptz,
  expires_at timestamptz,
  notes text
);
CREATE INDEX idx_cards_code ON public.activation_cards(code);
CREATE INDEX idx_cards_user ON public.activation_cards(activated_by);
CREATE INDEX idx_cards_status ON public.activation_cards(status);

ALTER TABLE public.activation_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access cards" ON public.activation_cards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own card" ON public.activation_cards
  FOR SELECT TO authenticated
  USING (activated_by = auth.uid());

CREATE POLICY "Anon can read unused cards" ON public.activation_cards
  FOR SELECT TO anon
  USING (status = 'unused');

CREATE OR REPLACE FUNCTION public.activate_card(_code text, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _card public.activation_cards%ROWTYPE;
  _existing_active integer;
BEGIN
  SELECT count(*) INTO _existing_active FROM public.activation_cards
   WHERE activated_by = _user_id AND status = 'active' AND (expires_at IS NULL OR expires_at > now());
  IF _existing_active > 0 THEN
    RETURN jsonb_build_object('ok', true, 'message', 'already_active');
  END IF;

  SELECT * INTO _card FROM public.activation_cards WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF _card.status <> 'unused' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;

  UPDATE public.activation_cards
    SET status = 'active', activated_by = _user_id, activated_at = now(),
        expires_at = now() + interval '10 months'
    WHERE id = _card.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_cards(_count integer, _admin uuid)
RETURNS SETOF public.activation_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  i integer; _code text; _row public.activation_cards%ROWTYPE;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR i IN 1.._count LOOP
    _code := upper(
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4)
    );
    INSERT INTO public.activation_cards (code, created_by) VALUES (_code, _admin) RETURNING * INTO _row;
    RETURN NEXT _row;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_valid_card(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activation_cards
    WHERE activated_by = _user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Sessions
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip text, user_agent text, device_label text,
  is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_sessions_user ON public.user_sessions(user_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all sessions" ON public.user_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "User own sessions select" ON public.user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User own sessions insert" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "User own sessions update" ON public.user_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Activity log
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_user_time ON public.user_activity_log(user_id, created_at DESC);
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all activity" ON public.user_activity_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "User own activity select" ON public.user_activity_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User own activity insert" ON public.user_activity_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Site sections
CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sections" ON public.site_sections
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage sections" ON public.site_sections
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_sections (key, content, display_order) VALUES
  ('hero', '{"badge":"منصة التعليم العربية الفاخرة","title":"تعلّم بطريقتك","title_accent":"في أي وقت وأي مكان","subtitle":"Yomo تجمع أفضل المحتوى التعليمي في تجربة واحدة بسيطة، مصممة بالكامل للطالب العربي."}'::jsonb, 1),
  ('stats', '{"items":[{"value":"+1000","label":"درس مصور"},{"value":"+15K","label":"طالب نشط"},{"value":"+2M","label":"ساعة مشاهدة"},{"value":"98%","label":"رضا المستخدمين"}]}'::jsonb, 2),
  ('features', '{"title":"كل ما تحتاجه للتفوق","items":[{"icon":"PlayCircle","title":"فيديوهات عالية الجودة","desc":"محاضرات مصممة بعناية لكل مادة."},{"icon":"BookOpen","title":"تمارين تفاعلية","desc":"تدريبات لتقييم فهمك وتطوير مهاراتك."},{"icon":"GraduationCap","title":"محتوى منهجي","desc":"دروس متدرجة تناسب كل المستويات."},{"icon":"Users","title":"تجربة شخصية","desc":"تعلم بإيقاعك الخاص دون ضغط."}]}'::jsonb, 3),
  ('cta', '{"title":"ابدأ رحلتك التعليمية اليوم","subtitle":"احصل على بطاقة التفعيل من إدارة المنصة وانضم إلينا.","button_text":"إنشاء حساب"}'::jsonb, 4);

-- Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read announcements" ON public.announcements
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Courses: admin only manage
DROP POLICY IF EXISTS "Teachers create own courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers delete own courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers update own courses" ON public.courses;
CREATE POLICY "Admin manage courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Terminate session
CREATE OR REPLACE FUNCTION public.terminate_session(_session_id uuid, _admin uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_sessions SET is_active = false, ended_at = now() WHERE id = _session_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_cards()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.activation_cards SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now()
    RETURNING 1
  ) SELECT count(*)::int FROM updated;
$$;
