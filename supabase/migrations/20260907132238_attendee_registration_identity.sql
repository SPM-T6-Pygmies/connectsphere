-- Attendee registration against the team schema (SPM-24, #53).
--
-- The team's model identifies a registrant by `attendee_user_account_id`. The
-- customer describes Attendees as external users and puts onboarding outside
-- the brief (#53), so there is no account to point at: an attendee gives us a
-- name and an email and nothing else. This adds that identity alongside the
-- account one rather than replacing it, so every other writer of this table is
-- unaffected.
--
-- Additive only. The `registration_id` bigint primary key and the foreign keys
-- pointing at it (waiting_list_entry) are untouched.

-- ---------------------------------------------------------------------------
-- 1. Attendee identity.
-- ---------------------------------------------------------------------------

alter table public.registration
  add column if not exists registration_reference uuid not null default gen_random_uuid(),
  add column if not exists attendee_name text,
  add column if not exists attendee_email text;

-- The application mints identity before the row exists, so that a registration
-- is a whole object from birth (see RegistrationRepository.nextId). A bigint
-- `generated always as identity` cannot carry a value the caller chose, hence a
-- second, external key. It doubles as the reference an attendee can quote.
alter table public.registration
  add constraint registration_reference_uniq unique (registration_reference);

alter table public.registration
  alter column attendee_user_account_id drop not null;

-- Exactly one identity, never both and never neither: a registration is either
-- an account holder's or an external attendee's.
alter table public.registration
  add constraint registration_attendee_identity_chk check (
    (attendee_user_account_id is not null
      and attendee_name is null and attendee_email is null)
    or
    (attendee_user_account_id is null
      and attendee_name is not null and attendee_email is not null)
  );

-- Mirrors blocksNewRegistration in src/core/domain/registration.ts: one live
-- place per attendee per event. Withdrawn rows are excluded so someone who
-- withdrew can register again, and the key is the lower-cased email because
-- that is the identity an unauthenticated attendee gives us.
--
-- 'Registered' rather than the broader `not in ('Cancelled', 'Withdrawn')` used
-- by the account-keyed indexes: Release 1 has no waiting list and no check-in,
-- so 'Registered' is the only live state this path can produce. Widen this when
-- waitlisting lands.
create unique index if not exists registration_one_live_per_attendee_email_uidx
  on public.registration (event_id, lower(attendee_email))
  where attendee_email is not null and status = 'Registered';

-- ---------------------------------------------------------------------------
-- 2. The attendee read model.
--
-- Column-level grants, not table-level. Internal planning information --
-- operational notes, the decision record, coordinator assignments -- must not
-- reach an Attendee (brief s8b), so Postgres refuses to return those columns
-- rather than the application remembering to omit them.
-- ---------------------------------------------------------------------------

grant select (
  event_id, name, description, status, start_time, end_time,
  event_capacity, registration_enabled_flag,
  registration_open_date, registration_close_date
) on public.event to anon, authenticated;

grant select (booking_id, event_id, venue_id, status) on public.booking to anon, authenticated;
grant select (venue_id, location) on public.venue to anon, authenticated;

-- RLS is already enabled on every table with no policies, so these are the
-- first. They narrow on status alone; whether registration is *open* is the
-- domain's decision and is applied to what comes back (see EventCatalogue).
create policy "Attendees read confirmed events"
  on public.event for select to anon, authenticated
  using (status = 'Confirmed');

create policy "Attendees read confirmed bookings"
  on public.booking for select to anon, authenticated
  using (status = 'Confirmed');

-- Only venue_id and location are granted above, so this exposes a location
-- string and nothing else.
create policy "Attendees read venues"
  on public.venue for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 3. The attendee write path.
--
-- `registration` holds attendee names and emails, which brief s8b classes as
-- protected information, and the client key is publishable. So `anon` gets no
-- grant on the table at all: it reaches registrations only through these three
-- functions, none of which can return a row the caller did not already
-- identify. There is no query here that yields the attendee list.
--
-- These are `security definer` because that is the point -- they are the only
-- sanctioned way past a table `anon` cannot touch. `search_path = ''` keeps
-- them from resolving an unqualified name into a caller-controlled schema, and
-- execute is revoked from public before being granted, because Postgres grants
-- execute to PUBLIC by default and that would make them callable by every role.
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
    and status = 'Registered';
$$;

create or replace function public.attendee_live_registration(
  p_event_id bigint,
  p_email text
)
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
  where r.event_id = p_event_id
    and lower(r.attendee_email) = lower(p_email)
    and r.status = 'Registered';
$$;

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
begin
  -- Defence in depth, not the business rule. The domain decides whether an
  -- event is open for registration; this refuses the same thing for every
  -- caller, including one holding the publishable key and calling directly.
  -- The window is compared in Singapore time, which is the only timezone this
  -- system serves (#36), because the stored bounds are calendar dates.
  if not exists (
    select 1 from public.event e
    where e.event_id = p_event_id
      and e.status = 'Confirmed'
      and e.registration_enabled_flag
      and e.registration_open_date is not null
      and e.registration_close_date is not null
      and (p_registered_at at time zone 'Asia/Singapore')::date
            between e.registration_open_date and e.registration_close_date
  ) then
    raise exception 'Event % is not open for registration', p_event_id
      using errcode = 'check_violation';
  end if;

  insert into public.registration (
    registration_reference, event_id, attendee_name, attendee_email,
    status, created_at, updated_at
  )
  values (
    p_reference, p_event_id, p_name, lower(p_email),
    p_status, p_registered_at, p_registered_at
  )
  on conflict (registration_reference) do update
    set status = excluded.status,
        updated_at = now();
end;
$$;

revoke execute on function public.attendee_places_taken(bigint) from public;
revoke execute on function public.attendee_live_registration(bigint, text) from public;
revoke execute on function public.attendee_register(uuid, bigint, text, text, text, timestamptz) from public;

grant execute on function public.attendee_places_taken(bigint) to anon, authenticated;
grant execute on function public.attendee_live_registration(bigint, text) to anon, authenticated;
grant execute on function public.attendee_register(uuid, bigint, text, text, text, timestamptz) to anon, authenticated;
