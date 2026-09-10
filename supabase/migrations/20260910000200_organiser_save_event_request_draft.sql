-- Saving and finishing a draft event request (SPM-38/SPM-93).
--
-- `organiser_submit_event_request` only ever inserts, which is right for a
-- fresh request but wrong for "save my progress and let me come back to it":
-- every save would leave a new row behind, and finishing a draft would leave
-- the draft itself as an orphan alongside the now-Submitted one it started.
-- This adds the write side of that: update a request the Organiser already
-- owns, in place.
--
-- Same shape as the migration this follows: `anon` gets no grant on the
-- table, `search_path = ''`, execute revoked from public before being
-- granted. `p_client_organisation_id` is deliberately not a parameter --
-- which organisation a request belongs to is not this function's to change.
--
-- The `status = 'Draft'` guard in the `where` clause is the same edit rule
-- `eventRequestAccessFor` already draws in the core: this can move a request
-- out of Draft (finishing a submission), or keep it there (saving again), but
-- it can never touch a request that has already left Draft, and it can never
-- touch a request some other organiser owns.

create or replace function public.organiser_save_event_request(
  p_event_request_id           bigint,
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_start_time       timestamptz,
  p_preferred_end_time         timestamptz,
  p_expected_attendance        integer,
  p_venue_requirements         text,
  p_room_layout_preferences    text,
  p_accessibility_needs        text,
  p_equipment_requirements     text,
  p_registration_requirements  text,
  p_general_programme          text,
  p_other_special_arrangements text,
  p_status                     text,
  p_requesting_user_account_id bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  -- Defence in depth, not the business rule -- see
  -- organiser_submit_event_request for the same check on the insert path.
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'An event request needs a name'
      using errcode = 'check_violation';
  end if;

  update public.event_request
  set
    event_name                 = p_event_name,
    description                = p_description,
    purpose                    = p_purpose,
    preferred_date              = p_preferred_date,
    preferred_start_time        = p_preferred_start_time,
    preferred_end_time          = p_preferred_end_time,
    expected_attendance         = p_expected_attendance,
    venue_requirements          = p_venue_requirements,
    room_layout_preferences     = p_room_layout_preferences,
    accessibility_needs         = p_accessibility_needs,
    equipment_requirements      = p_equipment_requirements,
    registration_requirements   = p_registration_requirements,
    general_programme           = p_general_programme,
    other_special_arrangements  = p_other_special_arrangements,
    status                      = p_status
  where event_request_id = p_event_request_id
    and status = 'Draft'
    and requesting_user_account_id = p_requesting_user_account_id
  returning * into v_row;

  if not found then
    raise exception 'No editable draft % for that organiser', p_event_request_id
      using errcode = 'no_data_found';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, timestamptz, timestamptz, integer, text,
  text, text, text, text, text, text, text, bigint
) from public;

grant execute on function public.organiser_save_event_request(
  bigint, text, text, text, date, timestamptz, timestamptz, integer, text,
  text, text, text, text, text, text, text, bigint
) to anon, authenticated;
