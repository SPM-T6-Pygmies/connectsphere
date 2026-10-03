-- SPM-232 (SPM-41 AC17): withdrawing a removal request now clears the review too.
--
-- Until now an undone removal always left the line Under review. If nothing else
-- about the line differs from what Technical Support last had (the baseline kept
-- by 20261003010000), they have nothing to do, so the line returns to Reserved
-- and leaves their list -- the same as an edit back to the original (AC19). If the
-- line was also changed before the removal, it stays Under review as changed.
--
-- Only coordinator_update_equipment_requirement changes: same signature, so it is
-- replaced in place and its grants stay.

begin;

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

  v_goes_under_review := v_line.line_state = 'Reserved' and (v_changed or v_newly_removed);

  -- A removal request being withdrawn (AC17).
  v_undone := not p_removal_requested and v_line.removal_requested_at is not null;

  -- AC19 and AC17: the line is put back to what Technical Support last had, by an
  -- edit or by withdrawing a removal request, so they have nothing to do. If the
  -- line was also changed, an undone removal leaves it Under review as changed.
  v_reverted := v_line.line_state = 'Under review'
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
        when v_reverted then 'Reserved'
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

commit;
