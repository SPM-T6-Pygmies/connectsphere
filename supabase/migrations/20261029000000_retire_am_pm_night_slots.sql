-- SPM-328 / SPM-361 (SPM-276 team decision 6, CR-W7-01): the contract step.
--
-- 20261020000000 added the 15-minute codes '0' to '95' to `slot` beside AM,
-- PM and Night. Each SPM-276 story has since moved its own table onto them:
-- venue_slot (SPM-320), event_slot and session_slot (SPM-326), booking_slot
-- (SPM-324), venue_unavailability_slot (SPM-321) and event_request_slot
-- (SPM-327). Nothing reads AM, PM or Night any more, so they go, and
-- slot_code_chk allows only the 15-minute codes. slot_code stays the primary
-- key, and every foreign key to it is unchanged.
--
-- booking_slot_value_chk and the event, session and event-request checks
-- already allow only the 15-minute codes. venue_slot and
-- venue_unavailability_slot have no check of their own: their foreign key to
-- `slot` is now enough.

begin;

-- The foreign keys are ON DELETE RESTRICT, so a row still on AM, PM or Night
-- would stop the delete anyway. Name the table instead of failing on a key.
do $$
declare
  v_left text;
begin
  select string_agg(t, ', ') into v_left
  from (
    select 'venue_slot' as t
      where exists (select 1 from public.venue_slot where slot_code in ('AM', 'PM', 'Night'))
    union all select 'booking_slot'
      where exists (select 1 from public.booking_slot where slot in ('AM', 'PM', 'Night'))
    union all select 'venue_unavailability_slot'
      where exists (select 1 from public.venue_unavailability_slot where slot in ('AM', 'PM', 'Night'))
    union all select 'event_request_slot'
      where exists (select 1 from public.event_request_slot where slot_code in ('AM', 'PM', 'Night'))
    union all select 'event_slot'
      where exists (select 1 from public.event_slot where slot_code in ('AM', 'PM', 'Night'))
    union all select 'session_slot'
      where exists (select 1 from public.session_slot where slot_code in ('AM', 'PM', 'Night'))
  ) still_on_old_codes;

  if v_left is not null then
    raise exception 'Cannot retire AM, PM and Night: % still hold them', v_left;
  end if;
end;
$$;

delete from public.slot where slot_code in ('AM', 'PM', 'Night');

alter table public.slot drop constraint slot_code_chk;
alter table public.slot add constraint slot_code_chk
  check (slot_code ~ '^([0-9]|[1-8][0-9]|9[0-5])$');

do $$
begin
  if (select count(*) from public.slot) <> 96 then
    raise exception 'Expected the 96 15-minute slots, found %', (select count(*) from public.slot);
  end if;
end;
$$;

commit;
