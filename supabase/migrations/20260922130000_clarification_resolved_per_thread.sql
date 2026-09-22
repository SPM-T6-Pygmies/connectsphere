-- SPM-33 AC6, reconciling 20260921180000_event_request_clarification.sql:
-- resolving moves from the request to the individual question.
--
-- That migration gave the whole request one Resolve. In practice a Coordinator
-- can have two questions outstanding at once (SPM-33 decision 5), and
-- answering one of them is not the same as no longer waiting -- so Resolve now
-- sits on each question, following Linear's comment threads, and the request
-- returns to the decision queue only when the last one is cleared.
--
-- Two columns carry that:
--   is_clarification_request  the message a return was sent with, as opposed
--                             to an ordinary comment or a reply. Only these
--                             hold the request with the Organiser, which is
--                             what stops a Coordinator's own note or sign-off
--                             from reading as an outstanding question.
--   resolved_at / _by         when the Coordinator marked it answered.
--
-- `coordinator_resolve_clarification` (whole-request) is dropped: nothing
-- calls it now, and leaving it would be a second way to reach a state this
-- one derives.
--
-- New SQLSTATE, continuing from CS016:
--   CS017  not an open question on this request -- an ordinary comment, one
--          already resolved, one belonging to another request, or no such row
--
-- The status rule is restated here under `for update` rather than trusted from
-- the caller, so a second resolve landing at the same moment cannot leave a
-- request `Returned` with nothing open, or `Under Review` with a question
-- still outstanding.

begin;

alter table public.event_request_comment
  add column if not exists is_clarification_request boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_account_id bigint
    references public.user_account (user_account_id) on delete restrict;

do $$
begin
  -- A reply continues an exchange; only a top-level message opens one. And
  -- nothing that was never asked can be answered.
  if not exists (
    select 1 from pg_constraint where conname = 'event_request_comment_request_is_top_level_chk'
  ) then
    alter table public.event_request_comment
      add constraint event_request_comment_request_is_top_level_chk
        check (not is_clarification_request or parent_comment_id is null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'event_request_comment_resolved_is_request_chk'
  ) then
    alter table public.event_request_comment
      add constraint event_request_comment_resolved_is_request_chk
        check (resolved_at is null or is_clarification_request);
  end if;
end;
$$;

-- Open questions are what every status decision reads, so they get their own index.
create index if not exists event_request_comment_open_request_idx
  on public.event_request_comment (event_request_id)
  where is_clarification_request and resolved_at is null;

-- ---------------------------------------------------------------------------
-- A return now opens a question, rather than just leaving a message
-- ---------------------------------------------------------------------------
create or replace function public.coordinator_return_event_request(
  p_event_request_id bigint,
  p_coordinator_user_account_id bigint,
  p_message text
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_request;
  v_message text := nullif(btrim(p_message), '');
begin
  select *
  into v_request
  from public.event_request
  where event_request_id = p_event_request_id
  for update;

  if not found
     or v_request.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event request % assigned to coordinator %',
      p_event_request_id, p_coordinator_user_account_id
      using errcode = 'CS010';
  end if;

  -- 'Returned' is admitted: a request can be returned more than once, with or
  -- without a Resolve in between (SPM-33 decision 5).
  if v_request.status not in ('Submitted', 'Under Review', 'Returned') then
    raise exception 'Event request % with status % cannot be returned',
      p_event_request_id, v_request.status
      using errcode = 'CS013';
  end if;

  -- Status before message, so an already-decided request is refused as such
  -- rather than asked for a message it could never use.
  if v_message is null then
    raise exception 'Returning event request % needs a message', p_event_request_id
      using errcode = 'CS014';
  end if;

  update public.event_request
  set status = 'Returned'
  where event_request_id = p_event_request_id
  returning * into v_request;

  -- The question opens the exchange, so it is top-level by definition, and it
  -- is what holds the request with the Organiser until it is resolved.
  insert into public.event_request_comment (
    event_request_id, author_user_account_id, parent_comment_id, body,
    is_clarification_request
  )
  values (p_event_request_id, p_coordinator_user_account_id, null, v_message, true);

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event_request', p_event_request_id, 'returned');

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark one question answered (AC6)
-- ---------------------------------------------------------------------------
create or replace function public.coordinator_resolve_clarification_thread(
  p_event_request_id bigint,
  p_coordinator_user_account_id bigint,
  p_comment_id bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_request;
  v_open integer;
begin
  select *
  into v_request
  from public.event_request
  where event_request_id = p_event_request_id
  for update;

  if not found
     or v_request.assigned_coordinator_user_account_id
        is distinct from p_coordinator_user_account_id then
    raise exception 'No event request % assigned to coordinator %',
      p_event_request_id, p_coordinator_user_account_id
      using errcode = 'CS010';
  end if;

  update public.event_request_comment
  set resolved_at = now(),
      resolved_by_user_account_id = p_coordinator_user_account_id
  where comment_id = p_comment_id
    and event_request_id = p_event_request_id
    and is_clarification_request
    and resolved_at is null;

  if not found then
    raise exception 'Comment % is not an open question on event request %',
      p_comment_id, p_event_request_id
      using errcode = 'CS017';
  end if;

  select count(*)
  into v_open
  from public.event_request_comment
  where event_request_id = p_event_request_id
    and is_clarification_request
    and resolved_at is null;

  -- Answering one of two questions is not the same as no longer waiting, so
  -- the request only rejoins the decision queue once nothing is left open.
  if v_open = 0 and v_request.status = 'Returned' then
    update public.event_request
    set status = 'Under Review'
    where event_request_id = p_event_request_id
    returning * into v_request;

    insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
    values (
      p_coordinator_user_account_id, 'event_request', p_event_request_id,
      'clarification_resolved'
    );
  end if;

  return v_request;
end;
$$;

drop function if exists public.coordinator_resolve_clarification(bigint, bigint);

revoke execute on function
  public.coordinator_resolve_clarification_thread(bigint, bigint, bigint) from public;
grant execute on function
  public.coordinator_resolve_clarification_thread(bigint, bigint, bigint) to anon, authenticated;

commit;
