-- SPM-311: an accepted change of the event's dates (SPM-100) releases every
-- unit its equipment lines hold and puts them back to Technical Support, who
-- checked them against dates the event no longer has (2026-10-18 team
-- decision). A change of time on the same dates does nothing (AC4). The return
-- date already follows the event's date (AC3): since SPM-275 the hold is
-- worked out from preferred_date, with nothing stored.
--
-- equipment_reservation_line gains:
--
--   rescheduled_at  Set when a date change released the line, so it is Under
--                   review as Rescheduled rather than changed. Cleared once
--                   Technical Support reserve it or mark it unfulfilled.
--
--   reschedule_event_equipment(p_user_account_id, p_event_id)
--     The domain's rescheduleEquipment. Each line holding units releases them
--     all and goes Under review with rescheduled_at set, keeping what
--     Technical Support last decided on as its baseline; a line whose removal
--     was requested is deleted instead, as an unreserved line is (SPM-41
--     AC10). Lines holding nothing are left alone. Audited per line. Not
--     granted: only coordinator_decide_change_request calls it, holding the
--     event's lock.
--
--   coordinator_decide_change_request
--     Calls it at the SPM-311 hook when the set of dates changed, as the
--     domain's Revalidation.equipmentReview says. Otherwise as in
--     20261029010000 (SPM-309), keeping its booking flags. Same signature,
--     replaced in place.
--
--   coordinator_update_equipment_requirement
--     An edit back to the baseline no longer clears a Rescheduled line: with
--     nothing held there is no reservation to return to. Same signature.
--
--   technical_support_reserve_equipment, technical_support_mark_equipment_unfulfilled
--     Clear rescheduled_at with the rest of the review. Same signatures.
--
--   coordinator_event_equipment
--     Each line's rescheduled flag. Its result columns change, so it is
--     dropped and recreated.
--
--   technical_support_equipment_events, technical_support_event_equipment
--     Each line's rescheduled flag too, inside the lines json. Replaced in place.

begin;

alter table public.equipment_reservation_line
  add column rescheduled_at timestamptz,
  add constraint equipment_reservation_line_rescheduled_chk
    check (rescheduled_at is null or line_state = 'Under review');

create function public.reschedule_event_equipment(
  p_user_account_id bigint,
  p_event_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with released as (
    delete from public.equipment_reservation_line l
    using public.equipment_reservation r
    where r.equipment_reservation_id = l.equipment_reservation_id
      and r.event_id = p_event_id
      and l.quantity_reserved > 0
      and l.removal_requested_at is not null
    returning l.equipment_reservation_id
  )
  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  select p_user_account_id, 'equipment_reservation', released.equipment_reservation_id,
         'equipment released on reschedule'
  from released;

  with released as (
    update public.equipment_reservation_line l
    set quantity_reserved = 0,
        line_state = 'Under review',
        reviewed_quantity_requested = case
          when l.line_state = 'Under review' then l.reviewed_quantity_requested
          else l.quantity_requested
        end,
        reviewed_technical_requirements = case
          when l.line_state = 'Under review' then l.reviewed_technical_requirements
          else l.technical_requirements
        end,
        rescheduled_at = now()
    from public.equipment_reservation r
    where r.equipment_reservation_id = l.equipment_reservation_id
      and r.event_id = p_event_id
      and l.quantity_reserved > 0
    returning l.equipment_reservation_id
  )
  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  select p_user_account_id, 'equipment_reservation', released.equipment_reservation_id,
         'equipment released on reschedule'
  from released;
end;
$$;

create or replace function public.coordinator_decide_change_request(
  p_coordinator_user_account_id bigint,
  p_change_request_id bigint,
  p_decisions jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_item record;
  v_value jsonb;
  v_item_count integer;
  v_dates_were date[];
begin
  -- The same lock submit_change_request takes, so a decision and a new
  -- submission on one event cannot interleave.
  select e.* into v_event
  from public.event e
  join public.change_request cr on cr.event_id = e.event_id
  where cr.change_request_id = p_change_request_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update of e;

  if not found then
    raise exception 'No change request % on an event assigned to coordinator %',
      p_change_request_id, p_coordinator_user_account_id
      using errcode = 'CS095';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its change requests are read-only', v_event.event_id, v_event.status
      using errcode = 'CS096', detail = v_event.status;
  end if;

  perform 1
  from public.change_request_item cri
  where cri.change_request_id = p_change_request_id
  for update;

  if not exists (
    select 1
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Pending'
  ) then
    raise exception 'Change request % is already decided', p_change_request_id
      using errcode = 'CS097';
  end if;

  select count(*) into v_item_count
  from public.change_request_item cri
  where cri.change_request_id = p_change_request_id;

  if jsonb_typeof(p_decisions) is distinct from 'array'
     or jsonb_array_length(p_decisions) <> v_item_count
     or (select count(distinct d ->> 'field_name') from jsonb_array_elements(p_decisions) d) <> v_item_count
     or exists (
       select 1
       from jsonb_array_elements(p_decisions) d
       where coalesce(d ->> 'decision', '') not in ('Accepted', 'Rejected')
          or (d ->> 'decision' = 'Rejected' and coalesce(btrim(d ->> 'decision_reason'), '') = '')
          or not exists (
            select 1
            from public.change_request_item cri
            where cri.change_request_id = p_change_request_id
              and cri.field_name = d ->> 'field_name'
          )
     ) then
    raise exception 'Change request % needs one decision per item, with a reason on each rejection',
      p_change_request_id
      using errcode = 'CS098';
  end if;

  update public.change_request_item cri
  set decision = d ->> 'decision',
      decision_reason = case when d ->> 'decision' = 'Rejected' then btrim(d ->> 'decision_reason') end,
      updated_at = now()
  from jsonb_array_elements(p_decisions) d
  where cri.change_request_id = p_change_request_id
    and cri.field_name = d ->> 'field_name';

  update public.change_request
  set updated_at = now()
  where change_request_id = p_change_request_id;

  for v_item in
    select cri.field_name, cri.requested_value
    from public.change_request_item cri
    where cri.change_request_id = p_change_request_id
      and cri.decision = 'Accepted'
    order by cri.change_request_item_id
  loop
    case v_item.field_name
      when 'times' then
        v_value := v_item.requested_value::jsonb;

        select array_agg(distinct es.slot_date order by es.slot_date) into v_dates_were
        from public.event_slot es
        where es.event_id = v_event.event_id;

        delete from public.event_slot where event_id = v_event.event_id;

        insert into public.event_slot (event_id, slot_date, slot_code)
        select distinct v_event.event_id, (r ->> 'date')::date, s.slot_code
        from jsonb_array_elements(v_value) r
        join public.slot s
          on s.slot_code ~ '^[0-9]+$'
         and s.start_time >= (r ->> 'start')::time
         and s.end_time <= (r ->> 'end')::time;

        update public.event
        set preferred_date = (select min((r ->> 'date')::date) from jsonb_array_elements(v_value) r)
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'times', null, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(v_event.event_id, 'times', 'Event date/time changed');
        -- SPM-311 AC4: a change of time on the same dates leaves the equipment be.
        if v_dates_were is distinct from (
          select array_agg(distinct (r ->> 'date')::date order by (r ->> 'date')::date)
          from jsonb_array_elements(v_value) r
        ) then
          perform public.reschedule_event_equipment(p_coordinator_user_account_id, v_event.event_id);
        end if;

      when 'expected_attendance' then
        update public.event
        set expected_attendance = v_item.requested_value::integer
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'expected_attendance',
          v_event.expected_attendance::text, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(
          v_event.event_id, 'expected_attendance',
          'Expected attendance changed from ' || coalesce(v_event.expected_attendance::text, 'not set')
            || ' to ' || v_item.requested_value);

      when 'venue_requirements' then
        update public.event
        set venue_requirements = v_item.requested_value
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'venue_requirements',
          v_event.venue_requirements, v_item.requested_value
        );

        perform public.flag_event_bookings_for_change(v_event.event_id, 'venue_requirements', 'Venue requirements changed');

      when 'equipment_requirements' then
        update public.event
        set equipment_requirements = v_item.requested_value
        where event_id = v_event.event_id;

        insert into public.audit_record (
          actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
        )
        values (
          p_coordinator_user_account_id, 'event', v_event.event_id, 'equipment_requirements',
          v_event.equipment_requirements, v_item.requested_value
        );

        if v_item.requested_value is null then
          insert into public.event_essential_arrangement (event_id, arrangement_type, is_essential)
          values (v_event.event_id, 'equipment', false)
          on conflict (event_id, arrangement_type) do update set is_essential = false;
        end if;

      when 'registration' then
        if v_item.requested_value is null then
          update public.event
          set registration_enabled_flag = false
          where event_id = v_event.event_id;

          insert into public.event_essential_arrangement (event_id, arrangement_type, is_essential)
          values (v_event.event_id, 'registration', false)
          on conflict (event_id, arrangement_type) do update set is_essential = false;

          insert into public.audit_record (
            actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
          )
          select p_coordinator_user_account_id, 'event', v_event.event_id,
                 'registration_enabled_flag', v_event.registration_enabled_flag::text, 'false'
          where v_event.registration_enabled_flag;
        else
          v_value := v_item.requested_value::jsonb;

          update public.event
          set registration_enabled_flag = (v_value ->> 'enabled')::boolean,
              registration_open_date = (v_value ->> 'opensOn')::date,
              registration_close_date = (v_value ->> 'closesOn')::date
          where event_id = v_event.event_id;

          insert into public.audit_record (
            actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
          )
          select p_coordinator_user_account_id, 'event', v_event.event_id,
                 changed.field, changed.old_value, changed.new_value
          from (
            values
              ('registration_enabled_flag', v_event.registration_enabled_flag::text,
               ((v_value ->> 'enabled')::boolean)::text),
              ('registration_open_date', v_event.registration_open_date::text, v_value ->> 'opensOn'),
              ('registration_close_date', v_event.registration_close_date::text, v_value ->> 'closesOn')
          ) as changed (field, old_value, new_value)
          where changed.old_value is distinct from changed.new_value;
        end if;
    end case;
  end loop;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'change_request', p_change_request_id, 'decided');

  -- SPM-433: perform public.lapse_event_confirmation(v_event.event_id, 'change-request') here.
end;
$$;

create or replace function public.coordinator_update_equipment_requirement(
  p_event_id bigint,
  p_coordinator_user_account_id bigint,
  p_equipment_item_id bigint,
  p_quantity_requested integer,
  p_technical_requirements text,
  p_removal_requested boolean,
  p_quantity_reserved_seen integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.equipment_reservation_line;
  v_changed boolean;
  v_newly_removed boolean;
  v_goes_under_review boolean;
  v_undone boolean;
  v_reverted boolean;
begin
  perform public.coordinator_lock_event_for_equipment(p_event_id, p_coordinator_user_account_id);

  select l.*
  into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if not found then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS034';
  end if;

  if v_line.quantity_reserved <> p_quantity_reserved_seen then
    raise exception 'Line for item % on event % was reserved against since it was read',
      p_equipment_item_id, p_event_id
      using errcode = 'CS035';
  end if;

  v_changed := v_line.quantity_requested <> p_quantity_requested
    or v_line.technical_requirements is distinct from p_technical_requirements;
  v_newly_removed := p_removal_requested and v_line.removal_requested_at is null;

  -- SPM-274 AC4: a change to a line marked unfulfilled goes under review too.
  v_goes_under_review := v_line.line_state in ('Reserved', 'Unfulfilled') and (v_changed or v_newly_removed);

  -- A removal request being withdrawn (AC17).
  v_undone := not p_removal_requested and v_line.removal_requested_at is not null;

  -- AC19 and AC17: the line is put back to what Technical Support last had, by an
  -- edit or by withdrawing a removal request, so they have nothing to do. If the
  -- line was also changed, an undone removal leaves it Under review as changed.
  -- SPM-311: not a Rescheduled line, which holds nothing to go back to.
  v_reverted := v_line.line_state = 'Under review'
    and v_line.rescheduled_at is null
    and not p_removal_requested
    and (v_changed or v_undone)
    and p_quantity_requested = v_line.reviewed_quantity_requested
    and p_technical_requirements is not distinct from v_line.reviewed_technical_requirements;

  update public.equipment_reservation_line
  set quantity_requested = p_quantity_requested,
      technical_requirements = p_technical_requirements,
      removal_requested_at = case
        when p_removal_requested then coalesce(v_line.removal_requested_at, now())
      end,
      line_state = case
        when v_reverted and v_line.quantity_reserved > 0 then 'Reserved'
        when v_reverted then 'Unfulfilled'
        when v_goes_under_review then 'Under review'
        else v_line.line_state
      end,
      reviewed_quantity_requested = case
        when v_reverted then null
        when v_goes_under_review then v_line.quantity_requested
        else v_line.reviewed_quantity_requested
      end,
      reviewed_technical_requirements = case
        when v_reverted then null
        when v_goes_under_review then v_line.technical_requirements
        else v_line.reviewed_technical_requirements
      end
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id,
          case
            when v_newly_removed then 'equipment requirement removal requested'
            when not p_removal_requested and v_line.removal_requested_at is not null
              then 'equipment requirement removal undone'
            else 'equipment requirement edited'
          end);
end;
$$;

create or replace function public.technical_support_reserve_equipment(
  p_user_account_id   bigint,
  p_event_id          bigint,
  p_equipment_item_id bigint,
  p_quantity          integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item      public.equipment_item;
  v_event     public.event;
  v_line      public.equipment_reservation_line;
  v_available integer;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  -- Every reservation of this type waits here for the one before it (AC6).
  select i.* into v_item
  from public.equipment_item i
  where i.equipment_item_id = p_equipment_item_id
  for update;

  select e.* into v_event
  from public.event e
  where e.event_id = p_event_id;

  select l.* into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if v_item.equipment_item_id is null or v_line.reservation_line_id is null then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS043';
  end if;

  if not public.equipment_line_awaits_decision(v_event, v_line)
    or v_line.quantity_requested <> p_quantity then
    raise exception 'Line for item % on event % no longer awaits a decision as read', p_equipment_item_id, p_event_id
      using errcode = 'CS045';
  end if;

  if v_event.preferred_date is null then
    raise exception 'Event % has no date yet', p_event_id
      using errcode = 'CS044';
  end if;

  -- Out on the day before the event: events dated that day or on the event's
  -- date. Out on the event's date: events dated that day or the day after.
  select v_item.quantity - v_item.out_of_service - greatest(
           coalesce(sum(ol.quantity_reserved) filter (
             where oe.preferred_date in (v_event.preferred_date - 1, v_event.preferred_date)), 0),
           coalesce(sum(ol.quantity_reserved) filter (
             where oe.preferred_date in (v_event.preferred_date, v_event.preferred_date + 1)), 0))
  into v_available
  from public.equipment_reservation_line ol
  join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
  join public.event oe on oe.event_id = ores.event_id
  where ol.equipment_item_id = p_equipment_item_id
    and ol.quantity_reserved > 0
    and oe.event_id <> p_event_id
    and oe.status in ('Planning', 'Blocked', 'Confirmed')
    and oe.preferred_date between v_event.preferred_date - 1 and v_event.preferred_date + 1;

  if v_available < p_quantity then
    raise exception 'Only % of item % free for event %', v_available, p_equipment_item_id, p_event_id
      using errcode = 'CS046', detail = v_available::text;
  end if;

  update public.equipment_reservation_line
  set quantity_reserved = p_quantity,
      line_state = 'Reserved',
      reviewed_quantity_requested = null,
      reviewed_technical_requirements = null,
      rescheduled_at = null,
      decided_by_user_account_id = p_user_account_id,
      decision_comment = null
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment reserved');
end;
$$;

create or replace function public.technical_support_mark_equipment_unfulfilled(
  p_user_account_id          bigint,
  p_event_id                 bigint,
  p_equipment_item_id        bigint,
  p_quantity_requested_seen  integer,
  p_comment                  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_line  public.equipment_reservation_line;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  select e.* into v_event
  from public.event e
  where e.event_id = p_event_id;

  select l.* into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if v_line.reservation_line_id is null then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS043';
  end if;

  if not public.equipment_line_awaits_decision(v_event, v_line)
    or v_line.quantity_requested <> p_quantity_requested_seen then
    raise exception 'Line for item % on event % no longer awaits a decision as read', p_equipment_item_id, p_event_id
      using errcode = 'CS045';
  end if;

  if v_event.preferred_date is null then
    raise exception 'Event % has no date yet', p_event_id
      using errcode = 'CS044';
  end if;

  update public.equipment_reservation_line
  set quantity_reserved = 0,
      line_state = 'Unfulfilled',
      reviewed_quantity_requested = null,
      reviewed_technical_requirements = null,
      rescheduled_at = null,
      decided_by_user_account_id = p_user_account_id,
      decision_comment = p_comment
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id, 'equipment marked unfulfilled');
end;
$$;

drop function public.coordinator_event_equipment(bigint);

create function public.coordinator_event_equipment(
  p_event_id bigint
)
returns table (
  equipment_reservation_id        bigint,
  reviewed_by_user_account_id     bigint,
  equipment_item_id               bigint,
  quantity_requested              integer,
  quantity_reserved               integer,
  technical_requirements          text,
  line_state                      text,
  reviewed_quantity_requested     integer,
  reviewed_technical_requirements text,
  removal_requested               boolean,
  rescheduled                     boolean,
  decided_by_user_account_id      bigint,
  decided_by_name                 text,
  decision_comment                text,
  essential                       boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  with reservation as (
    select r.equipment_reservation_id, r.reviewed_by_user_account_id
    from public.equipment_reservation r
    where r.event_id = p_event_id
    order by r.equipment_reservation_id
    limit 1
  )
  select
    reservation.equipment_reservation_id,
    reservation.reviewed_by_user_account_id,
    l.equipment_item_id,
    l.quantity_requested,
    l.quantity_reserved,
    l.technical_requirements,
    l.line_state,
    l.reviewed_quantity_requested,
    l.reviewed_technical_requirements,
    l.removal_requested_at is not null,
    l.rescheduled_at is not null,
    l.decided_by_user_account_id,
    u.name,
    l.decision_comment,
    l.essential
  from reservation
  left join public.equipment_reservation_line l
    on l.equipment_reservation_id = reservation.equipment_reservation_id
  left join public.user_account u on u.user_account_id = l.decided_by_user_account_id
  order by l.reservation_line_id;
$$;

create or replace function public.technical_support_equipment_events(
  p_user_account_id bigint
)
returns table (
  event_id       bigint,
  event_name     text,
  status         text,
  preferred_date date,
  lines          jsonb
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  return query
  select
    e.event_id,
    e.name,
    e.status,
    e.preferred_date,
    l.lines
  from public.event e
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'equipment_item_id', rl.equipment_item_id,
      'quantity_requested', rl.quantity_requested,
      'quantity_reserved', rl.quantity_reserved,
      'technical_requirements', rl.technical_requirements,
      'line_state', rl.line_state,
      'reviewed_quantity_requested', rl.reviewed_quantity_requested,
      'reviewed_technical_requirements', rl.reviewed_technical_requirements,
      'removal_requested', rl.removal_requested_at is not null,
      'rescheduled', rl.rescheduled_at is not null,
      'decided_by_user_account_id', rl.decided_by_user_account_id,
      'decided_by_name', du.name,
      'decision_comment', rl.decision_comment,
      'essential', rl.essential
    ) order by rl.equipment_item_id) as lines
    from public.equipment_reservation_line rl
    join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
    left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
    where res.event_id = e.event_id
  ) l
  where l.lines is not null
  order by e.preferred_date nulls last, e.name;
end;
$$;

create or replace function public.technical_support_event_equipment(
  p_user_account_id bigint,
  p_event_id        bigint
)
returns table (
  event_id       bigint,
  event_name     text,
  status         text,
  preferred_date date,
  lines          jsonb
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  return query
  select
    e.event_id,
    e.name,
    e.status,
    e.preferred_date,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment_item_id', rl.equipment_item_id,
        'equipment_type', i.type,
        'owned', i.quantity,
        'out_of_service', i.out_of_service,
        'quantity_requested', rl.quantity_requested,
        'quantity_reserved', rl.quantity_reserved,
        'technical_requirements', rl.technical_requirements,
        'line_state', rl.line_state,
        'reviewed_quantity_requested', rl.reviewed_quantity_requested,
        'reviewed_technical_requirements', rl.reviewed_technical_requirements,
        'removal_requested', rl.removal_requested_at is not null,
        'rescheduled', rl.rescheduled_at is not null,
        'decided_by_user_account_id', rl.decided_by_user_account_id,
        'decided_by_name', du.name,
        'decision_comment', rl.decision_comment,
        'essential', rl.essential,
        'other_holds', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_status', oe.status,
            'preferred_date', oe.preferred_date,
            'quantity_reserved', ol.quantity_reserved
          ))
          from public.equipment_reservation_line ol
          join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
          join public.event oe on oe.event_id = ores.event_id
          where ol.equipment_item_id = rl.equipment_item_id
            and ol.quantity_reserved > 0
            and oe.event_id <> e.event_id
        ), '[]'::jsonb)
      ) order by i.type)
      from public.equipment_reservation_line rl
      join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = rl.equipment_item_id
      left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
end;
$$;

revoke execute on function public.reschedule_event_equipment(bigint, bigint) from public, anon, authenticated;

revoke execute on function public.coordinator_event_equipment(bigint) from public;
grant execute on function public.coordinator_event_equipment(bigint) to anon, authenticated;

commit;
