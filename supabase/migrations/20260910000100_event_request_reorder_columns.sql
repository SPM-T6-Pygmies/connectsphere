-- Reorders event_request's physical columns to match supabase/schema.sql's
-- declared order -- preferred_start_time/preferred_end_time right after
-- preferred_date -- instead of at the end, where the previous migration's
-- `alter table ... add column` necessarily left them.
--
-- Postgres has no ALTER TABLE ... ALTER COLUMN ... position operation; the
-- only way to change physical column order is to rebuild the table. This
-- preserves existing rows (via explicit id-preserving insert), the identity
-- sequence, indexes, check constraints, the updated_at trigger, RLS, and the
-- foreign keys `event`/`notification` hold against this table.
--
-- The new table's constraints are named with a `_new` suffix because
-- constraint/index names share one namespace per schema, so they would
-- otherwise collide with the still-live original table's -- they are renamed
-- to their canonical names once the original table is gone.

begin;

create table public.event_request_reordered (
  event_request_id           bigint generated always as identity,
  event_name                 text not null,
  description                text,
  purpose                    text,
  preferred_date             date,
  preferred_start_time       timestamptz,
  preferred_end_time         timestamptz,
  expected_attendance        integer,
  venue_requirements         text,
  accessibility_needs        text,
  equipment_requirements     text,
  registration_requirements  text,
  room_layout_preferences    text,
  general_programme          text,
  other_special_arrangements text,
  status                     text not null default 'Draft',
  decision_record            text,
  requesting_user_account_id bigint not null,
  assigned_coordinator_user_account_id bigint,
  client_organisation_id     bigint not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint event_request_pkey_new primary key (event_request_id),
  constraint event_request_expected_attendance_check_new
    check (expected_attendance is null or expected_attendance >= 0),
  constraint event_request_preferred_time_order_chk_new
    check (
      preferred_start_time is null
      or preferred_end_time is null
      or preferred_end_time > preferred_start_time
    ),
  constraint event_request_status_chk_new
    check (status in ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Returned', 'Withdrawn')),
  constraint event_request_requesting_user_account_id_fkey_new
    foreign key (requesting_user_account_id) references public.user_account (user_account_id) on delete restrict,
  constraint event_request_assigned_coordinator_user_account_id_fkey_new
    foreign key (assigned_coordinator_user_account_id) references public.user_account (user_account_id) on delete restrict,
  constraint event_request_client_organisation_id_fkey_new
    foreign key (client_organisation_id) references public.client_organisation (client_organisation_id) on delete restrict
);

insert into public.event_request_reordered (
  event_request_id, event_name, description, purpose, preferred_date,
  preferred_start_time, preferred_end_time, expected_attendance,
  venue_requirements, accessibility_needs, equipment_requirements,
  registration_requirements, room_layout_preferences, general_programme,
  other_special_arrangements, status, decision_record,
  requesting_user_account_id, assigned_coordinator_user_account_id,
  client_organisation_id, created_at, updated_at
)
overriding system value
select
  event_request_id, event_name, description, purpose, preferred_date,
  preferred_start_time, preferred_end_time, expected_attendance,
  venue_requirements, accessibility_needs, equipment_requirements,
  registration_requirements, room_layout_preferences, general_programme,
  other_special_arrangements, status, decision_record,
  requesting_user_account_id, assigned_coordinator_user_account_id,
  client_organisation_id, created_at, updated_at
from public.event_request
order by event_request_id;

-- Keep the identity sequence continuous with the rows just copied, so the
-- next insert doesn't collide with an id carried over above.
select setval(
  pg_get_serial_sequence('public.event_request_reordered', 'event_request_id'),
  coalesce((select max(event_request_id) from public.event_request_reordered), 0) + 1,
  false
);

-- Drops the old table's indexes, checks, trigger and RLS setting along with
-- it, and (cascade) the incoming FKs event/notification hold against it --
-- both are re-added below, against the renamed table.
drop table public.event_request cascade;

alter table public.event_request_reordered rename to event_request;

alter table public.event_request rename constraint event_request_pkey_new to event_request_pkey;
alter table public.event_request
  rename constraint event_request_expected_attendance_check_new to event_request_expected_attendance_check;
alter table public.event_request
  rename constraint event_request_preferred_time_order_chk_new to event_request_preferred_time_order_chk;
alter table public.event_request rename constraint event_request_status_chk_new to event_request_status_chk;
alter table public.event_request
  rename constraint event_request_requesting_user_account_id_fkey_new to event_request_requesting_user_account_id_fkey;
alter table public.event_request
  rename constraint event_request_assigned_coordinator_user_account_id_fkey_new
  to event_request_assigned_coordinator_user_account_id_fkey;
alter table public.event_request
  rename constraint event_request_client_organisation_id_fkey_new to event_request_client_organisation_id_fkey;

alter sequence public.event_request_reordered_event_request_id_seq
  rename to event_request_event_request_id_seq;

create index event_request_user_idx        on public.event_request (requesting_user_account_id);
create index event_request_coordinator_idx on public.event_request (assigned_coordinator_user_account_id);
create index event_request_client_org_idx  on public.event_request (client_organisation_id);

alter table public.event_request enable row level security;

create trigger event_request_set_updated_at
  before update on public.event_request
  for each row execute function public.set_updated_at();

alter table public.event
  add constraint event_event_request_id_fkey
  foreign key (event_request_id) references public.event_request (event_request_id) on delete set null;

alter table public.notification
  add constraint notification_related_event_request_id_fkey
  foreign key (related_event_request_id) references public.event_request (event_request_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- The organiser_* functions all return `public.event_request` (the table's
-- row type), which makes them dependents of the table for CASCADE purposes --
-- `drop table ... cascade` above silently took them with it. Recreate all
-- three (bodies unchanged from
-- 20260910000000_event_request_preferred_time_range.sql) and their grants.
-- ---------------------------------------------------------------------------

create or replace function public.organiser_submit_event_request(
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_start_time       timestamptz,
  p_preferred_end_time         timestamptz,
  p_expected_attendance        integer,
  p_venue_requirements         text,
  p_room_layout_preferences    text,
  p_accessibility_needs        text,
  p_equipment_requirements     text,
  p_registration_requirements  text,
  p_general_programme          text,
  p_other_special_arrangements text,
  p_status                     text,
  p_requesting_user_account_id bigint,
  p_client_organisation_id     bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'An event request needs a name'
      using errcode = 'check_violation';
  end if;

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements,
    room_layout_preferences, accessibility_needs, equipment_requirements,
    registration_requirements, general_programme, other_special_arrangements,
    status, requesting_user_account_id, client_organisation_id
  )
  values (
    p_event_name, p_description, p_purpose, p_preferred_date,
    p_preferred_start_time, p_preferred_end_time, p_expected_attendance,
    p_venue_requirements, p_room_layout_preferences, p_accessibility_needs,
    p_equipment_requirements, p_registration_requirements,
    p_general_programme, p_other_special_arrangements, p_status,
    p_requesting_user_account_id, p_client_organisation_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.organiser_event_requests(
  p_client_organisation_id bigint
)
returns setof public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where client_organisation_id = p_client_organisation_id
  order by created_at desc;
$$;

create or replace function public.organiser_event_request(
  p_event_request_id bigint
)
returns public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where event_request_id = p_event_request_id;
$$;

revoke execute on function public.organiser_submit_event_request(
  text, text, text, date, timestamptz, timestamptz, integer, text, text, text,
  text, text, text, text, text, bigint, bigint
) from public;
grant execute on function public.organiser_submit_event_request(
  text, text, text, date, timestamptz, timestamptz, integer, text, text, text,
  text, text, text, text, text, bigint, bigint
) to anon, authenticated;

revoke execute on function public.organiser_event_requests(bigint) from public;
grant execute on function public.organiser_event_requests(bigint) to anon, authenticated;

revoke execute on function public.organiser_event_request(bigint) from public;
grant execute on function public.organiser_event_request(bigint) to anon, authenticated;

commit;
