-- SPM-28: withdrawing a registration.
--
-- Nothing here widens the registration schema: `registration_status_chk`
-- already permits 'Withdrawn', `attendee_places_taken` already counts only
-- 'Registered' rows, and `registration_one_live_per_attendee_email_uidx` is
-- already partial on 'Registered'. So the freed place (SPM-85) and the freed
-- email slot both fall out of the status flip. What is missing is a way to
-- reach a registration by its reference, and a way to write the flip at all --
-- `attendee_register` is insert-only by design, so it cannot serve.
--
-- The user-defined SQLSTATEs now in use across the attendee path:
--
--   CS001  event is full                 attendee_register
--   CS002  no such registration          attendee_withdraw
--   CS003  registration is not live      attendee_withdraw
--   CS004  event has already completed   attendee_withdraw
--
-- Each is translated back into the domain's own error by
-- SupabaseRegistrationRepository, so losing a race looks to the attendee
-- exactly like losing it a moment earlier.

-- ---------------------------------------------------------------------------
-- 1. Let an attendee read the event a completed registration points at.
--
-- The withdrawal gate is "the event has not completed" (SPM-84), and the domain
-- decides it from an `Event` -- so the core has to be able to load one. The old
-- policy stopped at 'Confirmed', which made a completed event indistinguishable
-- from a deleted one and would have reported "no such event" for a registration
-- the attendee is holding a valid link to.
--
-- What this widens, precisely: the ten already-granted columns of past events
-- become readable by anon. `operational_notes`, `decision_record` and the
-- coordinator assignment stay revoked (see the previous migration), so brief
-- s8b is untouched. It is still a permanent widening of the anonymous read
-- surface to serve one write path, which is why it is spelled out here.
--
-- Two guards become load-bearing as a result, where before they were redundant
-- with this policy. Do not remove either:
--   * SupabaseEventCatalogue.listConfirmed() filters status in SQL itself.
--   * isOpenForRegistration() refuses a non-confirmed event, which is now the
--     only thing keeping a completed event off the registration form. There is
--     a test pinning it in view-event-for-registration.test.ts.
--
-- 'Cancelled' is deliberately not included. A registration for a cancelled
-- event will report the event as missing rather than as cancelled; telling the
-- attendee what actually happened belongs with SPM-55, not here.
-- ---------------------------------------------------------------------------

drop policy "Attendees read confirmed events" on public.event;

create policy "Attendees read confirmed and completed events"
  on public.event for select to anon, authenticated
  using (status in ('Confirmed', 'Completed'));

-- ---------------------------------------------------------------------------
-- 2. Read a registration by its reference.
--
-- The twin of `attendee_live_registration`, differing in exactly one thing: no
-- status filter. A withdrawn registration must come back, or the terminal state
-- (SPM-84) is indistinguishable from a reference that never existed, and the
-- page cannot confirm a withdrawal the attendee just made.
--
-- It keeps the property the other functions were written for -- it cannot
-- return a row the caller did not already identify. The reference is a
-- gen_random_uuid(), so identifying one means holding 122 bits of it. Until
-- attendees have accounts, holding the reference *is* the authorisation to
-- withdraw; that is a deliberate Release 1 position, not an oversight.
-- ---------------------------------------------------------------------------

create or replace function public.attendee_registration(p_reference uuid)
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
  where r.registration_reference = p_reference;
$$;

-- ---------------------------------------------------------------------------
-- 3. The withdrawal itself.
--
-- Both rules are restated here rather than trusted from the use case, for the
-- reason `attendee_register` restates `isFull`: the use case reads, decides,
-- then writes, and the answer can change in between. The domain still owns the
-- decisions (`isLive`, `allowsWithdrawal`); this refuses the same things to a
-- caller who reached the function directly with a publishable key.
--
-- Lock order is event, then registration -- the same order `attendee_register`
-- takes them in (it locks the event row `for update` before inserting), so the
-- two functions cannot deadlock against each other.
-- ---------------------------------------------------------------------------

create or replace function public.attendee_withdraw(p_reference uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id bigint;
  v_status   text;
begin
  -- Which event, so the locks below can be taken in a fixed order.
  select r.event_id into v_event_id
  from public.registration r
  where r.registration_reference = p_reference;

  if not found then
    raise exception 'No registration with reference %', p_reference
      using errcode = 'CS002';
  end if;

  -- `for share` is the weakest lock that blocks a concurrent
  -- `update event set status = 'Completed'`, which is the only race this gate
  -- has. A completion either lands before us -- and we refuse -- or waits for
  -- our commit. It does not block another attendee withdrawing at the same
  -- event, which `for update` would.
  perform 1 from public.event e where e.event_id = v_event_id for share;

  if exists (
    select 1 from public.event e
    where e.event_id = v_event_id and e.status = 'Completed'
  ) then
    raise exception 'Event % has already completed', v_event_id
      using errcode = 'CS004';
  end if;

  -- Now the registration, locked: two concurrent withdrawals of one reference
  -- serialise here, and the loser re-reads 'Withdrawn' and is refused below
  -- rather than writing a second time.
  select r.status into v_status
  from public.registration r
  where r.registration_reference = p_reference
  for update;

  if v_status <> 'Registered' then
    raise exception 'Registration % is not live', p_reference
      using errcode = 'CS003';
  end if;

  -- No `updated_at` assignment: unlike the insert in `attendee_register`, the
  -- registration_set_updated_at trigger does fire on update and maintains it.
  update public.registration
  set status = 'Withdrawn'
  where registration_reference = p_reference;
end;
$$;

-- Execute is granted to PUBLIC by default, so it is revoked before being
-- granted -- the reasoning is set out in full in the identity migration.
revoke execute on function public.attendee_registration(uuid) from public;
revoke execute on function public.attendee_withdraw(uuid) from public;

grant execute on function public.attendee_registration(uuid) to anon, authenticated;
grant execute on function public.attendee_withdraw(uuid) to anon, authenticated;
