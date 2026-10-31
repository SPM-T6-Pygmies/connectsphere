-- SPM-69: when an event is rescheduled or cancelled, every Attendee holding a
-- Registered registration is emailed. That needs the attendee list, which no
-- function has returned until now: registration holds names and emails, which
-- brief s8b classes as protected, and anon has no grant on the table.
--
-- coordinator_event_registrants(p_event_id) returns the event's Registered rows,
-- in the same shape as attendee_registration, but only to the event's assigned
-- coordinator. It takes no caller-supplied account id: it checks auth.uid()
-- itself, and anon cannot call it at all. A withdrawn registration is left out.

begin;

create function public.coordinator_event_registrants(p_event_id bigint)
returns table (
  registration_reference uuid,
  event_id bigint,
  attendee_name text,
  attendee_email text,
  status text,
  registered_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select r.registration_reference, r.event_id, r.attendee_name,
         r.attendee_email, r.status, r.created_at
  from public.registration r
  join public.event e on e.event_id = r.event_id
  join public.user_account ua on ua.user_account_id = e.assigned_coordinator_user_account_id
  where r.event_id = p_event_id
    and r.status = 'Registered'
    and r.attendee_email is not null
    and auth.uid() is not null
    and ua.auth_user_id = auth.uid()
  order by r.created_at, r.registration_id;
$$;

revoke execute on function public.coordinator_event_registrants(bigint) from public, anon;
grant execute on function public.coordinator_event_registrants(bigint) to authenticated;

commit;
