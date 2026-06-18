-- Story 11.1 — AI usage rate-limiting (NFR2 / AR6). The per-user DAILY counter that governs AI cost
-- BEFORE the Skeleton (11.2) and Doctor (11.3) features ship. Provides:
--   (a) an `ai_feature` enum + an `ai_usage(profile_id, feature, day, count)` table (the architecture.md:133
--       shape) — RLS own-row SELECT, NO client write;
--   (b) an ATOMIC, service-role-only `consume_ai_quota` SECURITY DEFINER RPC (a guarded increment) that
--       the rate-limit service calls via the Story 10.1 admin client (passing the session-verified user.id).
-- DECISION (No13, 2026-06-18): AI generation REUSES the 10.1 Gemini stack (NO Vercel AI Gateway, NO
-- Claude) → cost governance is THIS per-user cap, not gateway alerts (a documented AR6 deviation).
-- EXECUTE granted ONLY to service_role (revoked from public/anon/authenticated) → it stays OFF the
-- authenticated_security_definer_function_executable advisor (the 10.2 match_workflows pattern) →
-- advisors stay 4 baseline. `set search_path = ''` → every ref is schema-qualified.
-- [Source: architecture.md:81 (AR6), :133 (ai_usage shape), :25/:47 (NFR2); epics.md#Story-11.1 (879-893);
--  20260627000001_notifications.sql (enum + own-row RLS + revoke idiom);
--  20260630000001_match_workflows.sql (service-role-only definer RPC + revoke/grant)]

-- ── ai_feature enum (the AR6 set, verbatim; idempotent — the notification_type pattern) ──
do $$ begin
  create type public.ai_feature as enum ('skeleton', 'doctor', 'export', 'embed');
exception when duplicate_object then null; end $$;

-- ── ai_usage table — one counter row per (user, feature, UTC day) ──────────────────
create table if not exists public.ai_usage (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  feature public.ai_feature not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (profile_id, feature, day),
  constraint ai_usage_count_nonneg check (count >= 0)
);

-- ── RLS: a user reads ONLY their own usage; NO client write (the consume RPC is the only writer) ──
-- (select auth.uid()) wrapped → no auth_rls_initplan. A SELECT policy + revoked writes = advisor-clean
-- (RLS enabled WITH a policy → no rls_enabled_no_policy). The own-row read powers "used N of M today";
-- every increment goes through the service-role definer RPC below.
alter table public.ai_usage enable row level security;

create policy "ai_usage_select_own" on public.ai_usage
  for select using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- ── consume_ai_quota — the ATOMIC check-and-consume primitive ───────────────────────
-- Returns {allowed, used, quota}. Atomic + race-free (no read-modify-write TOCTOU):
--   1) UPDATE an existing under-cap row (+1) — row-locked, so two concurrent calls serialize and the
--      cap holds exactly; FOUND → allowed.
--   2) else INSERT a fresh count=1 row — first use today; a concurrent insert raises unique_violation,
--      caught → retry the guarded UPDATE (covers the race), else the row is AT the cap → denied.
-- security definer (writes the client-write-locked table) + set search_path='' + service-role-only EXECUTE.
create or replace function public.consume_ai_quota(
  p_profile_id uuid,
  p_feature public.ai_feature,
  p_limit int
) returns table (allowed boolean, used int, quota int)
language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.ai_usage set count = count + 1
    where profile_id = p_profile_id and feature = p_feature and day = current_date
      and count < p_limit
    returning count into v_count;
  if found then
    return query select true, v_count, p_limit;
    return;
  end if;

  begin
    insert into public.ai_usage (profile_id, feature, day, count)
      values (p_profile_id, p_feature, current_date, 1);
    return query select true, 1, p_limit;
    return;
  exception when unique_violation then
    -- the row exists (a concurrent insert, or the at-cap row) → retry the guarded increment.
    update public.ai_usage set count = count + 1
      where profile_id = p_profile_id and feature = p_feature and day = current_date
        and count < p_limit
      returning count into v_count;
    if found then
      return query select true, v_count, p_limit;
      return;
    end if;
    -- still nothing updated → at the cap. Report the current count.
    select au.count into v_count from public.ai_usage au
      where au.profile_id = p_profile_id and au.feature = p_feature and au.day = current_date;
    return query select false, coalesce(v_count, p_limit), p_limit;
    return;
  end;
end;
$$;

-- Service-role-only: the rate-limit service calls this via the 10.1 admin client. Revoke from ALL THREE
-- (the 10.2 lesson — leaving any one trips the definer-executable advisor); only service_role executes.
revoke execute on function public.consume_ai_quota(uuid, public.ai_feature, int)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, public.ai_feature, int)
  to service_role;
