-- ============================================================================
-- ConnectSphere Event Planning & Venue Booking System
-- Proposed relational schema — Postgres / Supabase DDL
-- Derived from wiki/domain/domain-model.md § "Proposed relational schema"
-- Candidate physical model. Not a customer deliverable.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Shared: updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Client organisation  (wiki: client-organisation)
-- ---------------------------------------------------------------------------
create table client_organisation (
  client_organisation_id bigint generated always as identity primary key,
  name                   text not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Role + user account + role junction  (wiki: user-account, #56)
--    Multi-role by design: a person may hold several roles at once.
-- ---------------------------------------------------------------------------
create table role (
  role_id   bigint generated always as identity primary key,
  role_name text not null unique
);

create table user_account (
  user_account_id        bigint generated always as identity primary key,
  -- auth_user_id        uuid unique references auth.users (id) on delete set null,
  --   ^ uncomment if Supabase Auth is adopted as the identity provider (#62)
  name                   text not null,
  contact_details        text,
  communication_preferences text,
  department             text,
  availability           text,
  credentials_hash       text,          -- opaque; auth method undecided (#62)
  client_organisation_id bigint references client_organisation (client_organisation_id) on delete restrict,
    -- nullable: set only for Event Organiser accounts belonging to a client org
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table user_account_role (
  user_account_id bigint not null references user_account (user_account_id) on delete cascade,
  role_id         bigint not null references role (role_id) on delete restrict,
  primary key (user_account_id, role_id)
);

-- ---------------------------------------------------------------------------
-- 3. Event request  (wiki: event-request)
-- ---------------------------------------------------------------------------
create table event_request (
  event_request_id          bigint generated always as identity primary key,
  event_name                text not null,
  description               text,
  purpose                   text,
  preferred_date            date,
  preferred_time            text,
  expected_attendance       integer check (expected_attendance is null or expected_attendance >= 0),
  venue_requirements        text,
  accessibility_needs       text,
  equipment_requirements    text,
  registration_requirements text,
  room_layout_preferences   text,
  general_programme         text,
  other_special_arrangements text,
  status                    text not null default 'Draft',
  decision_record           text,
  requesting_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  assigned_coordinator_user_account_id bigint references user_account (user_account_id) on delete restrict,
    -- nullable: unset in Draft/Submitted, set by the Event Operations Manager
    -- at Step 3 (#73), before Under Review/Approved. Copied onto the
    -- resulting event.assigned_coordinator_user_account_id at approval —
    -- this column is then frozen, since 'Approved' is terminal for the
    -- request; reassignment (#94) after that point writes to `event` instead.
  client_organisation_id    bigint not null references client_organisation (client_organisation_id) on delete restrict,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint event_request_status_chk
    check (status in ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Returned', 'Withdrawn'))
    -- 'Withdrawn' added 2026-09-09 (D3, #103): grounded, Coordinator-actioned,
    -- must stay distinguishable from every other request state.
);

-- ---------------------------------------------------------------------------
-- 4. Event  (wiki: event)
--    event_request_id is UNIQUE + nullable: an event has 0..1 source request.
-- ---------------------------------------------------------------------------
create table event (
  event_id                 bigint generated always as identity primary key,
  event_request_id         bigint unique references event_request (event_request_id) on delete set null,
  name                     text not null,
  description              text,
  purpose                  text,
  category_type            text,
  preferred_date           date,
  start_time               timestamptz,
  end_time                 timestamptz,
  expected_attendance      integer check (expected_attendance is null or expected_attendance >= 0),
  event_capacity           integer check (event_capacity is null or event_capacity >= 0),
  programme_agenda         text,
  room_layout_preference   text,
  accessibility_requirements text,
  equipment_requirements   text,
  registration_enabled_flag boolean not null default false,
  special_arrangements     text,
  venue_requirements       text,
  technical_support_flag   boolean not null default false,
  technical_support_description text,
  status                   text not null default 'Planning',
  registration_open_date   date,
  registration_close_date  date,
  reused_from_event_id     bigint references event (event_id) on delete set null,  -- (#75)
  operational_notes        text,
  decision_record          text,
  assigned_coordinator_user_account_id bigint references user_account (user_account_id) on delete restrict,
  owning_organiser_user_account_id     bigint not null references user_account (user_account_id) on delete restrict,
  client_organisation_id   bigint not null references client_organisation (client_organisation_id) on delete restrict,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint event_status_chk
    check (status in ('Planning', 'Blocked', 'Confirmed', 'Completed', 'Cancelled')),
  constraint event_time_order_chk
    check (start_time is null or end_time is null or end_time > start_time),
  constraint event_registration_window_chk
    check (registration_open_date is null or registration_close_date is null
           or registration_close_date >= registration_open_date),
  constraint event_no_self_reuse_chk
    check (reused_from_event_id is distinct from event_id)
);

-- Approval is not Confirmation; confirmation is blocked while an essential
-- arrangement is incomplete (#80). Enforced in application/trigger logic,
-- not declaratively — the check spans event_essential_arrangement rows.

-- ---------------------------------------------------------------------------
-- 5. Event essential arrangements  (wiki: event, #80)
--    Per-event config; there is no fixed list that applies to every event.
-- ---------------------------------------------------------------------------
create table event_essential_arrangement (
  event_id         bigint not null references event (event_id) on delete cascade,
  arrangement_type text not null,
  is_essential     boolean not null default true,
  primary key (event_id, arrangement_type),
  constraint event_essential_arrangement_type_chk
    check (arrangement_type in ('venue', 'equipment', 'technical_support',
                                'programme', 'registration', 'other'))
);

-- ---------------------------------------------------------------------------
-- 6. Event comment  (wiki: event, #15)
--    parent_comment_id nullable self-FK: leave null throughout for a flat model.
-- ---------------------------------------------------------------------------
create table event_comment (
  comment_id            bigint generated always as identity primary key,
  event_id              bigint not null references event (event_id) on delete cascade,
  author_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  parent_comment_id     bigint references event_comment (comment_id) on delete cascade,
  body                  text not null,
  created_at            timestamptz not null default now(),
  constraint event_comment_no_self_parent_chk
    check (parent_comment_id is distinct from comment_id)
);

-- ---------------------------------------------------------------------------
-- 7. Supporting document  (wiki: event)
-- ---------------------------------------------------------------------------
create table supporting_document (
  document_id               bigint generated always as identity primary key,
  event_id                  bigint not null references event (event_id) on delete cascade,
  uploaded_by_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  file_name                 text not null,
  file_url                  text not null,   -- Supabase Storage object path
  uploaded_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Session  (wiki: session, #74)
--    First-class child of Event, with its own venue, equipment and timing.
-- ---------------------------------------------------------------------------
create table session (
  session_id       bigint generated always as identity primary key,
  event_id         bigint not null references event (event_id) on delete cascade,
  sequence_no      integer not null,
  name             text,
  start_time       timestamptz,
  end_time         timestamptz,
  attendance_limit integer check (attendance_limit is null or attendance_limit >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, sequence_no),
  constraint session_time_order_chk
    check (start_time is null or end_time is null or end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- 9. Venue + room layout  (wiki: venue, #50, #83)
-- ---------------------------------------------------------------------------
create table venue (
  venue_id               bigint generated always as identity primary key,
  location               text not null,
  capacity               integer check (capacity is null or capacity >= 0),
  facilities             text,
  accessibility          text,
  operating_hours_start  time,
  operating_hours_end    time,
  setup_time_minutes     integer check (setup_time_minutes is null or setup_time_minutes >= 0),
  turnaround_time_minutes integer check (turnaround_time_minutes is null or turnaround_time_minutes >= 0),
  booking_horizon_days   integer check (booking_horizon_days is null or booking_horizon_days >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table room_layout (
  room_layout_id bigint generated always as identity primary key,
  name           text not null unique
);

create table venue_supported_layout (
  venue_id       bigint not null references venue (venue_id) on delete cascade,
  room_layout_id bigint not null references room_layout (room_layout_id) on delete restrict,
  capacity       integer check (capacity is null or capacity >= 0),
    -- added 2026-09-09 (D2, #112): capacity is supplied per layout, not
    -- estimated. venue.capacity above is untouched; whether it becomes
    -- derived (max across layouts) or is dropped is still an open decision.
  primary key (venue_id, room_layout_id)
);

-- ---------------------------------------------------------------------------
-- 10. Booking + booking slot  (wiki: booking, #35, #41, #45, #69)
--     A booking is its own record: it can release without destroying the event.
-- ---------------------------------------------------------------------------
create table booking (
  booking_id                    bigint generated always as identity primary key,
  venue_id                      bigint not null references venue (venue_id) on delete restrict,
  event_id                      bigint references event (event_id) on delete cascade,
  session_id                    bigint references session (session_id) on delete cascade,
  requested_by_user_account_id  bigint not null references user_account (user_account_id) on delete restrict,
  decided_by_user_account_id    bigint references user_account (user_account_id) on delete restrict,
    -- null while status = 'Requested'
  status                        text not null default 'Requested',
  rejection_note                text,
  suggested_alternative_venue_id bigint references venue (venue_id) on delete set null,
    -- informal suggestion only, not a counter-offer object (#45)
  hold_expires_at               timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint booking_status_chk
    check (status in ('Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled')),
  constraint booking_scope_chk
    check (event_id is not null or session_id is not null),
  constraint booking_decider_chk
    check (status = 'Requested' or decided_by_user_account_id is not null)
);

create table booking_slot (
  booking_slot_id bigint generated always as identity primary key,
  booking_id      bigint not null references booking (booking_id) on delete cascade,
  slot_date       date not null,
  slot            text not null,
  unique (booking_id, slot_date, slot),
  constraint booking_slot_value_chk check (slot in ('AM', 'PM', 'Night'))
);

-- Double-booking is a HARD block, not an overridable warning (#35): one venue
-- + date + slot may carry at most one live (Tentative Hold / Confirmed) booking.
-- This cannot be expressed as a plain unique index, because the venue and the
-- status live on `booking` while the slot lives on `booking_slot`, and an index
-- expression may not sub-query another table. Two ways to close it — pick one
-- before going live, and prefer (a) so the database, not the application, holds
-- the block:
--   (a) denormalise venue_id and status onto booking_slot (kept in step by a
--       trigger on booking), then:
--         create unique index booking_slot_no_double_booking_uidx
--           on booking_slot (venue_id, slot_date, slot)
--           where status in ('Tentative Hold', 'Confirmed');
--   (b) a before insert/update trigger on booking_slot that joins to booking
--       and raises on a clash.

-- ---------------------------------------------------------------------------
-- 11. Equipment item  (wiki: equipment-item, #2, #5, #13)
--     Pooled counter, not one row per physical unit (#13, still open).
-- ---------------------------------------------------------------------------
create table equipment_item (
  equipment_item_id     bigint generated always as identity primary key,
  type                  text not null,
  description           text,
  quantity              integer not null default 0 check (quantity >= 0),
  physical_location     text,
  operational_status    text not null default 'Available',
  transfer_time_minutes integer check (transfer_time_minutes is null or transfer_time_minutes >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint equipment_item_operational_status_chk
    check (operational_status in ('Available', 'Reserved', 'In Use', 'Maintenance', 'Defective', 'Retired'))
);

-- ---------------------------------------------------------------------------
-- 12. Equipment reservation + lines  (wiki: equipment-reservation, #19, #90)
--     No approval workflow: the coordinator records, TSS reviews and reserves.
--     Partial fulfilment is judged line by line (#90).
-- ---------------------------------------------------------------------------
create table equipment_reservation (
  equipment_reservation_id  bigint generated always as identity primary key,
  event_id                  bigint references event (event_id) on delete cascade,
  session_id                bigint references session (session_id) on delete cascade,
  reviewed_by_user_account_id bigint references user_account (user_account_id) on delete restrict,
  status                    text not null default 'Requested',
  return_date               date,
    -- added 2026-09-09 (D1, #113): nullable, feeds the committed
    -- Return Day + 1 availability rule. Population mechanism is an open
    -- team decision — #113 states there is no fixed default.
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint equipment_reservation_status_chk
    check (status in ('Requested', 'Reserved', 'Partially Reserved', 'Unavailable', 'Released', 'Returned')),
  constraint equipment_reservation_scope_chk
    check (event_id is not null or session_id is not null)
);

create table equipment_reservation_line (
  reservation_line_id      bigint generated always as identity primary key,
  equipment_reservation_id bigint not null references equipment_reservation (equipment_reservation_id) on delete cascade,
  equipment_item_id        bigint not null references equipment_item (equipment_item_id) on delete restrict,
  quantity_requested       integer not null check (quantity_requested > 0),
  quantity_reserved        integer not null default 0 check (quantity_reserved >= 0),
  fulfilment_status        text not null default 'Pending',
  defect_notes             text,
  unique (equipment_reservation_id, equipment_item_id),
  constraint equipment_reservation_line_fulfilment_chk
    check (fulfilment_status in ('Pending', 'Fulfilled', 'Partially Fulfilled', 'Unfulfilled')),
  constraint equipment_reservation_line_quantity_chk
    check (quantity_reserved <= quantity_requested)
);

-- ---------------------------------------------------------------------------
-- 13. Support request + assignments  (wiki: support-request, #89)
-- ---------------------------------------------------------------------------
create table support_request (
  support_request_id  bigint generated always as identity primary key,
  event_id            bigint not null references event (event_id) on delete cascade,
  support_needed_flag boolean not null default false,
  description         text,
  timing              text,
  clarification_log   text,
  response            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table support_request_assignment (
  support_request_id             bigint not null references support_request (support_request_id) on delete cascade,
  technical_support_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  assigned_at                    timestamptz not null default now(),
  primary key (support_request_id, technical_support_user_account_id)
);

-- ---------------------------------------------------------------------------
-- 14. Registration + waiting list  (wiki: registration, #33, #74)
--     Two independent state machines, so the waiting list is its own table.
--     Attendance kept as check-in columns here, not a separate table (open).
--     A registrant is either an account holder or an external attendee (#53).
-- ---------------------------------------------------------------------------
create table registration (
  registration_id         bigint generated always as identity primary key,
  registration_reference  uuid not null default gen_random_uuid(),
  event_id                bigint not null references event (event_id) on delete cascade,
  session_id              bigint references session (session_id) on delete cascade,
  attendee_user_account_id bigint references user_account (user_account_id) on delete cascade,
  attendee_name           text,
  attendee_email          text,
  status                  text not null default 'Registered',
  checked_in_at           timestamptz,
  checked_in_method       text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint registration_reference_uniq unique (registration_reference),
  constraint registration_status_chk
    check (status in ('Registered', 'Waitlisted', 'Cancelled', 'Withdrawn', 'Attended', 'No Show')),
  constraint registration_checkin_chk
    check ((checked_in_at is null) = (checked_in_method is null)),
  constraint registration_attendee_identity_chk
    check ((attendee_user_account_id is not null
            and attendee_name is null and attendee_email is null)
        or (attendee_user_account_id is null
            and attendee_name is not null and attendee_email is not null))
);

-- Attendees are external users and onboarding is outside the brief (#53), so
-- there is no user_account to point at: an attendee gives a name and an email
-- and nothing else. Hence a nullable attendee_user_account_id and the identity
-- check, which keeps every other writer of this table unaffected.
-- registration_reference exists because the application mints identity before
-- the row exists, and a bigint generated always as identity cannot carry a
-- value the caller chose; it doubles as the reference an attendee can quote.
-- Applied by migrations/20260907132238_attendee_registration_identity.sql.

-- One live registration per attendee per event (or per session where scoped):
create unique index registration_unique_per_event_uidx
  on registration (event_id, attendee_user_account_id)
  where session_id is null and status not in ('Cancelled', 'Withdrawn');

create unique index registration_unique_per_session_uidx
  on registration (session_id, attendee_user_account_id)
  where session_id is not null and status not in ('Cancelled', 'Withdrawn');

-- The same rule keyed by the lower-cased email, for the account-less attendee.
-- 'Registered' rather than the broader exclusion above: Release 1 has no
-- waiting list and no check-in, so it is the only live state this path can
-- produce. Widen it when waitlisting lands.
create unique index registration_one_live_per_attendee_email_uidx
  on registration (event_id, lower(attendee_email))
  where attendee_email is not null and status = 'Registered';

create table waiting_list_entry (
  waiting_list_entry_id bigint generated always as identity primary key,
  registration_id       bigint not null unique references registration (registration_id) on delete cascade,
  position              integer not null check (position > 0),
  status                text not null default 'Waiting',
  offered_at            timestamptz,
  expires_at            timestamptz,
  constraint waiting_list_entry_status_chk
    check (status in ('Waiting', 'Offered', 'Accepted', 'Expired', 'Withdrawn'))
);

-- ---------------------------------------------------------------------------
-- 15. Change request  (wiki: change-request)
-- ---------------------------------------------------------------------------
create table change_request (
  change_request_id          bigint generated always as identity primary key,
  event_id                   bigint not null references event (event_id) on delete cascade,
  requesting_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  requested_change_description text not null,
  significance_flag          boolean not null default false,
  fields_affected            text,
  coordinator_decision       text,
  impact_assessment          text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- significance_flag, fields_affected and coordinator_decision above are
-- retained but stop being authoritative once a request has change_request_item
-- rows (added 2026-09-09, D4, #104): a request may span several fields, each
-- independently accepted or rejected, with a reason on a rejected field.
create table change_request_item (
  change_request_item_id bigint generated always as identity primary key,
  change_request_id      bigint not null references change_request (change_request_id) on delete cascade,
  field_name              text not null,
  requested_value         text,
  significance_flag       boolean not null default false,
  decision                text not null default 'Pending',
  decision_reason         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint change_request_item_decision_chk
    check (decision in ('Pending', 'Accepted', 'Rejected')),
  constraint change_request_item_reason_chk
    check (decision <> 'Rejected' or decision_reason is not null)
);

-- ---------------------------------------------------------------------------
-- 16. Notification  (wiki: notification, brief §6)
--     One nullable FK per related-object type, so the DB can enforce integrity
--     on the six types §6 actually names.
-- ---------------------------------------------------------------------------
create table notification (
  notification_id             bigint generated always as identity primary key,
  recipient_user_account_id   bigint not null references user_account (user_account_id) on delete cascade,
  trigger_scenario            text not null,
  channel                     text not null default 'email',
  message_content             text,
  status                      text not null default 'Pending',
  related_event_id            bigint references event (event_id) on delete cascade,
  related_event_request_id    bigint references event_request (event_request_id) on delete cascade,
  related_booking_id          bigint references booking (booking_id) on delete cascade,
  related_equipment_reservation_id bigint references equipment_reservation (equipment_reservation_id) on delete cascade,
  related_registration_id     bigint references registration (registration_id) on delete cascade,
  related_change_request_id   bigint references change_request (change_request_id) on delete cascade,
  created_at                  timestamptz not null default now(),
  sent_at                     timestamptz,
  constraint notification_status_chk
    check (status in ('Pending', 'Sent', 'Failed', 'Read')),
  constraint notification_sent_at_chk
    check (status <> 'Sent' or sent_at is not null)
);

-- ---------------------------------------------------------------------------
-- 17. Audit record  (wiki: audit-record, #14)
--     Polymorphic (entity_type, entity_id) — deliberately no FK, because
--     whether every object type carries its own trail is unresolved.
-- ---------------------------------------------------------------------------
create table audit_record (
  audit_record_id       bigint generated always as identity primary key,
  actor_user_account_id bigint references user_account (user_account_id) on delete set null,
  entity_type           text not null,
  entity_id             bigint not null,
  action                text,         -- Activity History entries
  field_changed         text,         -- Change History entries
  old_value             text,
  new_value             text,
  occurred_at           timestamptz not null default now(),
  constraint audit_record_kind_chk
    check (action is not null or field_changed is not null)
);

-- ---------------------------------------------------------------------------
-- Indexes on foreign keys (Postgres does not create these automatically)
-- ---------------------------------------------------------------------------
create index user_account_client_org_idx        on user_account (client_organisation_id);
create index user_account_role_role_idx         on user_account_role (role_id);
create index event_request_user_idx             on event_request (requesting_user_account_id);
create index event_request_coordinator_idx      on event_request (assigned_coordinator_user_account_id);
create index event_request_client_org_idx       on event_request (client_organisation_id);
create index event_client_org_idx               on event (client_organisation_id);
create index event_coordinator_idx              on event (assigned_coordinator_user_account_id);
create index event_organiser_idx                on event (owning_organiser_user_account_id);
create index event_reused_from_idx              on event (reused_from_event_id);
create index event_status_idx                   on event (status);
create index event_comment_event_idx            on event_comment (event_id);
create index event_comment_author_idx           on event_comment (author_user_account_id);
create index event_comment_parent_idx           on event_comment (parent_comment_id);
create index supporting_document_event_idx      on supporting_document (event_id);
create index supporting_document_uploader_idx   on supporting_document (uploaded_by_user_account_id);
create index session_event_idx                  on session (event_id);
create index venue_supported_layout_layout_idx  on venue_supported_layout (room_layout_id);
create index booking_venue_idx                  on booking (venue_id);
create index booking_event_idx                  on booking (event_id);
create index booking_session_idx                on booking (session_id);
create index booking_requester_idx              on booking (requested_by_user_account_id);
create index booking_decider_idx                on booking (decided_by_user_account_id);
create index booking_alt_venue_idx              on booking (suggested_alternative_venue_id);
create index booking_status_idx                 on booking (status);
create index booking_slot_booking_idx           on booking_slot (booking_id);
create index booking_slot_date_idx              on booking_slot (slot_date, slot);
create index equipment_reservation_event_idx    on equipment_reservation (event_id);
create index equipment_reservation_session_idx  on equipment_reservation (session_id);
create index equipment_reservation_reviewer_idx on equipment_reservation (reviewed_by_user_account_id);
create index equipment_line_reservation_idx     on equipment_reservation_line (equipment_reservation_id);
create index equipment_line_item_idx            on equipment_reservation_line (equipment_item_id);
create index support_request_event_idx          on support_request (event_id);
create index support_request_assignment_user_idx on support_request_assignment (technical_support_user_account_id);
create index registration_event_idx             on registration (event_id);
create index registration_session_idx           on registration (session_id);
create index registration_attendee_idx          on registration (attendee_user_account_id);
create index change_request_event_idx           on change_request (event_id);
create index change_request_requester_idx       on change_request (requesting_user_account_id);
create index change_request_item_change_request_idx on change_request_item (change_request_id);
create index notification_recipient_idx         on notification (recipient_user_account_id);
create index notification_status_idx            on notification (status) where status = 'Pending';
create index audit_record_entity_idx            on audit_record (entity_type, entity_id);
create index audit_record_actor_idx             on audit_record (actor_user_account_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'client_organisation', 'user_account', 'event_request', 'event', 'session',
    'venue', 'booking', 'equipment_item', 'equipment_reservation',
    'support_request', 'registration', 'change_request', 'change_request_item'
  ]
  loop
    execute format(
      'create trigger %I_set_updated_at
         before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled everywhere, no policies yet.
-- Supabase default-denies once RLS is on. Policies depend on the role model
-- (#56), which is an open team decision — do not ship without writing them.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'client_organisation', 'role', 'user_account', 'user_account_role',
    'event_request', 'event', 'event_essential_arrangement', 'event_comment',
    'supporting_document', 'session', 'venue', 'room_layout',
    'venue_supported_layout', 'booking', 'booking_slot', 'equipment_item',
    'equipment_reservation', 'equipment_reservation_line', 'support_request',
    'support_request_assignment', 'registration', 'waiting_list_entry',
    'change_request', 'change_request_item', 'notification', 'audit_record'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed: reference data implied by the role model and slot model
-- ---------------------------------------------------------------------------
insert into role (role_name) values
  ('Event Organiser'),
  ('Event Coordinator'),
  ('Event Operations Manager'),
  ('Venue Staff'),
  ('Technical Support Staff'),
  ('Attendee')
on conflict (role_name) do nothing;

commit;