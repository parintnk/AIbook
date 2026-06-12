-- Story 1.4 — Creator profile (AI Stack scaffold).
-- profiles (1:1 with auth.users) + ai_stack_items + profile_badges,
-- RLS (public-read / owner-write), auto-create trigger on signup, backfill.
-- [Source: architecture.md#Data-Model, #RLS-posture; Context7 /supabase/supabase handle_new_user]

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- lowercase handle; case-insensitivity guaranteed by always-lowercasing
  -- (app + trigger) rather than citext, to keep the security-definer trigger
  -- simple under search_path = ''.
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  bio text,
  avatar_url text,
  hire_me_url text,
  hire_me_visible boolean not null default false,
  -- FK to public.professions added in Story 1.5 (table doesn't exist yet).
  primary_profession_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_stack_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tool_name text not null check (char_length(tool_name) between 1 and 40),
  skill_level smallint not null check (skill_level between 1 and 5),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_stack_items_profile_sort_idx
  on public.ai_stack_items (profile_id, sort_order);

create table if not exists public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_type text not null,
  awarded_at timestamptz not null default now()
);

create index if not exists profile_badges_profile_idx
  on public.profile_badges (profile_id);

-- ── updated_at maintenance ────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────
-- Public-readable everywhere; owner-writable. (select auth.uid()) is wrapped
-- so the planner caches it per-statement (Supabase RLS perf guidance).

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- No client insert policy: rows are created by the trigger (security definer)
-- and the backfill. No client delete: cascades from auth.users.

alter table public.ai_stack_items enable row level security;

create policy "ai_stack_select_all" on public.ai_stack_items
  for select using (true);

create policy "ai_stack_modify_own" on public.ai_stack_items
  for all using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

alter table public.profile_badges enable row level security;

create policy "profile_badges_select_all" on public.profile_badges
  for select using (true);
-- Badges are derived/awarded server-side (service_role bypasses RLS); no
-- client write policy.

-- ── Unique-handle generator ───────────────────────────────────────────────

create or replace function public.generate_unique_handle(seed text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  i int := 0;
begin
  base := lower(coalesce(seed, ''));
  base := regexp_replace(base, '[^a-z0-9_]+', '', 'g');
  if char_length(base) < 3 then
    base := 'user' || base;
  end if;
  base := substr(base, 1, 24);
  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    i := i + 1;
    candidate := substr(base, 1, 24) || '_'
      || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    if i > 50 then
      candidate := 'user_'
        || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

-- ── Auto-create profile on signup ─────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_handle text;
begin
  new_handle := public.generate_unique_handle(
    coalesce(
      split_part(new.email, '@', 1),
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    new_handle,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- These helpers are invoked by the trigger as the definer; they must NOT be
-- directly callable via the PostgREST RPC endpoint (/rest/v1/rpc/...).
revoke execute on function public.generate_unique_handle(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── Backfill existing users (trigger only fires on future inserts) ─────────

do $$
declare
  r record;
  h text;
begin
  for r in select id, email, raw_user_meta_data from auth.users loop
    if not exists (select 1 from public.profiles where id = r.id) then
      h := public.generate_unique_handle(
        coalesce(split_part(r.email, '@', 1), r.raw_user_meta_data ->> 'full_name')
      );
      insert into public.profiles (id, handle, display_name, avatar_url)
      values (
        r.id,
        h,
        coalesce(r.raw_user_meta_data ->> 'full_name', r.raw_user_meta_data ->> 'name'),
        coalesce(r.raw_user_meta_data ->> 'avatar_url', r.raw_user_meta_data ->> 'picture')
      )
      on conflict (id) do nothing;
    end if;
  end loop;
end $$;
