-- Account lifecycle — self-service account deletion (owner flow).
--
-- ⚠️ SECURITY DEFINER, owned by the migration role (postgres), so it may delete from the
-- protected `auth.users` table — which `authenticated` cannot touch directly. It deletes
-- ONLY the caller's own row (`id = auth.uid()`); an anon caller (auth.uid() is null) matches
-- nothing, and execute is revoked from public/anon anyway. Deleting the auth user cascades
-- the whole graph: auth.users → public.profiles (on delete cascade) → workflows / comments /
-- follows / ai_stack / boards / votes (each author/owner FK is on delete cascade), and any
-- fork's parent_id is on-delete-set-null so others' forks survive detached.
--
-- ponytail: does NOT purge the user's Storage objects (avatars, node-output images) — those
-- aren't FK'd to profiles. Orphaned private objects are unreferenced and harmless for v1; add
-- a storage sweep (edge function / scheduled job) if/when it matters.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
