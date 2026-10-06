-- Tries the bad inputs the database must refuse (SPM-21 AC6, AC7, AC8) and
-- fails loudly if any is accepted: a reason outside the five, a note under a
-- reason other than Other, and a 501-character note. It also checks that a
-- 500-character note under Other is accepted. Writes nothing that survives:
-- the whole block rolls back.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-unavailability/refusals.sql --local
--
-- Needs the seed (it borrows Main Hall and Test Venue Staff). Prints nothing
-- when every check holds, and an error naming the first one that did not.

do $$
declare
  v_staff bigint;
  v_venue bigint;
  v_id    bigint;
begin
  select user_account_id into v_staff
    from public.user_account where name = 'Test Venue Staff' and client_organisation_id is null;
  select venue_id into v_venue from public.venue where location = 'Main Hall';
  if v_staff is null or v_venue is null then
    raise exception 'Run seed-venues and the base seed first';
  end if;

  begin
    insert into public.venue_unavailability (venue_id, reason_category, recorded_by_user_account_id)
    values (v_venue, 'Holiday', v_staff);
    raise exception 'AC6: reason Holiday was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.venue_unavailability (venue_id, reason_category, reason_note, recorded_by_user_account_id)
    values (v_venue, 'Safety', 'Leaking roof', v_staff);
    raise exception 'AC7: a note under Safety was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.venue_unavailability (venue_id, reason_category, reason_note, recorded_by_user_account_id)
    values (v_venue, 'Other', repeat('x', 501), v_staff);
    raise exception 'AC8: a 501-character note was accepted';
  exception when check_violation then null;
  end;

  insert into public.venue_unavailability (venue_id, reason_category, reason_note, recorded_by_user_account_id)
  values (v_venue, 'Other', repeat('x', 500), v_staff)
  returning venue_unavailability_id into v_id;
  if v_id is null then
    raise exception 'AC8: a 500-character note under Other was refused';
  end if;

  -- Leave nothing behind, including the audit row the insert wrote.
  raise exception 'ok: all refusals held (rolled back on purpose)';
end;
$$;
