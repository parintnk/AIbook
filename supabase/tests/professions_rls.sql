-- Story 1.5 AC#3 verification — mod-gated RLS on professions.
-- Run against the project DB (e.g. Supabase SQL editor or `execute_sql`). It
-- raises an exception on any failure and is a no-op (NOTICE only) on success,
-- so a clean run == the policy + helper behave correctly. Role-switching is
-- required because the service role bypasses RLS.
--
-- Asserts: (1) is_profession_moderator is true for the founder, false for a
-- non-member; (2) the professions UPDATE policy denies a non-moderator (0 rows)
-- and allows a moderator (1 row).

do $$
declare
  founder uuid;
  member uuid;
  gd uuid;
  n int;
begin
  select id into founder from auth.users where email = 'parin.tnk@gmail.com';
  select id into member from auth.users where email = 'grayzoneno.13@gmail.com';
  select id into gd from public.professions where slug = 'graphic-designer';

  if not public.is_profession_moderator(founder, gd) then
    raise exception 'HELPER FAIL: founder should be moderator';
  end if;
  if public.is_profession_moderator(member, gd) then
    raise exception 'HELPER FAIL: member should NOT be moderator';
  end if;

  -- Non-moderator → UPDATE denied (0 rows).
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', member::text, 'role', 'authenticated')::text, true);
  update public.professions set description = description where id = gd;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RLS FAIL: non-moderator updated % rows (expected 0)', n; end if;

  -- Moderator → UPDATE of a granted column (description) allowed (1 row).
  perform set_config('request.jwt.claims', json_build_object('sub', founder::text, 'role', 'authenticated')::text, true);
  update public.professions set description = description where id = gd;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RLS FAIL: moderator updated % rows (expected 1)', n; end if;

  -- Column lock → even a moderator may NOT change member_count.
  begin
    update public.professions set member_count = 999 where id = gd;
    reset role;
    raise exception 'COLUMN-LOCK FAIL: moderator changed member_count';
  exception when insufficient_privilege then
    null;  -- expected: permission denied for column member_count
  end;

  reset role;
  raise notice 'RLS OK: helper correct; member denied; moderator allowed; member_count locked';
end $$;
