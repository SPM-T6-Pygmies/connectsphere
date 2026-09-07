-- Three corrections to 20260907132238_attendee_registration_identity.sql
-- (SPM-24), each closing a gap between what that migration claimed and what it
-- actually enforced.

-- ---------------------------------------------------------------------------
-- 1. Make the column-level grants restrict something.
--
-- The previous migration granted select on named columns and said Postgres
-- would therefore refuse the others. It would not: Supabase's default
-- privileges already grant select on every table in `public` to anon and
-- authenticated, and Postgres takes the union of a table-level and a
-- column-level grant. So `operational_notes`, `decision_record` and the
-- coordinator assignment -- internal planning information, brief s8b -- stayed
-- readable to anyone holding the publishable key.
--
-- Revoking the table-level grant first is what makes the column list a
-- restriction rather than a decoration. A revoke of select on a table also
-- clears any column-level select on it, so the grants must follow the revoke.
-- ---------------------------------------------------------------------------

revoke select on public.event from anon, authenticated;
revoke select on public.booking from anon, authenticated;
revoke select on public.venue from anon, authenticated;

grant select (
  event_id, name, description, status, start_time, end_time,
  event_capacity, registration_enabled_flag,
  registration_open_date, registration_close_date
) on public.event to anon, authenticated;

grant select (booking_id, event_id, venue_id, status) on public.booking to anon, authenticated;
grant select (venue_id, location) on public.venue to anon, authenticated;

-- The same defaults gave both roles full access to `registration`, which holds
-- attendee names and emails. RLS is enabled there with no policies, so nothing
-- got through -- but the previous migration's reasoning was that the three
-- functions below are the entire surface, and that is only true once the table
-- grant is gone.
revoke all on public.registration from anon, authenticated;

-- READ THIS BEFORE WRITING THE FIRST `registration` POLICY.
--
-- Access is two gates, and both must open. The revoke above shut gate one, so
-- a policy on its own now fails with `permission denied for table
-- registration` -- correct policy, missing grant. Both lines are needed:
--
--   grant select on public.registration to authenticated;
--   create policy "..." on public.registration for select to authenticated
--     using ( <the role check> );
--
-- Letting an Event Organiser or Event Coordinator read their event's attendee
-- list is deliberately not written here, because it cannot be yet. Those are
-- rows in `role`, not Postgres roles: the only role PostgREST authenticates as
-- is `authenticated`, which is every signed-in user including Attendees, so
-- the narrowing has to live in the policy. That policy needs to join the
-- session to a `user_account` row, and the only link -- `auth_user_id` on
-- user_account -- is commented out pending #62. Until that is decided there is
-- no path from auth.uid() to user_account_role, and the honest choice is a
-- shut gate rather than a policy that cannot tell the six roles apart.
--
-- Once #62 lands, the check is roughly: the caller holds 'Event Organiser' or
-- 'Event Coordinator' in user_account_role, and the registration's event has
-- them as owning_organiser_user_account_id or
-- assigned_coordinator_user_account_id.

-- ---------------------------------------------------------------------------
-- 2. Count places the way the event's capacity is defined.
--
-- The team's model scopes a registration to an event (session_id null) or to
-- one session within it. `event_capacity` is the ceiling on the former, and
-- registration_unique_per_event_uidx draws the same line, so a session-scoped
-- row must not consume an event place. Release 1 creates no sessions; this is
-- wrong only once #74 lands, which is exactly when nobody would think to look
-- here.
-- ---------------------------------------------------------------------------

create or replace function public.attendee_places_taken(p_event_id bigint)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.registration
  where event_id = p_event_id
    and session_id is null
    and status = 'Registered';
$$;

-- ---------------------------------------------------------------------------
-- 3. Enforce capacity where it can actually hold.
--
-- The use case reads placesTaken, decides with `isFull`, then writes. Nothing
-- stood between those two statements, so two attendees could both read "one
-- place left" and both take it -- the one acceptance criterion of SPM-24 that
-- a single-user test can never catch.
--
-- Locking the event row is what makes the check mean anything: registrations
-- for one event serialise on it, the loser's count is taken after the winner
-- commits, and the lock is released at commit either way. It is one row and
-- one event, so it does not serialise the system.
--
-- This remains defence in depth rather than the business rule -- `isFull` in
-- src/core/domain/event.ts is still the decision, and null capacity still
-- reads as unlimited. What changed is that the database now refuses the race
-- the domain cannot see.
--
-- 'CS001' is a user-defined SQLSTATE, not a Postgres one, so the adapter can
-- tell a full event from a closed one without matching on message text. The
-- window refusal keeps check_violation.
-- ---------------------------------------------------------------------------

create or replace function public.attendee_register(
  p_reference uuid,
  p_event_id bigint,
  p_name text,
  p_email text,
  p_status text,
  p_registered_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer;
begin
  -- The window is compared in Singapore time, which is the only timezone this
  -- system serves (#36), because the stored bounds are calendar dates.
  select e.event_capacity into v_capacity
  from public.event e
  where e.event_id = p_event_id
    and e.status = 'Confirmed'
    and e.registration_enabled_flag
    and e.registration_open_date is not null
    and e.registration_close_date is not null
    and (p_registered_at at time zone 'Asia/Singapore')::date
          between e.registration_open_date and e.registration_close_date
  for update;

  if not found then
    raise exception 'Event % is not open for registration', p_event_id
      using errcode = 'check_violation';
  end if;

  -- Inlined rather than calling attendee_places_taken, so the count is plainly
  -- a statement taken after the lock was acquired.
  if v_capacity is not null and v_capacity <= (
    select count(*)
    from public.registration
    where event_id = p_event_id
      and session_id is null
      and status = 'Registered'
  ) then
    raise exception 'Event % is full', p_event_id
      using errcode = 'CS001';
  end if;

  -- No `on conflict`: the reference is minted fresh for every attempt (see
  -- RegistrationRepository.nextId), so that branch was unreachable. A clash on
  -- registration_one_live_per_attendee_email_uidx is a real duplicate and is
  -- left to surface as 23505.
  insert into public.registration (
    registration_reference, event_id, attendee_name, attendee_email,
    status, created_at, updated_at
  )
  values (
    p_reference, p_event_id, p_name, lower(p_email),
    p_status, p_registered_at, p_registered_at
  );
end;
$$;

-- create or replace preserves privileges, so the grants from the previous
-- migration still stand. Restated for the reader, and harmless if they do.
revoke execute on function public.attendee_places_taken(bigint) from public;
revoke execute on function public.attendee_register(uuid, bigint, text, text, text, timestamptz) from public;

grant execute on function public.attendee_places_taken(bigint) to anon, authenticated;
grant execute on function public.attendee_register(uuid, bigint, text, text, text, timestamptz) to anon, authenticated;
