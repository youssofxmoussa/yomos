
-- Restrict has_role execution
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Seed demo users
do $$
declare
  admin_id uuid := '11111111-1111-1111-1111-111111111111';
  teacher_id uuid := '22222222-2222-2222-2222-222222222222';
  student_id uuid := '33333333-3333-3333-3333-333333333333';
  course1_id uuid := gen_random_uuid();
  course2_id uuid := gen_random_uuid();
begin
  -- Admin
  if not exists (select 1 from auth.users where id = admin_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'admin@yomo.dev', crypt('Admin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Yomo Admin","role":"admin"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), admin_id, admin_id::text, format('{"sub":"%s","email":"%s"}', admin_id, 'admin@yomo.dev')::jsonb, 'email', now(), now(), now());
  end if;

  -- Teacher
  if not exists (select 1 from auth.users where id = teacher_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', teacher_id, 'authenticated', 'authenticated', 'teacher@yomo.dev', crypt('Teacher123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"الأستاذ سامي","role":"teacher"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), teacher_id, teacher_id::text, format('{"sub":"%s","email":"%s"}', teacher_id, 'teacher@yomo.dev')::jsonb, 'email', now(), now(), now());
  end if;

  -- Student
  if not exists (select 1 from auth.users where id = student_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', student_id, 'authenticated', 'authenticated', 'student@yomo.dev', crypt('Student123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"الطالب علي","role":"student"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), student_id, student_id::text, format('{"sub":"%s","email":"%s"}', student_id, 'student@yomo.dev')::jsonb, 'email', now(), now(), now());
  end if;

  -- Sample courses by teacher
  if not exists (select 1 from public.courses where instructor_id = teacher_id) then
    insert into public.courses (id, title, description, subject, grade, price, instructor_id, published)
    values
      (course1_id, 'الرياضيات للصف الثانوي', 'دورة شاملة في الجبر والهندسة والتفاضل والتكامل.', 'رياضيات', 'الثانوي', 65, teacher_id, true),
      (course2_id, 'الفيزياء التفاعلية', 'مفاهيم الفيزياء مع تجارب وفيديوهات تفاعلية.', 'فيزياء', 'الثانوي', 60, teacher_id, true);

    insert into public.lessons (course_id, title, content, order_num) values
      (course1_id, 'مقدمة في الجبر', 'أساسيات المتغيرات والمعادلات.', 1),
      (course1_id, 'الهندسة المستوية', 'المثلثات والدوائر والزوايا.', 2),
      (course1_id, 'التفاضل', 'مفهوم المشتقة وتطبيقاتها.', 3),
      (course2_id, 'قوانين نيوتن', 'الحركة والقوة.', 1),
      (course2_id, 'الكهرباء', 'الدوائر الكهربائية البسيطة.', 2);
  end if;
end $$;
