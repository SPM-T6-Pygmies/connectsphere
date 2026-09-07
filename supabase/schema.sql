-- Schema the Supabase driven adapters in src/adapters/outbound/supabase expect.
--
-- Note that the domain invariants are asserted here as well as in
-- src/core/domain/connection.ts. That is not duplication to be removed: the
-- domain enforces the rule for this application, the database enforces it for
-- every writer, including a future service and a hand-typed SQL statement.

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists connections (
  id uuid primary key,
  requester_id uuid not null references members (id) on delete cascade,
  addressee_id uuid not null references members (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null,

  -- Mirrors SelfConnectionError.
  constraint no_self_connection check (requester_id <> addressee_id)
);

-- Mirrors blocksNewRequest: at most one live connection per pair, in either
-- direction. Declined rows are excluded so members can try again.
create unique index if not exists connections_unique_live_pair
  on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- Attendee registration (SPM-24).
--
-- A trimmed reading of the team's candidate model in spm-212-t6-brain
-- (outputs/supabase-schema-ddl.md), which invites renaming: uuid keys and
-- lowercase status values to match `members` and `connections` above, and
-- timestamptz rather than date for the registration window so the core never
-- has to expand a calendar date into a Singapore instant.
--
-- SECURITY -- READ BEFORE POINTING THIS AT A REAL PROJECT.
-- There are no RLS policies here, matching the rest of this file and the
-- candidate DDL, which leaves them unwritten while the role model (#56) is
-- open. `registrations` holds attendee names and emails, which brief s8b
-- classes as protected information, and the client key is publishable. Policies
-- have to land before this schema meets real attendee data.
-- ---------------------------------------------------------------------------

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  capacity integer check (capacity is null or capacity >= 0)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null check (status in
    ('draft', 'approved', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  -- Null means no ceiling has been set, which the domain reads as unlimited.
  event_capacity integer check (event_capacity is null or event_capacity >= 0),

  -- The registration period is the Event Coordinator's, and is separate from
  -- the event dates (#30).
  registration_enabled boolean not null default false,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,

  constraint event_time_order check (ends_at > starts_at),
  constraint event_registration_window
    check (registration_opens_at is null or registration_closes_at is null
           or registration_closes_at >= registration_opens_at)
);

-- An event reaches its venue through a booking; the domain model draws no
-- direct edge between the two.
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  venue_id uuid not null references venues (id) on delete restrict,
  status text not null check (status in
    ('requested', 'tentative_hold', 'confirmed', 'rejected', 'released', 'cancelled'))
);

create index if not exists bookings_event_idx on bookings (event_id);
create index if not exists bookings_venue_idx on bookings (venue_id);

create table if not exists registrations (
  id uuid primary key,
  event_id uuid not null references events (id) on delete cascade,
  attendee_name text not null,
  attendee_email text not null,
  status text not null check (status in ('registered', 'withdrawn')),
  registered_at timestamptz not null
);

create index if not exists registrations_event_idx on registrations (event_id);

-- Mirrors blocksNewRegistration in src/core/domain/registration.ts: one live
-- place per attendee per event. Withdrawn rows are excluded so someone who
-- withdrew can register again, and the key is the lower-cased email because
-- that is the identity an unauthenticated attendee gives us (#53).
create unique index if not exists registrations_one_live_per_attendee
  on registrations (event_id, lower(attendee_email))
  where status = 'registered';

-- The attendee list only ever asks for confirmed events, ordered by when
-- registration closes.
create index if not exists events_open_for_registration_idx
  on events (registration_closes_at)
  where status = 'confirmed';
