-- Replacing free-text preferred_time with two timestamptz columns (SPM-31).
--
-- preferred_date stays a plain `date` column, unchanged: it is a calendar
-- preference, not an instant, same reasoning as before. preferred_time was
-- free text ("09:00 - 17:00", "all day", "TBC") that nothing could validate
-- or compare; preferred_start_time/preferred_end_time are timestamptz,
-- matching event.start_time/event.end_time's existing convention, and let
-- the domain enforce "end after start" the same way the application already
-- enforces its own business rules.
--
-- No future-date check constraint is added here on purpose: "preferred_date
-- must be later than today" is a temporal, Clock-dependent business rule
-- that belongs in the domain (see PreferredDateNotInFutureError in
-- src/core/domain/errors.ts), not in a database CHECK, which has no notion
-- of "now" that agrees with the application's Clock port.
--
-- Existing preferred_time values are not backfilled into the new columns:
-- free text cannot be parsed into two instants without guessing, so the
-- column is simply dropped.

-- ---------------------------------------------------------------------------
-- 1. Drop the old-signature submit function -- its argument list is part of
--    its identity, so `create or replace` cannot change it in place.
-- ---------------------------------------------------------------------------

drop function if exists public.organiser_submit_event_request(
  text, text, text, date, text, integer, text, text, text, text, text, text,
  text, text, bigint, bigint
);

-- ---------------------------------------------------------------------------
-- 2. The table.
-- ---------------------------------------------------------------------------

alter table public.event_request
  add column if not exists preferred_start_time timestamptz,
  add column if not exists preferred_end_time   timestamptz,
  drop column if exists preferred_time;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_request_preferred_time_order_chk'
      and conrelid = 'public.event_request'::regclass
  ) then
    alter table public.event_request
      add constraint event_request_preferred_time_order_chk
      check (
        preferred_start_time is null
        or preferred_end_time is null
        or preferred_end_time > preferred_start_time
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Recreate the submit function with the new parameter list.
-- ---------------------------------------------------------------------------

create or replace function public.organiser_submit_event_request(
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
  p_requesting_user_account_id bigint,
  p_client_organisation_id     bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.event_request;
begin
  -- Defence in depth, not the business rule. The domain decides which fields
  -- are mandatory (see MANDATORY_SUBMISSION_FIELDS); this refuses the one
  -- thing that is true for every caller and every future rule -- a request
  -- nobody is responsible for, or one submitted with no name at all.
  if p_event_name is null or btrim(p_event_name) = '' then
    raise exception 'An event request needs a name'
      using errcode = 'check_violation';
  end if;

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements,
    room_layout_preferences, accessibility_needs, equipment_requirements,
    registration_requirements, general_programme, other_special_arrangements,
    status, requesting_user_account_id, client_organisation_id
  )
  values (
    p_event_name, p_description, p_purpose, p_preferred_date,
    p_preferred_start_time, p_preferred_end_time, p_expected_attendance,
    p_venue_requirements, p_room_layout_preferences, p_accessibility_needs,
    p_equipment_requirements, p_registration_requirements,
    p_general_programme, p_other_special_arrangements, p_status,
    p_requesting_user_account_id, p_client_organisation_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants for the new signature. organiser_event_requests/
--    organiser_event_request are unaffected: they return `setof
--    public.event_request`/`public.event_request` and pick up the new
--    columns automatically.
-- ---------------------------------------------------------------------------

revoke execute on function public.organiser_submit_event_request(
  text, text, text, date, timestamptz, timestamptz, integer, text, text, text,
  text, text, text, text, text, bigint, bigint
) from public;

grant execute on function public.organiser_submit_event_request(
  text, text, text, date, timestamptz, timestamptz, integer, text, text, text,
  text, text, text, text, text, bigint, bigint
) to anon, authenticated;
