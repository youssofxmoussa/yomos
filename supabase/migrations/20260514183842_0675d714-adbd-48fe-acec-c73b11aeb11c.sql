
-- Enums
create type public.app_role as enum ('admin', 'teacher', 'student');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by all auth"
  on public.profiles for select to authenticated using (true);
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "Users view own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles"
  on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject text,
  grade text,
  price numeric(10,2) not null default 0,
  instructor_id uuid not null references auth.users(id) on delete cascade,
  cover_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.courses enable row level security;

create policy "Anyone can view published courses"
  on public.courses for select using (published = true or instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Teachers create own courses"
  on public.courses for insert to authenticated with check (instructor_id = auth.uid() and (public.has_role(auth.uid(), 'teacher') or public.has_role(auth.uid(), 'admin')));
create policy "Teachers update own courses"
  on public.courses for update to authenticated using (instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Teachers delete own courses"
  on public.courses for delete to authenticated using (instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  order_num int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.lessons enable row level security;

create policy "View lessons of viewable courses"
  on public.lessons for select using (
    exists (select 1 from public.courses c where c.id = course_id and (c.published = true or c.instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );
create policy "Teachers manage own lessons"
  on public.lessons for all to authenticated using (
    exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  ) with check (
    exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );

-- Enrollments
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
alter table public.enrollments enable row level security;

create policy "Users view own enrollments"
  on public.enrollments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin') or exists(select 1 from public.courses c where c.id = course_id and c.instructor_id = auth.uid()));
create policy "Users enroll themselves"
  on public.enrollments for insert to authenticated with check (user_id = auth.uid());
create policy "Users delete own enrollment"
  on public.enrollments for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup with role from raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  _role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'student'::public.app_role);
  insert into public.user_roles (user_id, role) values (new.id, _role)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
