-- Submitting an event request against the team schema (SPM-31, SPM-89).
--
-- `schema.sql` enables row level security on `event_request` and defines no
-- policy for it, so the table is currently unreachable with the publishable
-- key -- an insert is refused rather than merely returning nothing. This adds
-- the organiser write path.
--
-- It follows the shape the attendee migrations already established: `anon`
-- gets no grant on the table, and reaches it only through `security definer`
-- functions that cannot return a row the caller did not identify. That matters
-- more here than for events, because `event_request` carries internal planning
-- information -- `decision_record`, the assigned coordinator -- which brief
-- s8b keeps away from external users.
--
-- `search_path = ''` keeps these from resolving an unqualified name into a
-- caller-controlled schema, and execute is revoked from public before being
-- granted, because Postgres grants execute to PUBLIC by default.
--
-- Additive only: no column, constraint or index is altered.
--
-- WHAT THIS DOES NOT DO. It does not decide who may submit on whose behalf.
-- #62 has not settled how this system authenticates, so there is no
-- `auth.uid()` to check `requesting_user_account_id` against, and inventing
-- one here would bake an authorisation model into the database ahead of the
-- decision. Until then the application supplies the acting organiser (see
-- `actingOrganiser` in src/composition/container.ts) and these functions trust
-- it. Tighten this the moment #62 lands.

-- ---------------------------------------------------------------------------
-- 1. The submitted row, as the application reads it back.
-- ---------------------------------------------------------------------------

create or replace function public.organiser_submit_event_request(
  p_event_name                 text,
  p_description                text,
  p_purpose                    text,
  p_preferred_date             date,
  p_preferred_time             text,
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
    event_name, description, purpose, preferred_date, preferred_time,
    expected_attendance, venue_requirements, room_layout_preferences,
    accessibility_needs, equipment_requirements, registration_requirements,
    general_programme, other_special_arrangements, status,
    requesting_user_account_id, client_organisation_id
  )
  values (
    p_event_name, p_description, p_purpose, p_preferred_date, p_preferred_time,
    p_expected_attendance, p_venue_requirements, p_room_layout_preferences,
    p_accessibility_needs, p_equipment_requirements, p_registration_requirements,
    p_general_programme, p_other_special_arrangements, p_status,
    p_requesting_user_account_id, p_client_organisation_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Reading requests back.
--
-- Scoped by client organisation, which is the boundary #81 draws: an Organiser
-- sees their own organisation's requests and never another client's. The
-- function takes the organisation as an argument rather than deriving it,
-- for the same reason as above -- there is no session to derive it from yet.
-- ---------------------------------------------------------------------------

create or replace function public.organiser_event_requests(
  p_client_organisation_id bigint
)
returns setof public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where client_organisation_id = p_client_organisation_id
  order by created_at desc;
$$;

create or replace function public.organiser_event_request(
  p_event_request_id bigint
)
returns public.event_request
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request
  where event_request_id = p_event_request_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants.
-- ---------------------------------------------------------------------------

revoke execute on function public.organiser_submit_event_request(
  text, text, text, date, text, integer, text, text, text, text, text, text,
  text, text, bigint, bigint
) from public;

revoke execute on function public.organiser_event_requests(bigint) from public;
revoke execute on function public.organiser_event_request(bigint) from public;

grant execute on function public.organiser_submit_event_request(
  text, text, text, date, text, integer, text, text, text, text, text, text,
  text, text, bigint, bigint
) to anon, authenticated;

grant execute on function public.organiser_event_requests(bigint) to anon, authenticated;
grant execute on function public.organiser_event_request(bigint) to anon, authenticated;
