-- SPM-219: Venue Staff confirm or release a live tentative hold.
--
-- Confirming commits the held slots to the event: the booking becomes
-- Confirmed and its expiry is cleared. Releasing gives the hold up: the booking
-- becomes Released and its slots are free at once, because
-- booking_slot_no_double_booking_uidx and booking_holds_slot only count a
-- Tentative Hold or Confirmed booking.
--
-- Either needs the hold to be live now, under the same lock on the venue that
-- a request and a decision take, so a hold that expires, or is decided by
-- someone else, while the page is open is refused and nothing changes:
--   CS030  the caller is not Venue Staff, or there is no such booking
--   CS074  the booking is not a live hold (new): it expired, was already
--          confirmed or released, or was never held
--   CS028  confirming only: a venue block recorded after the hold covers one
--          of its slots (the same refusal an approval gives, SPM-22)
--
-- Confirming needs no clash check. The hold already owns its slots, and the
-- one-per-slot index would refuse any second claim on them. It does check for
-- a block, because confirming commits the slots just as an approval does, and
-- a block recorded after the hold was placed still wins. Releasing never does:
-- giving a hold up needs nothing free.

begin;

create function public.venue_staff_resolve_hold(
  p_staff_user_account_id bigint,
  p_booking_id bigint,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id bigint;
  v_status text;
  v_expires timestamptz;
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

  if p_resolution not in ('confirm', 'release') then
    raise exception 'Unknown resolution %', p_resolution;
  end if;

  -- The same lock a booking request and a decision take.
  perform 1 from public.venue where venue_id = v_venue_id for update;

  select status, hold_expires_at into v_status, v_expires
  from public.booking
  where booking_id = p_booking_id;

  if v_status <> 'Tentative Hold' or not public.booking_holds_slot(v_status, v_expires) then
    raise exception 'Booking % is not a live hold', p_booking_id using errcode = 'CS074';
  end if;

  if p_resolution = 'confirm' then
    -- A block recorded after the hold still wins: the insert trigger never saw it.
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

    update public.booking
    set status = 'Confirmed',
        decided_by_user_account_id = p_staff_user_account_id,
        hold_expires_at = null,
        updated_at = now()
    where booking_id = p_booking_id;
  else
    update public.booking
    set status = 'Released',
        decided_by_user_account_id = p_staff_user_account_id,
        updated_at = now()
    where booking_id = p_booking_id;
  end if;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_staff_user_account_id, 'booking', p_booking_id, p_resolution || ' hold');
end;
$$;

revoke execute on function public.venue_staff_resolve_hold(bigint, bigint, text) from public;
grant execute on function public.venue_staff_resolve_hold(bigint, bigint, text) to anon, authenticated;

commit;
