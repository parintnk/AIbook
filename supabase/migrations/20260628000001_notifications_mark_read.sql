-- Story 9.3 — mark-read. The bell's ONLY client write to notifications. Story 9.2 created the table
-- with `revoke insert, update, delete … from anon, authenticated` (writes are trigger-only). Tapping a
-- notification (or "mark all read") sets `read_at`; re-grant UPDATE on the read_at COLUMN ONLY, gated by
-- a recipient-scoped policy — a user may flip read_at on their OWN rows and write no other column.
-- `(select auth.uid())` wrapped → no auth_rls_initplan advisor. INSERT/DELETE stay revoked (trigger-only).
-- [Source: 20260626000001_follows.sql (column-lock grant + owner-scoped policy template);
--  20260627000001_notifications.sql:46-49 (notifications_select_own + the revoke this re-grants against)]

grant update (read_at) on public.notifications to authenticated;

create policy "notifications_update_own" on public.notifications
  for update using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
