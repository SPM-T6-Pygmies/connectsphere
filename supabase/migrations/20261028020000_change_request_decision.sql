-- SPM-100: the event's assigned Coordinator decides a change request field by
-- field (#104). One save decides every item (2026-10-18 team decision): each is
-- Accepted, or Rejected with a reason. Accepted values are applied to the
-- event in the same transaction; a rejected one changes nothing.
--
-- Applying an accepted item:
--   times                   the event's event_slot rows become the 15-minute
--                           codes covering each requested {date, start, end},
--                           and preferred_date the earliest date
--   expected_attendance,    the event column of the same name
--   venue_requirements
--   equipment_requirements  the event column; Not applicable (null) also marks
--                           equipment not essential. The equipment lines are
--                           left alone: the Coordinator edits them in the
--                           SPM-41 editor (2026-10-18 team decision)
--   registration            the event's flag and window; Not applicable (null)
--                           turns registration off, keeps the dates, and marks
--                           registration not essential
--
-- "Not essential" is an event_essential_arrangement row with is_essential =
-- false. event_readiness already skips those, so an arrangement accepted as
-- Not applicable no longer blocks confirmation.
--
-- Revalidating what an accepted item touches is other cards' work. Their calls
-- go where the hook comments below stand, in this same transaction.
--
-- The functions restate the core's rules (`assertCanDecideChangeRequest`,
-- `decideChangeRequest`) so they hold against any caller.
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapter:
--   CS095  no such change request on an event assigned to this Coordinator
--          (#91: one code for both)
--   CS096  the event is Completed or Cancelled
--   CS097  the change request is already decided
--   CS098  the decisions do not decide every item exactly once, or a rejected
--          item has no reason

begin;

-- ---------------------------------------------------------------------------
-- What the Coordinator's page shows: every request on the event, newest first
-- ---------------------------------------------------------------------------
-- Nothing unless the event is assigned to this Coordinator.
create or replace function public.coordinator_event_change_requests(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  change_request_id bigint,
  created_at timestamptz,
  items jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select cr.change_request_id,
         cr.created_at,
         (
           select jsonb_agg(
                    jsonb_build_object(
                      'field_name', cri.field_name,
                      'requested_value', cri.requested_value,
                      'decision', cri.decision,
                      'decision_reason', cri.decision_reason
                    )
                    order by cri.change_request_item_id
                  )
           from public.change_request_item cri
           where cri.change_request_id = cr.change_request_id
         )
  from public.change_request cr
  join public.event e on e.event_id = cr.event_id
  where cr.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by cr.created_at desc, cr.change_request_id desc;
$$;

-- ---------------------------------------------------------------------------
-- Decide and apply (AC2-AC5)
-- ---------------------------------------------------------------------------
-- p_decisions is a JSON array of
--   {"field_name": ..., "decision": "Accepted" | "Rejected", "decision_reason": ...}
-- with exactly one element per item of the request.
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

        -- SPM-309: flag this event's live bookings ('event-change', source_ref 'times') here.
        -- SPM-311/394: when the set of dates changed, release the event's Reserved
        --              equipment lines and put them Under review (Rescheduled) here.

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

        -- SPM-309: flag this event's live bookings ('event-change', source_ref 'expected_attendance') here.

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

        -- SPM-309: flag this event's live bookings ('event-change', source_ref 'venue_requirements') here.

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

revoke execute on function public.coordinator_event_change_requests(bigint, bigint) from public;
revoke execute on function public.coordinator_decide_change_request(bigint, bigint, jsonb) from public;

grant execute on function public.coordinator_event_change_requests(bigint, bigint) to anon, authenticated;
grant execute on function public.coordinator_decide_change_request(bigint, bigint, jsonb) to anon, authenticated;

commit;
