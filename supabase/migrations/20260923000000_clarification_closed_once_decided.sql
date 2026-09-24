-- SPM-33: a decided request's clarification thread is closed.
--
-- 20260921180000_event_request_clarification.sql let anyone on the exchange
-- post at any status ("a message is harmless", decision 3), and resolving a
-- question was not status-checked either. The team settled SPM-33's open
-- question the other way: once a request is Approved, Rejected or Withdrawn
-- there is nothing left to clarify -- an approved request's planning talk
-- belongs on its event -- so the thread stays readable as a record but takes
-- no new message, reply or Resolve.
--
-- The rule is the core's `canDiscussEventRequest` (the same three undecided
-- statuses as decide and return), restated here so a request decided a moment
-- earlier, or a hand-crafted RPC call, cannot reopen the thread.
--
-- New SQLSTATE, continuing from CS017:
--   CS018  the request has been decided, so its clarification thread is closed
--
-- Both functions keep their signatures, so their existing grants stand.

begin;

create or replace function public.post_event_request_clarification_message(
  p_event_request_id bigint,
  p_author_user_account_id bigint,
  p_body text,
  p_parent_comment_id bigint default null
)
returns public.event_request_comment
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.event_request_comment;
  v_body text := nullif(btrim(p_body), '');
  v_parent_of_parent bigint;
  v_status text;
begin
  -- `for share` so a decision cannot land between this check and the insert.
  select status
  into v_status
  from public.event_request
  where event_request_id = p_event_request_id
  for share;

  if not found then
    raise exception 'No event request %', p_event_request_id
      using errcode = 'CS010';
  end if;

  if v_status not in ('Submitted', 'Under Review', 'Returned') then
    raise exception 'Event request % is %, so its clarification thread is closed',
      p_event_request_id, v_status
      using errcode = 'CS018';
  end if;

  if v_body is null then
    raise exception 'A clarification message on event request % needs a body', p_event_request_id
      using errcode = 'CS014';
  end if;

  if p_parent_comment_id is not null then
    select parent_comment_id
    into v_parent_of_parent
    from public.event_request_comment
    where comment_id = p_parent_comment_id
      and event_request_id = p_event_request_id;

    -- A parent on another request, or none at all, is as wrong as a parent
    -- that is itself a reply: both would put the message somewhere the thread
    -- cannot render it.
    if not found or v_parent_of_parent is not null then
      raise exception 'Comment % is not a top-level message on event request %',
        p_parent_comment_id, p_event_request_id
        using errcode = 'CS016';
    end if;
  end if;

  insert into public.event_request_comment (
    event_request_id, author_user_account_id, parent_comment_id, body
  )
  values (p_event_request_id, p_author_user_account_id, p_parent_comment_id, v_body)
  returning * into v_comment;

  return v_comment;
end;
$$;

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

  if v_request.status not in ('Submitted', 'Under Review', 'Returned') then
    raise exception 'Event request % is %, so its clarification thread is closed',
      p_event_request_id, v_request.status
      using errcode = 'CS018';
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

commit;
