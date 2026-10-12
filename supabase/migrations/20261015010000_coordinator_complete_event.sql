-- SPM-51: the assigned Event Coordinator marks a Confirmed event Completed
-- once it has ended, optionally recording operational notes.
--
-- `coordinator_complete_event` restates the domain's `completeEvent`
-- (src/core/domain/event-completion.ts) under a row lock (§8.6) -- change the
-- two together:
--   - only a Confirmed event can be completed;
--   - only once it has ended: the end of its latest event_slot, in Singapore
--     time (#36). An event with no slots has no known end and is refused --
--     event.start_time/end_time were dropped for slots
--     (20261006070000_drop_timestamp_timing.sql).
--
-- The notes are written here, in the same transaction as the status change,
-- because coordinator_update_event_details refuses a Completed event (CS065).
-- Trimmed; blank (or null) notes, or notes the event already has, leave
-- operational_notes as it is. The status change is audited as action
-- 'completed'; a notes change is audited as its own field-change row with
-- the old and new value, the way coordinator_update_event_details does.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository:
--   CS070  no such event, or not assigned to this coordinator (#91)
--   CS071  the event is not Confirmed; DETAIL carries its current status
--   CS072  the event has not ended yet, or has no slots
--
-- Same known gap as the other coordinator functions: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.coordinator_complete_event(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.event;
  v_ends_at timestamptz;
  v_old text;
  v_new text;
begin
  select * into v_event
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update;

  if not found then
    raise exception 'No event % assigned to coordinator %', p_event_id, p_coordinator_user_account_id
      using errcode = 'CS070';
  end if;

  if v_event.status <> 'Confirmed' then
    raise exception 'Event % with status % cannot be marked completed', p_event_id, v_event.status
      using errcode = 'CS071', detail = v_event.status;
  end if;

  select max((es.slot_date + s.end_time) at time zone 'Asia/Singapore')
  into v_ends_at
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  where es.event_id = p_event_id;

  if v_ends_at is null or now() < v_ends_at then
    raise exception 'Event % has not ended yet', p_event_id
      using errcode = 'CS072';
  end if;

  update public.event
  set status = 'Completed'
  where event_id = p_event_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event', p_event_id, 'completed');

  v_old := v_event.operational_notes;
  v_new := nullif(btrim(p_notes), '');
  if v_new is not null and v_new is distinct from btrim(v_old) then
    update public.event
    set operational_notes = v_new
    where event_id = p_event_id;

    insert into public.audit_record (
      actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
    )
    values (p_coordinator_user_account_id, 'event', p_event_id, 'operational_notes', v_old, v_new);
  end if;
end;
$$;

revoke execute on function public.coordinator_complete_event(bigint, bigint, text) from public;
grant execute on function public.coordinator_complete_event(bigint, bigint, text)
  to anon, authenticated;

commit;
