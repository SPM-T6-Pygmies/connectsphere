-- SPM-21 (SPM-266): venue unavailability blocks.
--
--   venue_unavailability        one row per block: the venue, why, who recorded
--                               it and when, and who lifted it and when
--   venue_unavailability_slot   one row per date and slot the block covers
--   venue_blocked_slots         what a venue is blocked for, over a date range
--
-- A block is a venue, a date range, some slots and a reason. It is stored as
-- one row per date and slot, the way booking_slot stores a booking, so it can
-- be compared with bookings directly and, if booking time ever moves to start
-- and end times, each row converts to its slot's hours without loss.
--
-- A block is In force while lifted_at is empty. Blocks may overlap: two staff
-- may block the same venue, date and slot for different reasons, and lifting
-- one frees nothing another still covers.
--
-- Reasons are the customer's five (Week 7 C2). A free-text note is allowed
-- only under Other, up to 500 characters. Both rules are checked here as well
-- as in the core, so a caller that skips the core cannot store a bad row.
--
-- Recording and lifting go through security definer functions (SPM-268), like
-- booking. The tables carry no read policy: readers go through
-- venue_blocked_slots, which gives Coordinators the venue, date, slot and
-- reason category of In force blocks and nothing else -- not the note, and not
-- who recorded it.
--
-- Every record and every lift writes an audit_record row, by trigger, in the
-- same transaction (SPM-21 AC18).

begin;

create table venue_unavailability (
  venue_unavailability_id     bigint generated always as identity primary key,
  venue_id                    bigint not null references venue (venue_id) on delete cascade,
  reason_category             text   not null,
  reason_note                 text,
  recorded_by_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  recorded_at                 timestamptz not null default now(),
  lifted_by_user_account_id   bigint references user_account (user_account_id) on delete restrict,
  lifted_at                   timestamptz,
  constraint venue_unavailability_reason_chk
    check (reason_category in ('Maintenance', 'Equipment failure', 'Renovation', 'Safety', 'Other')),
  constraint venue_unavailability_note_chk
    check (reason_note is null
           or (reason_category = 'Other' and char_length(reason_note) <= 500)),
  constraint venue_unavailability_lift_chk
    check ((lifted_at is null) = (lifted_by_user_account_id is null))
);

create index venue_unavailability_venue_idx on venue_unavailability (venue_id);

create table venue_unavailability_slot (
  venue_unavailability_id bigint not null
    references venue_unavailability (venue_unavailability_id) on delete cascade,
  slot_date               date   not null,
  slot                    text   not null references slot (slot_code) on delete restrict,
  venue_id                bigint not null references venue (venue_id) on delete cascade,
    -- a copy of the block's venue, filled on insert by trigger, so a lookup by
    -- venue, date and slot needs no join (see booking_slot)
  primary key (venue_unavailability_id, slot_date, slot)
);

create index venue_unavailability_slot_lookup_idx
  on venue_unavailability_slot (venue_id, slot_date, slot);

create or replace function public.venue_unavailability_slot_fill_venue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select u.venue_id into new.venue_id
  from public.venue_unavailability u
  where u.venue_unavailability_id = new.venue_unavailability_id;
  return new;
end;
$$;

create trigger venue_unavailability_slot_fill_venue_trg
  before insert on public.venue_unavailability_slot
  for each row
  execute function public.venue_unavailability_slot_fill_venue();

create or replace function public.venue_unavailability_audit_recorded()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (new.recorded_by_user_account_id, 'venue_unavailability', new.venue_unavailability_id, 'recorded');
  return new;
end;
$$;

create trigger venue_unavailability_audit_recorded_trg
  after insert on public.venue_unavailability
  for each row
  execute function public.venue_unavailability_audit_recorded();

create or replace function public.venue_unavailability_audit_lifted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (new.lifted_by_user_account_id, 'venue_unavailability', new.venue_unavailability_id, 'lifted');
  return new;
end;
$$;

create trigger venue_unavailability_audit_lifted_trg
  after update of lifted_at on public.venue_unavailability
  for each row
  when (old.lifted_at is null and new.lifted_at is not null)
  execute function public.venue_unavailability_audit_lifted();

alter table venue_unavailability      enable row level security;
alter table venue_unavailability_slot enable row level security;

-- What a venue is blocked for, from p_from to p_to inclusive, for one venue or
-- (with a null venue) every venue. In force blocks only. Overlapping blocks
-- each appear, so a slot two blocks cover is listed twice, once per reason.
-- Read by the availability calendar (SPM-43, SPM-152, SPM-153).
create or replace function public.venue_blocked_slots(
  p_venue_id bigint,
  p_from date,
  p_to date
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', s.venue_id,
             'date', s.slot_date,
             'slot', s.slot,
             'reason_category', u.reason_category)
           order by s.venue_id, s.slot_date,
                    array_position(array['AM', 'PM', 'Night'], s.slot),
                    u.venue_unavailability_id), '[]'::jsonb)
  from public.venue_unavailability_slot s
  join public.venue_unavailability u
    on u.venue_unavailability_id = s.venue_unavailability_id
  where auth.uid() is not null
    and u.lifted_at is null
    and (p_venue_id is null or s.venue_id = p_venue_id)
    and s.slot_date between p_from and p_to;
$$;

revoke execute on function public.venue_blocked_slots(bigint, date, date) from public, anon;
grant execute on function public.venue_blocked_slots(bigint, date, date) to authenticated;

commit;
