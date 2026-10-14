-- SPM-218: Venue Staff can hold a booking request's slots while the Event
-- Coordinator finalises the event.
--
-- `venue_staff_decide_booking` gains a third decision, `hold`, beside `approve`
-- and `reject`. A hold keeps the same slots from the same moment an approval
-- would, so it meets the same refusals, in the same order, under the same
-- venue lock:
--   CS030  the caller is not Venue Staff, or there is no such booking
--   CS031  the booking is no longer waiting for a decision (Requested only)
--   CS073  a hold needs an expiry that is still in the future (new)
--   CS028  the venue is blocked for one of its slots
--   CS025  a live hold or a Confirmed booking already has one of its slots
--
-- The core decides the expiry (`DEFAULT_HOLD_HOURS` after it places the hold)
-- and passes it in; the database refuses a hold with none, because a hold with
-- no expiry counts as live forever (booking_holds_slot).
--
-- As an approval does, a hold first marks any expired hold on its slots
-- Released, with an audit row: booking_slot_no_double_booking_uidx keeps every
-- Tentative Hold row, expired or not, because an index predicate cannot read
-- now(). SPM-253 replaces that stand-in with a proper Expired status.
--
-- The new parameter changes the signature, so the old function is dropped and
-- recreated from its latest definition (20261014020000).

begin;

drop function if exists public.venue_staff_decide_booking(bigint, bigint, text, text, bigint);

create function public.venue_staff_decide_booking(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_decision text,
  p_note text,
  p_suggested_alternative_venue_id bigint,
  p_hold_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_note text := nullif(btrim(p_note), '');
  v_clash text;
  v_blocked text;
begin
  if not exists (
    select 1
    from public.user_account_role uar
    join public.role r on r.role_id = uar.role_id
    where uar.user_account_id = p_staff_user_account_id
      and r.role_name = 'Venue Staff'
  ) then
    raise exception 'Not Venue Staff' using errcode = 'CS030';
  end if;

  select venue_id into v_venue_id from public.booking where booking_id = p_booking_id;
  if not found then
    raise exception 'No booking %', p_booking_id using errcode = 'CS030';
  end if;

  -- The same lock a booking request takes, so a decision and a request, or two
  -- decisions, on one venue cannot both see a slot as free.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status into v_status from public.booking where booking_id = p_booking_id;
  if v_status <> 'Requested' then
    raise exception 'Booking % is already %', p_booking_id, v_status using errcode = 'CS031';
  end if;

  if p_decision = 'hold' and (p_hold_expires_at is null or p_hold_expires_at <= now()) then
    raise exception 'A hold needs an expiry in the future' using errcode = 'CS073';
  end if;

  if p_decision in ('approve', 'hold') then
    -- A block recorded after the request still wins: the insert trigger never
    -- saw it.
    select string_agg(mine.slot_date::text || ' ' || mine.slot, ', ' order by mine.slot_date, mine.slot)
    into v_blocked
    from public.booking_slot mine
    where mine.booking_id = p_booking_id
      and exists (
        select 1
        from public.venue_unavailability_slot us
        join public.venue_unavailability u
          on u.venue_unavailability_id = us.venue_unavailability_id
        where us.venue_id = v_venue_id
          and us.slot_date = mine.slot_date
          and us.slot = mine.slot
          and u.lifted_at is null
      );

    if v_blocked is not null then
      raise exception 'Venue % is blocked for %', v_venue_id, v_blocked
        using errcode = 'CS028';
    end if;

    select string_agg(bs.slot_date::text || ' ' || bs.slot, ', ' order by bs.slot_date, bs.slot)
    into v_clash
    from public.booking_slot bs
    join public.booking_slot mine
      on mine.slot_date = bs.slot_date and mine.slot = bs.slot and mine.booking_id = p_booking_id
    join public.booking other on other.booking_id = bs.booking_id
    where other.venue_id = v_venue_id
      and other.booking_id <> p_booking_id
      and public.booking_holds_slot(other.status, other.hold_expires_at);

    if v_clash is not null then
      raise exception 'Venue % is already booked for %', v_venue_id, v_clash
        using errcode = 'CS025';
    end if;

    -- An expired hold still sits in booking_slot_no_double_booking_uidx; mark
    -- it Released so confirming or holding this booking does not trip the index.
    with expired as (
      update public.booking other
      set status = 'Released',
          updated_at = now()
      where other.venue_id = v_venue_id
        and other.booking_id <> p_booking_id
        and other.status = 'Tentative Hold'
        and not public.booking_holds_slot(other.status, other.hold_expires_at)
        and exists (
          select 1
          from public.booking_slot bs
          join public.booking_slot mine
            on mine.slot_date = bs.slot_date and mine.slot = bs.slot
          where bs.booking_id = other.booking_id
            and mine.booking_id = p_booking_id
        )
      returning other.booking_id
    )
    insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
    select p_staff_user_account_id, 'booking', booking_id, 'release expired hold'
    from expired;

    if p_decision = 'hold' then
      update public.booking
      set status = 'Tentative Hold',
          decided_by_user_account_id = p_staff_user_account_id,
          hold_expires_at = p_hold_expires_at,
          rejection_note = null,
          suggested_alternative_venue_id = null,
          updated_at = now()
      where booking_id = p_booking_id;
    else
      update public.booking
      set status = 'Confirmed',
          decided_by_user_account_id = p_staff_user_account_id,
          rejection_note = null,
          suggested_alternative_venue_id = null,
          updated_at = now()
      where booking_id = p_booking_id;
    end if;
  elsif p_decision = 'reject' then
    if v_note is null then
      raise exception 'A rejection needs a reason' using errcode = 'CS032';
    end if;

    update public.booking
    set status = 'Rejected',
        decided_by_user_account_id = p_staff_user_account_id,
        rejection_note = v_note,
        suggested_alternative_venue_id = p_suggested_alternative_venue_id,
        updated_at = now()
    where booking_id = p_booking_id;
  else
    raise exception 'Unknown decision %', p_decision;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_staff_user_account_id, 'booking', p_booking_id, p_decision);
end;
$$;

revoke execute on function public.venue_staff_decide_booking(bigint, bigint, text, text, bigint, timestamptz)
  from public;
grant execute on function public.venue_staff_decide_booking(bigint, bigint, text, text, bigint, timestamptz)
  to anon, authenticated;

commit;
