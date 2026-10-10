-- SPM-49: the assigned Event Coordinator updates an event's ordinary details
-- directly -- name, description, purpose, category, programme agenda, special
-- arrangements, accessibility and internal (operational) notes. Date and
-- slots, attendance, venue and equipment are "significant" (#4) and change
-- only through a change request, so this function refuses them.
--
-- `coordinator_update_event_details` takes the changes as a jsonb object of
-- column name to new value (null clears). The core (`planOrdinaryEdit`) has
-- already worked out what changed and checked the values; this restates what
-- the database can check for itself -- the event is the caller's, it is not
-- Completed or Cancelled, and every key is an ordinary column -- under a row
-- lock. Each changed column is audited with its old and new value (AC3) in the
-- same transaction; a value that is already stored is skipped.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseCoordinatorEventRepository:
--   CS064  no such event, or not assigned to this coordinator (#91)
--   CS065  the event is Completed or Cancelled, so its details are read-only
--   CS066  a key that is not an ordinary column -- a significant field, or
--          anything else
--
-- Same known gap as the other coordinator functions: the coordinator id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.coordinator_update_event_details(
  p_coordinator_user_account_id bigint,
  p_event_id bigint,
  p_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ordinary constant text[] := array[
    'name', 'description', 'purpose', 'category_type', 'programme_agenda',
    'special_arrangements', 'accessibility_requirements', 'operational_notes'
  ];
  v_event public.event;
  v_column text;
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
      using errcode = 'CS064';
  end if;

  if v_event.status not in ('Planning', 'Blocked', 'Confirmed') then
    raise exception 'Event % is %, so its details are read-only', p_event_id, v_event.status
      using errcode = 'CS065', detail = v_event.status;
  end if;

  for v_column in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
    if not v_column = any (v_ordinary) then
      raise exception '% is not a field the coordinator can change directly', v_column
        using errcode = 'CS066';
    end if;
  end loop;

  foreach v_column in array v_ordinary loop
    continue when not coalesce(p_changes, '{}'::jsonb) ? v_column;

    v_old := to_jsonb(v_event) ->> v_column;
    v_new := nullif(btrim(p_changes ->> v_column), '');
    continue when v_old is not distinct from v_new;

    -- v_column is one of v_ordinary, never caller text, so %I is safe here.
    execute format('update public.event set %I = $1 where event_id = $2', v_column)
      using v_new, p_event_id;

    insert into public.audit_record (
      actor_user_account_id, entity_type, entity_id, field_changed, old_value, new_value
    )
    values (p_coordinator_user_account_id, 'event', p_event_id, v_column, v_old, v_new);
  end loop;
end;
$$;

revoke execute on function public.coordinator_update_event_details(bigint, bigint, jsonb)
  from public;
grant execute on function public.coordinator_update_event_details(bigint, bigint, jsonb)
  to anon, authenticated;

commit;
