-- SPM-33: the assigned Event Coordinator returns an event request to its
-- Organiser with a question, the two exchange messages on it, and the
-- Coordinator marks the exchange resolved.
--
-- Why a new table rather than a repoint of `event_comment`: `event_comment`
-- hangs off `event`, and per #80 the request and the event are separate
-- records -- a request's clarification thread exists before any event does,
-- and a rejected request never gets an event at all. The columns mirror
-- `event_comment`'s so the two read as the same idea; `event_comment` itself
-- is left untouched.
--
-- Threading is one level (SPM-33 decision 6, following Linear): a reply's
-- parent must itself be top-level. `event_comment`'s self-parent check stops a
-- comment parenting itself but not a three-deep chain, so the real rule is
-- enforced in `post_event_request_clarification_message` below, where it holds
-- against any caller rather than only against the UI.
--
-- Like every other table here, `event_request_comment` gets RLS with no
-- policies and is reached only through `security definer` functions -- the
-- house pattern from 20260909000000_organiser_event_request_submission.sql.
--
-- The two status-changing functions restate the core's rules
-- (`returnEventRequest` / `resolveClarification`, and the use cases'
-- assignment check) under `for update`, so a concurrent decision cannot
-- produce a state the application itself refuses.
--
-- Custom SQLSTATEs, translated back into DomainErrors by the adapters.
-- CS010-CS012 belong to the decide path, so this continues at CS013:
--   CS013  the request can no longer be returned for clarification
--   CS014  a clarification request without a message
--   CS015  the request is not waiting on the Organiser, so nothing to resolve
--   CS016  a reply whose parent is itself a reply (threading is one level)
-- `coordinator_return_event_request` and `coordinator_resolve_clarification`
-- reuse CS010 for "no such request, or not assigned to this coordinator",
-- one code for both so a guess cannot confirm a request exists (#91).
--
-- Both status-changing functions write an `audit_record` row, as
-- `coordinator_decide_event_request` already does -- the record must exist
-- whether or not the activity-rail read path (SPM-163) ever ships, and it
-- must commit or roll back with the transition it describes.
--
-- Known gap, shared with every other function here: the acting user id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create table if not exists public.event_request_comment (
  comment_id             bigint generated always as identity primary key,
  event_request_id       bigint not null
    references public.event_request (event_request_id) on delete cascade,
  author_user_account_id bigint not null
    references public.user_account (user_account_id) on delete restrict,
  parent_comment_id      bigint
    references public.event_request_comment (comment_id) on delete cascade,
  body                   text not null,
  created_at             timestamptz not null default now(),
  constraint event_request_comment_no_self_parent_chk
    check (parent_comment_id is distinct from comment_id)
);

create index if not exists event_request_comment_request_idx
  on public.event_request_comment (event_request_id);
create index if not exists event_request_comment_author_idx
  on public.event_request_comment (author_user_account_id);
create index if not exists event_request_comment_parent_idx
  on public.event_request_comment (parent_comment_id);

alter table public.event_request_comment enable row level security;

-- ---------------------------------------------------------------------------
-- Return a request for clarification (AC1, AC2, AC3)
-- ---------------------------------------------------------------------------
-- The status change and the question are one unit of work: a return whose
-- message was lost would tell the Organiser nothing, and a message without the
-- status change would leave the request sitting in the decision queue.
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

  -- The question opens the exchange, so it is top-level by definition.
  insert into public.event_request_comment (
    event_request_id, author_user_account_id, parent_comment_id, body
  )
  values (p_event_request_id, p_coordinator_user_account_id, null, v_message);

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event_request', p_event_request_id, 'returned');

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark the clarification resolved (AC6)
-- ---------------------------------------------------------------------------
-- Touches status only, never the thread: resolving is the Coordinator's "I am
-- no longer waiting on the Organiser" signal, not a message (decision 3).
create or replace function public.coordinator_resolve_clarification(
  p_event_request_id bigint,
  p_coordinator_user_account_id bigint
)
returns public.event_request
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.event_request;
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

  if v_request.status <> 'Returned' then
    raise exception 'Event request % with status % is not waiting on the Organiser',
      p_event_request_id, v_request.status
      using errcode = 'CS015';
  end if;

  -- Back to 'Under Review' rather than whatever it was before: the Coordinator
  -- has demonstrably picked it up, and 'Submitted' means nobody has.
  update public.event_request
  set status = 'Under Review'
  where event_request_id = p_event_request_id
  returning * into v_request;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'event_request', p_event_request_id, 'clarification_resolved');

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Post a message on the thread (AC4, AC5)
-- ---------------------------------------------------------------------------
-- Appends and nothing else. No status transition, no `event_request` write:
-- SPM-33 decision 3 makes a message harmless, which is exactly what lets both
-- sides talk without either of them moving the request. Deliberately not
-- restricted by status, for the same reason -- a status guard would buy
-- nothing when a message cannot move anything.
--
-- Who may post is the use case's check (`eventRequestAccessFor` /
-- `eventRequestAccessForCoordinator`), matching every other write here; this
-- function enforces the rules the application itself could not enforce against
-- a concurrent caller: that the request exists, and that threading is one
-- level deep.
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
begin
  if not exists (
    select 1 from public.event_request where event_request_id = p_event_request_id
  ) then
    raise exception 'No event request %', p_event_request_id
      using errcode = 'CS010';
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

-- ---------------------------------------------------------------------------
-- Read the thread (AC4)
-- ---------------------------------------------------------------------------
-- Oldest first, which is the order the rail renders in. No access check of its
-- own, matching `organiser_event_request`: the caller has already identified
-- the request, and who may read it is the core's call
-- (`eventRequestAccessFor` / `eventRequestAccessForCoordinator`).
create or replace function public.event_request_clarification_thread(
  p_event_request_id bigint
)
returns setof public.event_request_comment
language sql
security definer
set search_path = ''
stable
as $$
  select *
  from public.event_request_comment
  where event_request_id = p_event_request_id
  order by created_at, comment_id;
$$;

revoke execute on function public.coordinator_return_event_request(bigint, bigint, text)
  from public;
revoke execute on function public.coordinator_resolve_clarification(bigint, bigint)
  from public;
revoke execute on function public.post_event_request_clarification_message(bigint, bigint, text, bigint)
  from public;
revoke execute on function public.event_request_clarification_thread(bigint)
  from public;

grant execute on function public.coordinator_return_event_request(bigint, bigint, text)
  to anon, authenticated;
grant execute on function public.coordinator_resolve_clarification(bigint, bigint)
  to anon, authenticated;
grant execute on function public.post_event_request_clarification_message(bigint, bigint, text, bigint)
  to anon, authenticated;
grant execute on function public.event_request_clarification_thread(bigint)
  to anon, authenticated;

commit;
