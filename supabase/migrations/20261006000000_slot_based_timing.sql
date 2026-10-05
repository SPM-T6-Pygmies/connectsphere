-- Slot-based timing, expand step.
--
-- Venues, events, sessions and event requests are scheduled in day slots, not
-- timestamps: AM 07:00-12:00, PM 12:00-18:00, Night 18:00-22:00, local time in
-- Singapore (Asia/Singapore, GMT+8). This migration adds the slot tables and
-- backfills them from the existing timestamps. The old timestamp columns stay
-- until the app reads slots everywhere; a later migration drops them.
--
-- Backfill covers same-day timings only. A timing that crosses midnight, or
-- has no end, is left without slots and must be set by hand.

begin;

-- ---------------------------------------------------------------------------
-- 1. Slot reference data
-- ---------------------------------------------------------------------------
create table slot (
  slot_code  text primary key,
  start_time time not null,
  end_time   time not null,
  constraint slot_code_chk check (slot_code in ('AM', 'PM', 'Night')),
  constraint slot_time_order_chk check (end_time > start_time)
);

insert into slot (slot_code, start_time, end_time) values
  ('AM',    '07:00', '12:00'),
  ('PM',    '12:00', '18:00'),
  ('Night', '18:00', '22:00');

-- ---------------------------------------------------------------------------
-- 2. Venue offers slots (replaces operating_hours for slot-based search)
--    Backfill: a slot is offered if the old operating hours cover all of it.
-- ---------------------------------------------------------------------------
create table venue_slot (
  venue_id  bigint not null references venue (venue_id) on delete cascade,
  slot_code text   not null references slot (slot_code) on delete restrict,
  primary key (venue_id, slot_code)
);

insert into venue_slot (venue_id, slot_code)
select v.venue_id, s.slot_code
from venue v
join slot s
  on v.operating_hours_start <= s.start_time
 and v.operating_hours_end   >= s.end_time
where v.operating_hours_start is not null
  and v.operating_hours_end   is not null;

-- ---------------------------------------------------------------------------
-- 3. What an event, event request or session occupies: a date and a slot.
--    A timing can take several slots, so each is one row.
-- ---------------------------------------------------------------------------
create table event_slot (
  event_id  bigint not null references event (event_id) on delete cascade,
  slot_date date   not null,
  slot_code text   not null references slot (slot_code) on delete restrict,
  primary key (event_id, slot_date, slot_code)
);

create table event_request_slot (
  event_request_id bigint not null references event_request (event_request_id) on delete cascade,
  slot_date        date   not null,
  slot_code        text   not null references slot (slot_code) on delete restrict,
  primary key (event_request_id, slot_date, slot_code)
);

create table session_slot (
  session_id bigint not null references session (session_id) on delete cascade,
  slot_date  date   not null,
  slot_code  text   not null references slot (slot_code) on delete restrict,
  primary key (session_id, slot_date, slot_code)
);

-- Backfill: a slot counts if the timing overlaps it, in Singapore local time.
insert into event_slot (event_id, slot_date, slot_code)
select e.event_id,
       (e.start_time at time zone 'Asia/Singapore')::date,
       s.slot_code
from event e
join slot s
  on (e.start_time at time zone 'Asia/Singapore')::time < s.end_time
 and (e.end_time   at time zone 'Asia/Singapore')::time > s.start_time
where e.start_time is not null
  and e.end_time   is not null
  and (e.start_time at time zone 'Asia/Singapore')::date
    = (e.end_time   at time zone 'Asia/Singapore')::date;

insert into event_request_slot (event_request_id, slot_date, slot_code)
select r.event_request_id,
       (r.preferred_start_time at time zone 'Asia/Singapore')::date,
       s.slot_code
from event_request r
join slot s
  on (r.preferred_start_time at time zone 'Asia/Singapore')::time < s.end_time
 and (r.preferred_end_time   at time zone 'Asia/Singapore')::time > s.start_time
where r.preferred_start_time is not null
  and r.preferred_end_time   is not null
  and (r.preferred_start_time at time zone 'Asia/Singapore')::date
    = (r.preferred_end_time   at time zone 'Asia/Singapore')::date;

insert into session_slot (session_id, slot_date, slot_code)
select ses.session_id,
       (ses.start_time at time zone 'Asia/Singapore')::date,
       s.slot_code
from session ses
join slot s
  on (ses.start_time at time zone 'Asia/Singapore')::time < s.end_time
 and (ses.end_time   at time zone 'Asia/Singapore')::time > s.start_time
where ses.start_time is not null
  and ses.end_time   is not null
  and (ses.start_time at time zone 'Asia/Singapore')::date
    = (ses.end_time   at time zone 'Asia/Singapore')::date;

-- ---------------------------------------------------------------------------
-- 4. booking_slot becomes the hard double-booking block (#35).
--    Denormalise venue_id and status from booking, kept in step by trigger,
--    so the partial unique index can see both (see schema.sql, booking_slot).
-- ---------------------------------------------------------------------------
alter table booking_slot
  add column venue_id bigint references venue (venue_id) on delete cascade,
  add column status   text;

update booking_slot bs
set venue_id = b.venue_id,
    status   = b.status
from booking b
where b.booking_id = bs.booking_id;

alter table booking_slot
  alter column venue_id set not null,
  alter column status   set not null;

create or replace function public.booking_slot_sync_from_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.booking_slot
  set venue_id = new.venue_id,
      status   = new.status
  where booking_id = new.booking_id;
  return new;
end;
$$;

create trigger booking_slot_sync_from_booking_trg
  after update of venue_id, status on public.booking
  for each row
  when (old.venue_id is distinct from new.venue_id or old.status is distinct from new.status)
  execute function public.booking_slot_sync_from_booking();

create or replace function public.booking_slot_fill_from_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select b.venue_id, b.status
    into new.venue_id, new.status
  from public.booking b
  where b.booking_id = new.booking_id;
  return new;
end;
$$;

create trigger booking_slot_fill_from_booking_trg
  before insert on public.booking_slot
  for each row
  execute function public.booking_slot_fill_from_booking();

create unique index booking_slot_no_double_booking_uidx
  on booking_slot (venue_id, slot_date, slot)
  where status in ('Tentative Hold', 'Confirmed');

-- ---------------------------------------------------------------------------
-- 5. RLS, as on every other table. Slot reference data and venue_slot are
--    readable by signed-in users (the venue catalogue is open to them). The
--    event, request and session junction tables have no read policy: they are
--    reached through security definer functions, like booking.
-- ---------------------------------------------------------------------------
alter table slot                enable row level security;
alter table venue_slot          enable row level security;
alter table event_slot          enable row level security;
alter table event_request_slot  enable row level security;
alter table session_slot        enable row level security;

create policy slot_read_authenticated on slot
  for select to authenticated using (true);
create policy venue_slot_read_authenticated on venue_slot
  for select to authenticated using (true);

grant select on slot, venue_slot to authenticated;

commit;
