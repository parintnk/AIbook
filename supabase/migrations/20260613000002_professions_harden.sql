-- Story 1.5 code-review patches (P1–P4).

-- P1: member_count trigger now also handles UPDATE (a member moved between
-- professions via service_role / future mod tooling) — keeps both counts right.
create or replace function public.sync_member_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.professions set member_count = member_count + 1 where id = new.profession_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.professions set member_count = greatest(member_count - 1, 0) where id = old.profession_id;
    return old;
  elsif tg_op = 'UPDATE' then
    if new.profession_id is distinct from old.profession_id then
      update public.professions set member_count = greatest(member_count - 1, 0) where id = old.profession_id;
      update public.professions set member_count = member_count + 1 where id = new.profession_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists profession_members_count on public.profession_members;
create trigger profession_members_count
  after insert or update or delete on public.profession_members
  for each row execute procedure public.sync_member_count();

-- P2: integrity + column lock so a moderator's UPDATE (the mod-gated policy) can
-- only edit name/description/rules — not member_count or slug. The definer
-- trigger (owner) still maintains the count.
alter table public.professions drop constraint if exists professions_member_count_nonneg;
alter table public.professions add constraint professions_member_count_nonneg check (member_count >= 0);

revoke update on public.professions from anon, authenticated;
grant update (name, description, rules) on public.professions to authenticated;

-- P4: self-leave only for plain members; moderators/verified_pro can't self-delete
-- (admin / Story 7.3 manages those) — avoids an accidental zero-moderator profession.
drop policy if exists "profession_members_self_leave" on public.profession_members;
create policy "profession_members_self_leave" on public.profession_members
  for delete using ((select auth.uid()) = profile_id and role = 'member');
