-- Notification preferences (Settings → Notifications) — let a user mute notification types.
--
-- Opt-OUT model: a `notification_prefs` jsonb on profiles maps a notification_type → bool; a missing
-- key means "on" (the default, so existing users keep every notification). The single writer
-- `create_notification` checks it and skips the insert for a muted type — ONE choke point gates all
-- 7 per-event triggers. profiles_update_own RLS already lets a user write their own row (no column
-- lock), so the settings form updates this column directly; no new grant needed.

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

create or replace function public.create_notification(
  p_recipient uuid,
  p_type public.notification_type,
  p_actor uuid,
  p_target_type text,
  p_target_id uuid,
  p_data jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- no notification for: a missing recipient, a system/seed row with no actor, or your OWN action.
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  -- ...or a type the recipient has muted (missing key = on, so existing users are unaffected).
  if coalesce(
       (select (notification_prefs ->> p_type::text)::boolean
          from public.profiles where id = p_recipient),
       true) is false then
    return;
  end if;
  insert into public.notifications (recipient_id, type, actor_id, target_type, target_id, data)
  values (p_recipient, p_type, p_actor, p_target_type, p_target_id, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke execute on function public.create_notification(uuid, public.notification_type, uuid, text, uuid, jsonb)
  from public, anon, authenticated;
