-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'teacher');
CREATE TYPE public.card_status AS ENUM ('active', 'used', 'revoked', 'expired');

-- =========== TIMESTAMP HELPER ===========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  short_id TEXT UNIQUE,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== USER_ROLES ===========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- =========== ACTIVATION CARDS ===========
CREATE TABLE public.activation_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status public.card_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.activation_cards ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_cards_status ON public.activation_cards(status);
CREATE INDEX idx_cards_activated_by ON public.activation_cards(activated_by);

-- =========== USER SESSIONS ===========
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent TEXT,
  device_label TEXT,
  device_brand TEXT,
  device_model TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_sessions_active ON public.user_sessions(is_active);

-- =========== USER ACTIVITY LOG ===========
CREATE TABLE public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activity_user ON public.user_activity_log(user_id);
CREATE INDEX idx_activity_created ON public.user_activity_log(created_at DESC);

-- =========== AUTH ATTEMPTS ===========
CREATE TABLE public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  reason TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_auth_attempts_email ON public.auth_attempts(email, created_at DESC);

-- =========== COURSES ===========
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== LESSONS ===========
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  order_num INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lessons_course ON public.lessons(course_id, order_num);

-- =========== ENROLLMENTS ===========
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- =========== ANNOUNCEMENTS ===========
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- =========== SITE SECTIONS ===========
CREATE TABLE public.site_sections (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_site_sections_updated BEFORE UPDATE ON public.site_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_sections;

-- =========== RLS POLICIES ===========

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles admin read" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles admin update" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "roles admin read" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- activation_cards: admin sees all, student sees own
CREATE POLICY "cards admin all" ON public.activation_cards FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cards self read" ON public.activation_cards FOR SELECT USING (activated_by = auth.uid());

-- user_sessions
CREATE POLICY "sessions self read" ON public.user_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sessions self insert" ON public.user_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions self update" ON public.user_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "sessions admin all" ON public.user_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_activity_log
CREATE POLICY "activity self insert" ON public.user_activity_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "activity admin read" ON public.user_activity_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "activity self read" ON public.user_activity_log FOR SELECT USING (user_id = auth.uid());

-- auth_attempts (anyone can insert during login, only admin reads)
CREATE POLICY "attempts public insert" ON public.auth_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "attempts admin read" ON public.auth_attempts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- courses (public read, admin write)
CREATE POLICY "courses public read" ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses admin write" ON public.courses FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- lessons (public read, admin write)
CREATE POLICY "lessons public read" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "lessons admin write" ON public.lessons FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- enrollments
CREATE POLICY "enroll self read" ON public.enrollments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "enroll self insert" ON public.enrollments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "enroll self delete" ON public.enrollments FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "enroll admin all" ON public.enrollments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- announcements (public read active, admin write)
CREATE POLICY "ann public read" ON public.announcements FOR SELECT USING (active = true);
CREATE POLICY "ann admin all" ON public.announcements FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- site_sections (public read, admin write)
CREATE POLICY "site public read" ON public.site_sections FOR SELECT USING (true);
CREATE POLICY "site admin write" ON public.site_sections FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========== TRIGGER: auto-create profile on signup ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, short_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 8))
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== RPC: user_has_valid_card ===========
CREATE OR REPLACE FUNCTION public.user_has_valid_card(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activation_cards
    WHERE activated_by = _user_id
      AND status IN ('active','used')
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- =========== RPC: check_card_available ===========
CREATE OR REPLACE FUNCTION public.check_card_available(_code TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.activation_cards
    WHERE code = _code AND status = 'active' AND activated_by IS NULL
  )
$$;

-- =========== RPC: activate_card ===========
CREATE OR REPLACE FUNCTION public.activate_card(_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.activation_cards
  SET status = 'used',
      activated_by = _uid,
      activated_at = now(),
      expires_at = now() + interval '10 months'
  WHERE code = _code AND status = 'active' AND activated_by IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not available'; END IF;
END;
$$;

-- =========== RPC: generate_cards (admin only) ===========
CREATE OR REPLACE FUNCTION public.generate_cards(_count INT)
RETURNS SETOF public.activation_cards LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i INT; new_code TEXT; new_row public.activation_cards%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _count < 1 OR _count > 500 THEN RAISE EXCEPTION 'invalid count'; END IF;
  FOR i IN 1.._count LOOP
    LOOP
      new_code := UPPER(
        SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4) || '-' ||
        SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4) || '-' ||
        SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4) || '-' ||
        SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4)
      );
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.activation_cards WHERE code = new_code);
    END LOOP;
    INSERT INTO public.activation_cards (code, status) VALUES (new_code, 'active') RETURNING * INTO new_row;
    RETURN NEXT new_row;
  END LOOP;
END;
$$;

-- =========== RPC: promote / demote admin ===========
CREATE OR REPLACE FUNCTION public.promote_to_admin(_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin') ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.demote_from_admin(_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot demote self'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
END; $$;

-- =========== RPC: suspend/unsuspend/delete users ===========
CREATE OR REPLACE FUNCTION public.admin_suspend_user(_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET is_suspended = true WHERE id = _target;
  UPDATE public.user_sessions SET is_active = false, ended_at = now() WHERE user_id = _target AND is_active = true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET is_suspended = false WHERE id = _target;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot delete self'; END IF;
  DELETE FROM auth.users WHERE id = _target;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_force_logout_user(_target UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_sessions SET is_active = false, ended_at = now()
  WHERE user_id = _target AND is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.terminate_session(_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_sessions SET is_active = false, ended_at = now() WHERE id = _session_id;
END; $$;

-- =========== SEED: site_sections ===========
INSERT INTO public.site_sections (key, content, display_order) VALUES
('hero', jsonb_build_object(
  'badge', 'منصة Yomo التعليمية',
  'title', 'تعلّم بأسلوب يليق بك',
  'subtitle', 'منصة عربية فاخرة للدورات والدروس التفاعلية مع متابعة شخصية.',
  'ctaPrimary', 'ابدأ الآن',
  'ctaSecondary', 'استكشف الدورات'
), 1),
('stats', jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('label','طالب نشط','value','5,000+'),
  jsonb_build_object('label','دورة','value','120+'),
  jsonb_build_object('label','معدّل الرضا','value','98%'),
  jsonb_build_object('label','مدرّس خبير','value','40+')
)), 2),
('features', jsonb_build_object(
  'title', 'لماذا Yomo؟',
  'items', jsonb_build_array(
    jsonb_build_object('icon','PlayCircle','title','دروس فيديو','desc','جودة عالية وتفاعل مباشر'),
    jsonb_build_object('icon','BookOpen','title','مناهج متكاملة','desc','محتوى متوافق مع المنهاج'),
    jsonb_build_object('icon','GraduationCap','title','شهادات','desc','شهادة إتمام لكل دورة'),
    jsonb_build_object('icon','Users','title','مجتمع','desc','تواصل مع زملائك ومعلميك')
  )
), 3),
('cta', jsonb_build_object(
  'title', 'جاهز للبدء؟',
  'subtitle', 'فعّل بطاقتك وانطلق فوراً',
  'button', 'إنشاء حساب'
), 4);