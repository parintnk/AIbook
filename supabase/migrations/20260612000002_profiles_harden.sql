-- Story 1.4 code-review patches (P2, P4).

-- P2: resilient profile auto-creation — retry on a handle collision and never
-- let a profile-insert failure abort the auth.users signup transaction.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  seed text;
  dn text;
  av text;
  attempts int := 0;
begin
  seed := coalesce(
    split_part(new.email, '@', 1),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );
  dn := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
  av := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  while attempts < 5 loop
    begin
      insert into public.profiles (id, handle, display_name, avatar_url)
      values (new.id, public.generate_unique_handle(seed), dn, av)
      on conflict (id) do nothing;
      return new;
    exception
      when unique_violation then
        attempts := attempts + 1;  -- handle raced; regenerate + retry
      when others then
        return new;  -- degrade gracefully — auth must not fail on profile insert
    end;
  end loop;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- P4: atomic replace of the caller's AI Stack (single function body = one
-- transaction). security invoker → RLS (ai_stack_modify_own) applies; the caller
-- can only touch their own rows.
create or replace function public.replace_ai_stack(items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.ai_stack_items where profile_id = uid;
  insert into public.ai_stack_items (profile_id, tool_name, skill_level, sort_order)
  select
    uid,
    (e ->> 'tool_name'),
    (e ->> 'skill_level')::smallint,
    (e ->> 'sort_order')::int
  from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as e;
end;
$$;
