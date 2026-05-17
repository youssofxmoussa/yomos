
-- 1. profiles: add short_id and is_suspended
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS short_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- function to generate short_id
CREATE OR REPLACE FUNCTION public.gen_short_id()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  candidate text;
  exists_already boolean;
BEGIN
  LOOP
    candidate := 'YOMO-USR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE short_id = candidate) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN candidate;
END $$;

-- backfill existing
UPDATE public.profiles SET short_id = public.gen_short_id() WHERE short_id IS NULL;

-- update handle_new_user trigger to set short_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, short_id)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), public.gen_short_id());
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'student'::public.app_role)
    ON CONFLICT DO NOTHING;
  RETURN new;
END $$;

-- ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. user_sessions: enriched device fields
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS device_brand text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS os_name text,
  ADD COLUMN IF NOT EXISTS os_version text,
  ADD COLUMN IF NOT EXISTS browser_name text;

-- 3. auth_attempts table
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_attempts_email_time_idx ON public.auth_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempts_ip_time_idx ON public.auth_attempts (ip, created_at DESC);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view auth attempts" ON public.auth_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_suspend_user(_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_suspend_self'; END IF;
  UPDATE public.profiles SET is_suspended = true WHERE id = _target;
  UPDATE public.user_sessions SET is_active = false, ended_at = now()
    WHERE user_id = _target AND is_active = true;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET is_suspended = false WHERE id = _target;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_extend_card_expiry(_card_id uuid, _months integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.activation_cards
    SET expires_at = COALESCE(expires_at, now()) + (_months || ' months')::interval,
        status = CASE WHEN status = 'expired' THEN 'active' ELSE status END
    WHERE id = _card_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_card(_card_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.activation_cards SET status = 'expired', expires_at = now() WHERE id = _card_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_force_logout_user(_target uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH updated AS (
    UPDATE public.user_sessions SET is_active = false, ended_at = now()
    WHERE user_id = _target AND is_active = true RETURNING 1
  ) SELECT count(*)::int INTO _count FROM updated;
  RETURN _count;
END $$;

-- 5. Analytics RPCs
CREATE OR REPLACE FUNCTION public.get_daily_login_stats(_days integer DEFAULT 30)
RETURNS TABLE (day date, logins bigint, unique_users bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    count(*)::bigint AS logins,
    count(DISTINCT user_id)::bigint AS unique_users
  FROM public.user_activity_log
  WHERE event_type = 'login'
    AND created_at >= now() - (_days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY 1 ORDER BY 1 ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_user_activity_summary()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  short_id text,
  total_logins bigint,
  last_login timestamptz,
  active_sessions bigint,
  is_suspended boolean,
  last_device text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id AS user_id,
    p.full_name,
    p.short_id,
    COALESCE((SELECT count(*) FROM public.user_activity_log al WHERE al.user_id = p.id AND al.event_type = 'login'), 0)::bigint AS total_logins,
    (SELECT max(created_at) FROM public.user_activity_log al WHERE al.user_id = p.id AND al.event_type = 'login') AS last_login,
    COALESCE((SELECT count(*) FROM public.user_sessions s WHERE s.user_id = p.id AND s.is_active = true), 0)::bigint AS active_sessions,
    p.is_suspended,
    (SELECT device_label FROM public.user_sessions s WHERE s.user_id = p.id ORDER BY started_at DESC LIMIT 1) AS last_device
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_device_distribution()
RETURNS TABLE (device_brand text, os_name text, count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(device_brand, 'Unknown') AS device_brand,
    COALESCE(os_name, 'Unknown') AS os_name,
    count(*)::bigint AS count
  FROM public.user_sessions
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY 1, 2 ORDER BY 3 DESC;
$$;
