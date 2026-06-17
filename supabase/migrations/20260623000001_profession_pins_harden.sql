-- Story 7.3 — Hardening for the role-gated moderator pin UI (FR18 / UX-DR21).
-- Story 7.2 shipped profession_pins with manual (seed) curation; Story 7.3 adds the in-app mod UI
-- (pin / unpin / drag-reorder), which is the FIRST real client write path. This migration closes the
-- write-model gaps the 7.2 code review deferred "to the 7.3 pin UI":
--   1. Narrow the UPDATE grant to `position` only — reorder needs nothing else, and a mod must not be
--      able to silently re-point an existing pin's workflow_id (unpin + re-pin instead). [defer #1]
--   2. CHECK (position >= 0) — the drag-reorder writes a non-negative index. [defer #2]
--   3. A BEFORE INSERT trigger asserting the pinned workflow is PUBLISHED and belongs to the SAME
--      profession — a mod can only pin their own profession's published work. No FK can express the
--      cross-row condition; a SECURITY DEFINER trigger (execute revoked → no advisor WARN) with ONE
--      generic error (no published/profession existence oracle) is the Story 4.3 enforce_report_target
--      pattern. [defer #1, the same-profession/published half]
-- The 3 RLS policies + the insert/delete grants from 20260622000001 are UNCHANGED (still mod-gated via
-- is_profession_moderator). No column type changes → database.types.ts is untouched.
-- [Source: 20260622000001_profession_pins.sql:56-58; 20260619000001 enforce_report_target (4.3);
--  deferred-work.md "code review of story-7.2"; epics.md#Story 7.3]

-- ── 1. Reorder is position-only (drop the workflow_id re-point surface) ──────
revoke update on public.profession_pins from authenticated;
grant update (position) on public.profession_pins to authenticated;

-- ── 2. Positions are non-negative ───────────────────────────────────────────
alter table public.profession_pins
  add constraint profession_pins_position_nonneg check (position >= 0);

-- ── 3. A pin must target a PUBLISHED workflow of the SAME profession ─────────
-- security definer so it can read workflows regardless of the caller; execute revoked from anon +
-- authenticated so it is ONLY reachable via the trigger (trigger-internal → no
-- authenticated_security_definer_function_executable advisor WARN, unlike a callable RPC). ONE generic
-- error message so it can't be used to probe which workflow ids exist / are published (the 4.3 lesson).
create or replace function public.enforce_pin_target()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workflows w
    where w.id = new.workflow_id
      and w.status = 'published'
      and w.profession_id = new.profession_id
  ) then
    raise exception 'Cannot pin this workflow';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_pin_target() from public, anon, authenticated;

create trigger profession_pins_enforce_target
  before insert on public.profession_pins
  for each row execute function public.enforce_pin_target();
