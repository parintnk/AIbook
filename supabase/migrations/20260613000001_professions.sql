-- Story 1.5 — Professions & per-profession roles.
-- professions (+ seed) + profession_members (role enum, PK, member_count) +
-- profiles.primary_profession_id FK + is_profession_moderator RLS helper + RLS.
-- [Source: architecture.md#Data-Model, #RLS-posture; features-and-vision.md launch list]

-- ── Role enum (idempotent) ────────────────────────────────────────────────
do $$ begin
  create type public.profession_role as enum ('member', 'verified_pro', 'moderator');
exception when duplicate_object then null;
end $$;

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.professions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  rules jsonb not null default '[]'::jsonb,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Seed the launch professions (idempotent). member_count starts at 0 and is
-- maintained by the trigger below as members join.
insert into public.professions (slug, name, description) values
  ('graphic-designer', 'Graphic Designer', 'AI workflows for visual design, branding, and illustration.'),
  ('video-creator',    'Video Creator',    'AI workflows for video production, editing, and motion.'),
  ('web-developer',    'Web Developer',    'AI workflows for building and shipping web apps.'),
  ('content-writer',   'Content Writer',   'AI workflows for writing, editing, and SEO content.'),
  ('marketer',         'Marketer',         'AI workflows for campaigns, ads, social, and growth.'),
  ('ai-automation',    'AI Automation',    'AI workflows for no-code automation and agents (n8n, Make).')
on conflict (slug) do nothing;

create table if not exists public.profession_members (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  profession_id uuid not null references public.professions (id) on delete cascade,
  role public.profession_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (profile_id, profession_id)
);

create index if not exists profession_members_prof_role_idx
  on public.profession_members (profession_id, role);

-- ── FK deferred from Story 1.4 ────────────────────────────────────────────
-- profiles.primary_profession_id already exists (nullable uuid, no FK). Add it.
alter table public.profiles drop constraint if exists profiles_primary_profession_fk;
alter table public.profiles
  add constraint profiles_primary_profession_fk
  foreign key (primary_profession_id) references public.professions (id)
  on delete set null;

-- ── member_count maintenance ──────────────────────────────────────────────
-- security definer so a self-joining member (who is NOT a moderator) can still
-- bump the count despite the moderator-only UPDATE policy on professions.
create or replace function public.sync_member_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.professions set member_count = member_count + 1
    where id = new.profession_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.professions set member_count = greatest(member_count - 1, 0)
    where id = old.profession_id;
    return old;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_member_count() from public, anon, authenticated;

drop trigger if exists profession_members_count on public.profession_members;
create trigger profession_members_count
  after insert or delete on public.profession_members
  for each row execute procedure public.sync_member_count();

-- ── Moderator check (reused by later epics' mod-action policies) ───────────
-- security invoker + stable: reads profession_members (public-select), so no
-- recursion and no definer needed. Returns a boolean membership fact.
create or replace function public.is_profession_moderator(uid uuid, prof_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.profession_members m
    where m.profile_id = uid
      and m.profession_id = prof_id
      and m.role = 'moderator'
  );
$$;

-- ── Row Level Security ────────────────────────────────────────────────────
alter table public.professions enable row level security;

create policy "professions_select_all" on public.professions
  for select using (true);
-- Only a moderator of THAT profession may edit it (e.g. its rules). The concrete
-- mod-gated capability that proves the AR5 pattern. No client insert/delete
-- (professions are seeded / platform-admin only).
create policy "professions_update_moderator" on public.professions
  for update using (public.is_profession_moderator((select auth.uid()), id))
  with check (public.is_profession_moderator((select auth.uid()), id));

alter table public.profession_members enable row level security;

create policy "profession_members_select_all" on public.profession_members
  for select using (true);
-- Self-join only, and only as 'member' — no self-promotion to moderator/verified_pro.
create policy "profession_members_self_join" on public.profession_members
  for insert with check ((select auth.uid()) = profile_id and role = 'member');
-- Self-leave.
create policy "profession_members_self_leave" on public.profession_members
  for delete using ((select auth.uid()) = profile_id);
-- No UPDATE policy → role changes (promotion/verification) are service_role only
-- (moderator tooling is Story 7.3).

-- ── Seed: founder is moderator of every profession ────────────────────────
do $$
declare
  founder_id uuid;
begin
  -- Resolve from profiles (the FK target) joined to auth.users by email, so a
  -- missing profiles row skips the seed instead of raising a FK violation that
  -- would abort the whole migration.
  select p.id into founder_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'parin.tnk@gmail.com'
  limit 1;
  if founder_id is not null then
    insert into public.profession_members (profile_id, profession_id, role)
    select founder_id, p.id, 'moderator'::public.profession_role
    from public.professions p
    on conflict (profile_id, profession_id) do nothing;
  end if;
end $$;
