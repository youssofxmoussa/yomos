
DO $$
DECLARE
  _admin_id uuid;
  _student_id uuid;
BEGIN
  -- ADMIN
  SELECT id INTO _admin_id FROM auth.users WHERE email = 'admin@yomo.dev';
  IF _admin_id IS NULL THEN
    _admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      _admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin@yomo.dev', crypt('Admin123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"مدير المنصة"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _admin_id,
      jsonb_build_object('sub', _admin_id::text, 'email', 'admin@yomo.dev'),
      'email', _admin_id::text, now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, full_name) VALUES (_admin_id, 'مدير المنصة')
    ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id = _admin_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_admin_id, 'admin');

  -- STUDENT
  SELECT id INTO _student_id FROM auth.users WHERE email = 'student@yomo.dev';
  IF _student_id IS NULL THEN
    _student_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      _student_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student@yomo.dev', crypt('Student123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"طالب تجريبي"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _student_id,
      jsonb_build_object('sub', _student_id::text, 'email', 'student@yomo.dev'),
      'email', _student_id::text, now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, full_name) VALUES (_student_id, 'طالب تجريبي')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_student_id, 'student')
    ON CONFLICT DO NOTHING;

  -- ACTIVATION CARD (activated for the student)
  INSERT INTO public.activation_cards (code, status, created_by, activated_by, activated_at, expires_at)
  VALUES ('YOMO-DEMO-CARD-2026', 'active', _admin_id, _student_id, now(), now() + interval '10 months')
  ON CONFLICT (code) DO UPDATE SET
    status = 'active', activated_by = EXCLUDED.activated_by,
    activated_at = now(), expires_at = now() + interval '10 months';
END $$;
