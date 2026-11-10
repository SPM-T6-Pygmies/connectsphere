workspace "ConnectSphere — After Week 7 (main @ a8fa311a)" "Snapshot lens. The whole system as main stands now (a8fa311a), compared with 05-before-week-7 (9e8eb610, 2026-10-01). Elements added since that commit carry the Week7 tag and a heavier border. L1, L2 and L3 rebuilt from the code." {

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: ../../spm-brain
    #   Brief         spm-brain/raw/Customer Brief no. 1.md
    #   Clarified by  spm-brain/wiki/concepts/*.md   ("#N" = IS212 discussion answer no.)
    #   Backlog       Linear team "SPM - IS212" — projects Users, Events,
    #                 Registration & Attendees, Venues, Equipment, Notifications, Reporting
    # Target shape:   ../../docs/ARCHITECTURE.md  (Ports & Adapters / Hexagonal)
    # Domain terms:   ../GLOSSARY.md
    #
    # SNAPSHOT — main @ a8fa311a. Companion of ../05-before-week-7 (main @ 9e8eb610,
    # 2026-10-01). Built from 05 by adding what src/core, src/adapters, src/app and
    # src/composition gained since, read from the code, and correcting what 05 got
    # stale. Every element added since 9e8eb610 carries the "Week7" tag (heavier
    # border), so the two workspaces diff by eye. Not tagged: existing elements whose
    # description was only brought up to date (ports that gained methods, use cases
    # that gained dependencies).
    #
    # Fragments were drafted per area by reading the code at both commits, then merged
    # and checked with the Structurizr validator. They were not exhaustively
    # cross-checked: the heavily wired use cases (announcers, readiness, booking)
    # have the most room for a missing or surplus edge. [?] marks the guesses.
    #
    # Facts that changed since 05, found in the code:
    #  - The Operations Manager role is now the Event Coordinator Lead (staff-member.ts,
    #    supabase/seed.sql); its pages moved from src/app/staff/ops to src/app/staff/lead.
    #  - Notifications are delivered through Novu (in-app inbox for staff, email for
    #    Attendees). Novu is the only delivery system drawn: the separate Email Delivery
    #    Service of 05 is gone, because email now leaves through Novu.
    #  - Venues, Equipment, Safety checks and Change requests exist as modules. Reporting
    #    is still a placeholder.
    #
    # Not drawn: the Connections worked example from docs/ARCHITECTURE.md (connection,
    # member, SendConnectionRequestUseCase, /connections). It is teaching material, not
    # the event domain, and no migration creates its tables.
    #
    # L1 modelling decisions
    #  - No external system integrations are in scope (#79, #12). The incumbent tooling
    #    (email, spreadsheets, shared calendars, messaging apps, manual documents) is
    #    REPLACED, not integrated — so it is deliberately not drawn as an external system.
    #  - Contracts and payments (#24), the coordinator-assignment SOP (#93) and the
    #    post-event equipment health checklist (#85) are handled outside the system:
    #    real-world processes, no software system to draw.
    #  - In-app notification return edges are in the model but excluded from the "context"
    #    view: five extra edges would not survive at L1. They are modelled because they are
    #    the handoffs the journey workspaces sequence (see 02-workflow).
    #
    # L2 modelling decisions
    #  - One web container, not a browser/server pair. With the App Router the UI and the
    #    server are one deployable and one codebase; splitting them would draw a network
    #    hop that does not exist for a Server Component read.
    #  - The containers are not wrapped in a "Shared Platform" group. CONVENTIONS.md asks
    #    every container to belong to a module group, but all three serve every module, so
    #    the group would be a box drawn around everything. Module grouping happens at L3,
    #    where it discriminates.
    #  - "Authentication Service" is Supabase Auth with email + password, as built for
    #    SPM-13/14. The customer has still not chosen a method (#62), so only the
    #    mechanism carries [?], not the container.
    #  - Novu Cloud is the one notification system, carrying in-app and email. There is no
    #    separate email system at L1 or L2.
    #
    # L3 modelling decisions
    #  - Components are the Ports & Adapters rings from docs/ARCHITECTURE.md: driving
    #    adapter, use case, domain, port, driven adapter, plus the composition root.
    #    Tag = ring (drives colour), group = module (drives the boundary). The Dependency
    #    Rule is then legible as colour flowing inward.
    #  - An adapter is drawn pointing AT the port it satisfies ("Implements."). That arrow
    #    is dependency inversion made visible: compilation points inward even though
    #    control, at runtime, flows outward through it.
    #  - Modules with components are the ones with code behind them: Identity & Access,
    #    Event Requests, Registration. Venues, Equipment and Reporting have tables and (for
    #    the first two) wireframe pages but no core, so each stays a single [?] placeholder
    #    naming the brief step it will come from, without inventing its use cases.
    #  - Event Requests is one module drawn as four groups, one per staff workspace that
    #    drives it plus what the three share. Nineteen use cases in one boundary do not lay
    #    out. The per-module views ("components-*") are the readable way in; "components"
    #    is the whole web application at once.
    #  - Composition-root and in-memory-adapter edges are modelled but excluded from the
    #    "components" view: thirty-five extra arrows that all say "wiring". They are drawn
    #    in the sprint lenses.
    # =========================================================================

    model {

        !identifiers hierarchical

        # ---------------------------------------------------------------------
        # ACTORS — the five briefed roles (brief s3), plus one from clarification
        # ---------------------------------------------------------------------

        group "ConnectSphere (internal)" {

            coordinator = person "Event Coordinator" "Assigned owner of an event. Reviews requests, raises venue + equipment needs, tracks readiness, confirms."

            venue_staff = person "Venue Staff" "Owns the venue catalogue and availability. Decides booking requests, blocks venues, prepares the room."

            tech_staff = person "Technical Support Staff" "Owns the equipment catalogue. Checks availability, reserves equipment, supports events on site."

            # Absent from the brief's role table, feature list and 14-step process, and
            # established by clarification (#73 assigns, #93 SOP outside the system, #94
            # reassignment). The [?] was dropped on 2026-09-27: it is a distinct system role,
            # a row in the role table seeded as "Event Operations Manager" (supabase/seed.sql)
            # with its own operations_* RPCs.
            safety_officer = person "Safety Officer" "Checks each event's venues and equipment before it can be confirmed, and records Approved or Rejected. Added in week 7; not in 05."

            ops_manager = person "Event Coordinator Lead" "Assigns and reassigns Event Coordinators, and sees their workload. Was the Event Operations Manager in 05; renamed in staff-member.ts. SOP kept outside the system."
        }

        group "Client & participants (external)" {

            organiser = person "Event Organiser" "Client representative. Submits the event request, supplies requirements, requests changes."

            attendee = person "Attendee" "Participant. Registers for a confirmed event with a name and email, no account; withdraws by reference."
        }

        # ---------------------------------------------------------------------
        # SYSTEM UNDER FOCUS — L2 containers, L3 components
        # ---------------------------------------------------------------------

        epvbs = softwareSystem "Event Planning and Venue Booking System" "Single platform for event requests, venue booking, equipment, registration, changes and reporting." {

            web = container "Web Application" "Serves every role's pages and actions, and hosts the application core. Ports & Adapters inside." "Next.js 16.3 App Router / React 19.2" {

                # =============================================================
                # SHARED PLATFORM — touched by every module
                # =============================================================

                group "Shared Platform" {

                    composition_root = component "Composition Root" "Wires every port to an adapter. The only module that imports both sides." "src/composition/container.ts" "Composition Root"

                    clock_port = component "Clock" "Port. Supplies the current time, so a use case can be tested without freezing globals." "src/core/ports/outbound" "Port"

                    # Only logout writes through the port. coordinator_decide_event_request
                    # writes its own audit_record row inside the RPC's transaction.
                    audit_logger_port = component "AuditLogger" "Port. Records who did what and when." "src/core/ports/outbound" "Port"

                    system_clock_ad = component "systemClock" "Adapter. The real clock." "src/adapters/outbound/system" "Driven Adapter"

                    supabase_audit_ad = component "SupabaseAuditLogger" "Adapter. Inserts audit_record rows as the service role." "src/adapters/outbound/supabase" "Driven Adapter"

                    # A real implementation of every port, not a mock — ARCHITECTURE.md s8.4.
                    # This is what lets the use-case tests run with no database and no server.
                    # AuditLogger is the one port without one: the logout test defines its own.
                    in_memory_ad = component "In-memory adapters" "Adapters. Map-backed stand-ins for the ports; the test suite plugs these in instead of Supabase." "src/adapters/outbound/in-memory" "Driven Adapter"
                }

                # =============================================================
                # IDENTITY & ACCESS   — Linear project "Users"
                # SPM-13 log in, SPM-14 log out, SPM-117 landing page, SPM-122 who is
                # signed in. Every staff page and action resolves its caller through
                # IdentifyStaffMember (getCurrentOrganiser / getCurrentCoordinator /
                # getStaffWorkspaces in the composition root); only the staff shell's
                # edge is drawn, to keep the one-to-everything wiring off the map.
                # =============================================================

                group "Identity & Access" {

                    login_ui = component "Login page + login action" "Driving adapter. Parses credentials, delegates, routes to the landing page." "src/app/auth/login" "Driving Adapter"

                    logout_ui = component "Logout action" "Driving adapter. Ends the session and returns to the login page." "src/app/auth/logout" "Driving Adapter"

                    # Talks to Supabase directly through src/lib/supabase, not through a
                    # use case: it only refreshes the cookie session and redirects.
                    session_mw_ui = component "Session middleware" "Driving adapter. Refreshes the session; sends /staff visitors without one to login." "src/middleware.ts" "Driving Adapter"

                    staff_shell_ui = component "Staff shell" "Driving adapter. Shows a staff page only to its own role, with that role's queue." "src/app/staff/staff-shell.tsx" "Driving Adapter"

                    login_uc = component "LoginUseCase" "Verifies credentials, opens a session, picks the landing page." "src/core/use-cases" "Use Case"

                    logout_uc = component "LogoutUseCase" "Ends the session and records the logout." "src/core/use-cases" "Use Case"

                    identify_staff_uc = component "IdentifyStaffMemberUseCase" "Resolves the signed-in staff member, their workspaces and context." "src/core/use-cases" "Use Case"

                    staff_member_e = component "staff-member" "Domain. Maps roles to workspaces, the landing page, and the Organiser and Coordinator contexts." "src/core/domain" "Domain"

                    auth_port = component "AuthPort" "Port. Logs in, reads the session, logs out." "src/core/ports/outbound" "Port"

                    user_repository_port = component "UserRepository" "Port. Finds the account and roles behind an auth user." "src/core/ports/outbound" "Port"

                    supabase_auth_ad = component "SupabaseAuthAdapter" "Adapter. Supabase Auth, cookie sessions via @supabase/ssr." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_user_ad = component "SupabaseUserRepository" "Adapter. Account and role rows, read as the service role." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # EVENT REQUESTS   — Linear project "Events"
                # One module, drawn as four groups: one per staff workspace that
                # drives it (src/app/staff/{requester,ops,coordinator}), plus the
                # domain, ports and adapters the three share. In one group the
                # nineteen use cases would not lay out legibly.
                # Form input is checked at the edge by zod schemas in
                # src/adapters/inbound; they belong to the actions that import them.
                # =============================================================

                group "Event Requests: shared" {

                    event_request_e = component "event-request" "Domain. Draft, Submitted, Under Review, Approved or Rejected; who may see, edit, assign and decide." "src/core/domain" "Domain"

                    event_request_repository_port = component "EventRequestRepository" "Port. Lists, finds and saves requests; records assignment, reassignment and decisions; reads the times and arrangements of the event a request became." "src/core/ports/outbound" "Port"

                    user_account_repository_port = component "UserAccountRepository" "Port. Names accounts; lists an organisation's Organisers and every Coordinator." "src/core/ports/outbound" "Port"

                    client_org_repository_port = component "ClientOrganisationRepository" "Port. Names client organisations." "src/core/ports/outbound" "Port"

                    supabase_event_requests_ad = component "SupabaseEventRequestRepository" "Adapter. Event request RPCs; snake_case columns and ISO dates stop here." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_user_accounts_ad = component "SupabaseUserAccountRepository" "Adapter. Account name, Organiser and Coordinator RPCs." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_client_orgs_ad = component "SupabaseClientOrganisationRepository" "Adapter. The organisation-name RPC." "src/adapters/outbound/supabase" "Driven Adapter"
                    clarification_message_e = component "clarification-message" "Domain. Which clarification is still open, and which one a reply resolves." "src/core/domain" "Domain"

                    clarification_thread_port = component "ClarificationThreadRepository" "Port. Reads, appends to and resolves a request's clarification thread." "src/core/ports/outbound" "Port"

                    supabase_clarification_ad = component "SupabaseClarificationThreadRepository" "Adapter. The clarification-thread RPCs." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # SPM-38 draft, SPM-31 submit, SPM-39 organisation view + reassign (AC5).
                group "Event Requests: Organiser" {

                    request_form_ui = component "New request form + actions" "Driving adapter. Save draft, submit and discard, as the signed-in Organiser." "src/app/staff/requester/new" "Driving Adapter"

                    my_requests_ui = component "My requests + request detail" "Driving adapter. The Organiser's own requests, and one request." "src/app/staff/requester" "Driving Adapter"

                    org_requests_ui = component "Organisation requests + reassign" "Driving adapter. The organisation's requests; hands one to another Organiser." "src/app/staff/requester/organisation" "Driving Adapter"

                    save_draft_uc = component "SaveEventRequestDraftUseCase" "Creates or updates the Organiser's Draft." "src/core/use-cases" "Use Case"

                    # The mandatory field set (name, date, start, end, attendance) is still a
                    # placeholder in code: "propose an appropriate set" (#72) is unsettled.
                    submit_request_uc = component "SubmitEventRequestUseCase" "Submits a new request or a Draft once complete. Mandatory field set undecided [?]." "src/core/use-cases" "Use Case"

                    discard_draft_uc = component "DiscardEventRequestDraftUseCase" "Deletes the Organiser's own Draft." "src/core/use-cases" "Use Case"

                    view_my_requests_uc = component "ViewMyEventRequestsUseCase" "Lists the requests the Organiser raised. Thin read." "src/core/use-cases" "Use Case"

                    view_organiser_request_uc = component "ViewOrganiserEventRequestUseCase" "Reads one request for an Organiser in the same organisation." "src/core/use-cases" "Use Case"

                    view_org_requests_uc = component "ViewOrganisationEventRequestsUseCase" "Lists the organisation's requests, each with edit rights." "src/core/use-cases" "Use Case"

                    change_organiser_uc = component "ChangeEventOrganiserUseCase" "Hands a request to another Organiser in the organisation." "src/core/use-cases" "Use Case"

                    list_org_organisers_uc = component "ListOrganisationOrganisersUseCase" "Lists who a request can be handed to. Thin read." "src/core/use-cases" "Use Case"
                    post_clarification_uc = component "PostClarificationMessageUseCase" "Posts the Organiser's reply to a clarification." "src/core/use-cases" "Use Case"
                }

                # SPM-29 view requests, SPM-130 assign a Coordinator.
                group "Event Requests: Operations" {

                    ops_console_ui = component "Assignment console + assign action" "Driving adapter. One request and the Coordinator picker, for the Event Coordinator Lead." "src/app/staff/lead" "Driving Adapter"

                    view_all_requests_uc = component "ViewAllEventRequestsUseCase" "Lists every request except Drafts, as unassigned or assigned." "src/core/use-cases" "Use Case"

                    view_ops_request_uc = component "ViewOperationsEventRequestUseCase" "Reads one request and whether a Coordinator can be assigned." "src/core/use-cases" "Use Case"

                    view_all_coordinators_uc = component "ViewAllEventCoordinatorsUseCase" "Lists every Coordinator. Thin read." "src/core/use-cases" "Use Case"

                    assign_coordinator_uc = component "AssignEventCoordinatorUseCase" "Attaches or replaces the Coordinator. Immediate, no acceptance step. Notifies the Coordinator and the Organiser." "src/core/use-cases" "Use Case"

                    lead_workload_ui = component "Coordinator workload" "Driving adapter. The Event Coordinator Lead sees each Coordinator's open requests and active events." "src/app/staff/lead/coordinators" "Driving Adapter,Week7"

                    lead_event_ui = component "Lead event page + reassign action" "Driving adapter. The Lead opens an active event and hands it to another Coordinator." "src/app/staff/lead/events/[id]" "Driving Adapter,Week7"

                    view_coordinator_workloads_uc = component "ViewCoordinatorWorkloadsUseCase" "Lists every Coordinator with their open requests and active events." "src/core/use-cases" "Use Case,Week7"

                    view_lead_event_uc = component "ViewLeadEventUseCase" "Reads one event for the Lead, with its times and whether it can still be reassigned." "src/core/use-cases" "Use Case,Week7"

                    reassign_event_coordinator_uc = component "ReassignEventCoordinatorUseCase" "Hands an active event to another Coordinator at once and notifies the new Coordinator and the Organiser." "src/core/use-cases" "Use Case,Week7"

                    coordinator_workload_e = component "coordinator-workload" "Domain. Which events are still active, each Coordinator's workload, and that only an active event can be reassigned." "src/core/domain" "Domain,Week7"

                    lead_event_repository_port = component "LeadEventRepository" "Port. Lists every event, finds one with its times, and records a reassignment, for the Lead." "src/core/ports/outbound" "Port,Week7"

                    supabase_lead_events_ad = component "SupabaseLeadEventRepository" "Adapter. The lead_events, lead_event and lead_reassign_event_coordinator RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                # SPM-121 queue, SPM-32 view a request, SPM-34 approve or reject.
                group "Event Requests: Coordinator" {

                    coord_requests_ui = component "Coordinator queue, archive + request detail" "Driving adapter. Assigned requests and the approve or reject form." "src/app/staff/coordinator" "Driving Adapter"

                    coord_events_ui = component "My events" "Driving adapter. The events the Coordinator is running." "src/app/staff/coordinator/events" "Driving Adapter"

                    view_assigned_requests_uc = component "ViewAssignedEventRequestsUseCase" "Lists requests assigned to the caller and awaiting review." "src/core/use-cases" "Use Case"

                    view_archived_uc = component "ViewArchivedEventRequestsUseCase" "Lists the caller's rejected and withdrawn requests." "src/core/use-cases" "Use Case"

                    view_assigned_request_uc = component "ViewAssignedEventRequestUseCase" "Reads one request, only for the Coordinator assigned to it." "src/core/use-cases" "Use Case"

                    decide_request_uc = component "DecideEventRequestUseCase" "Approves or rejects. Approval opens the Event in Planning." "src/core/use-cases" "Use Case"

                    view_assigned_events_uc = component "ViewAssignedEventsUseCase" "Lists the caller's events, whatever their status. Thin read." "src/core/use-cases" "Use Case"

                    coordinator_event_repository_port = component "CoordinatorEventRepository" "Port. Lists, finds and changes the events a Coordinator is assigned to: details, facilities, registration, confirm, complete and cancel." "src/core/ports/outbound" "Port"

                    supabase_coord_events_ad = component "SupabaseCoordinatorEventRepository" "Adapter. The coordinator_events, coordinator_event and coordinator_* event-change RPCs." "src/adapters/outbound/supabase" "Driven Adapter"
                    request_clarification_uc = component "RequestClarificationUseCase" "Returns a request to the Organiser with a question." "src/core/use-cases" "Use Case"

                    post_coord_clarification_uc = component "PostCoordinatorClarificationMessageUseCase" "Posts the Coordinator's message on the thread." "src/core/use-cases" "Use Case"

                    resolve_clarification_uc = component "ResolveClarificationThreadUseCase" "Resolves one clarification; the last one puts the request back Under Review." "src/core/use-cases" "Use Case"
                    # Withdrawable from Submitted, Under Review or Returned.
                    withdraw_request_uc = component "WithdrawEventRequestUseCase" "Records that the Organiser withdrew a request." "src/core/use-cases" "Use Case"


                    coord_event_detail_ui = component "Event page + confirm, edit, registration, complete and cancel actions" "Driving adapter. One event for its Coordinator: readiness, ordinary details, registration settings, and the lifecycle buttons." "src/app/staff/coordinator/events/[id]" "Driving Adapter,Week7"

                    view_coordinator_event_uc = component "ViewCoordinatorEventUseCase" "Reads one event for its assigned Coordinator with its readiness, confirmation state and whether it can be completed or cancelled." "src/core/use-cases" "Use Case,Week7"

                    find_assigned_event_by_request_uc = component "FindAssignedEventByRequestUseCase" "Finds the caller's event that an approved request became. Thin read." "src/core/use-cases" "Use Case,Week7"
                }

                # =============================================================
                # REGISTRATION   — Linear project "Registration & Attendees"
                # SPM-24 register, SPM-28 withdraw, SPM-79 browse, SPM-81..86 rules.
                # Attendees have no account: a name, an email and a reference link.
                # Waiting list is out of Release 1, so no promotion path is modelled.
                # =============================================================

                group "Registration" {

                    events_browse_ui = component "Event list + event page + register action" "Driving adapter. Browse open events and register for one." "src/app/events" "Driving Adapter"

                    registration_page_ui = component "Registration page + withdraw action" "Driving adapter. The reference link: view the registration, withdraw." "src/app/registrations/[reference]" "Driving Adapter"

                    list_open_events_uc = component "ListEventsOpenForRegistrationUseCase" "Lists the events an Attendee can register for now." "src/core/use-cases" "Use Case"

                    view_event_for_registration_uc = component "ViewEventForRegistrationUseCase" "Reads one event, refused unless open for registration." "src/core/use-cases" "Use Case"

                    register_uc = component "RegisterForEventUseCase" "Registers an Attendee when the event is open and not yet full." "src/core/use-cases" "Use Case"

                    view_registration_uc = component "ViewRegistrationUseCase" "Resolves a registration reference." "src/core/use-cases" "Use Case"

                    withdraw_uc = component "WithdrawRegistrationUseCase" "Withdraws a registration by its reference." "src/core/use-cases" "Use Case"

                    event_e = component "event" "Domain. Open for registration, full, and whether withdrawal is still allowed; an event's times are ranges on dates." "src/core/domain" "Domain"

                    registration_e = component "registration" "Domain. One live registration per email; withdrawn is final. No waiting list." "src/core/domain" "Domain"

                    attendee_e = component "attendee" "Domain. A non-blank name and a normalised email." "src/core/domain" "Domain"

                    event_catalogue_port = component "EventCatalogue" "Port. Lists Confirmed events and finds one." "src/core/ports/outbound" "Port"

                    registration_repository_port = component "RegistrationRepository" "Port. Counts places, finds and saves registrations, records withdrawals, lists an event's registered Attendees." "src/core/ports/outbound" "Port"

                    supabase_event_catalogue_ad = component "SupabaseEventCatalogue" "Adapter. Event rows readable by anonymous visitors." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_registrations_ad = component "SupabaseRegistrationRepository" "Adapter. Registration RPCs and the places-taken count." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # NOTIFICATIONS   — Linear project "Notifications"
                # The Notifier port's only method (connectionRequested) serves the
                # Connections worked example, which this map does not draw. No
                # event-domain use case notifies anyone yet, and every staff inbox
                # renders wireframe fixtures (src/lib/wireframe/notifications.ts).
                # =============================================================

                group "Notifications" {

                    notifier_port = component "Notifier" "Port. Announces what a role needs to know: 24 methods, one per notice (connectionRequested plus 23 event-domain notices). Channels configurable per type [?]." "src/core/ports/outbound" "Port"

                    logging_notifier_ad = component "LoggingNotifier" "Adapter. Writes to the log; the fallback when Novu is not configured." "src/adapters/outbound/logging" "Driven Adapter"

                    announce_equipment_attention_uc = component "EquipmentAttentionAnnouncer" "Use case. Tells every Technical Support member when a coordinator adds, edits, deletes or reschedules an equipment line." "src/core/use-cases" "Use Case,Week7"

                    announce_equipment_outcome_uc = component "EquipmentOutcomeAnnouncer" "Use case. Tells the event's Coordinator the outcome of every line once Technical Support has finished deciding." "src/core/use-cases" "Use Case,Week7"

                    announce_attendee_change_uc = component "AttendeeChangeAnnouncer" "Use case. Emails each Registered attendee when their event is rescheduled or cancelled, counting sent and failed." "src/core/use-cases" "Use Case,Week7"

                    announce_safety_check_entry_uc = component "SafetyCheckEntryAnnouncer" "Use case. Tells every Safety Officer when an event joins their Awaiting check list." "src/core/use-cases" "Use Case,Week7"

                    notify_expired_holds_uc = component "NotifyExpiredHoldsUseCase" "Claims holds that have expired and tells each event's Coordinator." "src/core/use-cases" "Use Case,Week7"

                    expired_hold_notices_port = component "ExpiredHoldNotices" "Port. Claims the unconfirmed holds that have lapsed, each once." "src/core/ports/outbound" "Port,Week7"

                    equipment_notice_directory_port = component "EquipmentNoticeDirectory" "Port. Names the Technical Support staff, and an event's assigned Coordinator, to notify." "src/core/ports/outbound" "Port,Week7"

                    supabase_expired_hold_notices_ad = component "SupabaseExpiredHoldNotices" "Adapter. The claim_expired_hold_notices RPC, as the service role." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_equipment_notice_directory_ad = component "SupabaseEquipmentNoticeDirectory" "Adapter. The technical_support_staff_ids and event_assigned_coordinator_id RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_recording_notifier_ad = component "SupabaseRecordingNotifier" "Adapter. Records each notice in the notification table, then hands it to the notifier it wraps." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    novu_notifier_ad = component "NovuNotifier" "Adapter. Triggers the Novu workflow for each notice; the Connections request is only logged." "src/adapters/outbound/novu" "Driven Adapter,Week7"

                    novu_subscriber_hash_ad = component "subscriberHash" "Adapter. Signs a subscriber id with the Novu secret key so the browser inbox is accepted." "src/adapters/outbound/novu/subscriber-hash.ts" "Driven Adapter,Week7"

                    novu_workflows_ad = component "Novu workflows" "Adapters. 20 code-first Novu workflows, 19 in-app and one attendee email, that Novu runs." "src/adapters/outbound/novu/workflows" "Driven Adapter,Week7"

                    notification_content_ad = component "Notification content" "Adapters. 22 builders of the in-app and email wording for each notice." "src/adapters/outbound/notification-content" "Driven Adapter,Week7"

                    novu_bridge_ui = component "Novu bridge route" "Driving adapter. Serves the workflow definitions Novu Cloud calls back for." "src/app/api/novu/route.ts" "Driving Adapter,Week7"

                    staff_inbox_ui = component "Staff notifications inbox" "Driving adapter. Browser inbox, read, archive and channel preferences, read straight from Novu." "src/components/staff-notifications.tsx" "Driving Adapter,Week7"
                }

                # =============================================================
                # MODULES WITH NO CORE YET — named, not designed (Reporting).
                # Their tables exist in the initial schema and the venue and technical
                # staff pages render wireframe fixtures (src/lib/wireframe), but no use
                # case, port or adapter reads them. Replace a placeholder with real
                # components when its tickets are built.
                # =============================================================

                group "Venues: catalogue" {

                    # SPM-42 maintain the catalogue (Venue Staff), SPM-44 search it (Coordinator).
                    venue_catalogue_ui = component "Venue catalogue pages + actions" "Driving adapter. Venue Staff list, view, add and edit venues." "src/app/staff/venue/catalogue" "Driving Adapter"

                    venue_search_ui = component "Venue search" "Driving adapter. The Coordinator narrows the catalogue by date, time, capacity, layout, facilities and accessibility." "src/app/staff/coordinator/venues" "Driving Adapter"

                    list_venues_uc = component "ListVenuesUseCase" "Lists the catalogue. Thin read." "src/core/use-cases" "Use Case"

                    view_venue_uc = component "ViewVenueUseCase" "Reads one venue; refused if it does not exist. Thin read." "src/core/use-cases" "Use Case"

                    create_venue_uc = component "CreateVenueUseCase" "Adds a venue. Venue Staff only." "src/core/use-cases" "Use Case"

                    update_venue_uc = component "UpdateVenueUseCase" "Revises a venue, locks setup and turnaround once set, flags the live bookings the edit no longer fits and tells their Coordinators. Venue Staff only." "src/core/use-cases" "Use Case"

                    search_venues_uc = component "SearchVenuesUseCase" "Lists the venues that fit the criteria and are free in the window, with the reason any other was left out." "src/core/use-cases" "Use Case"

                    venue_e = component "venue" "Domain. Every attribute mandatory: opening hours, setup and turnaround, and layouts that seat no more than the venue; only Venue Staff maintain the catalogue." "src/core/domain" "Domain"

                    venue_search_e = component "venue-search" "Domain. Refuses an unanswerable search; names the filter that excluded a venue, closed hours included; compares padded bookings. Never a suitability verdict (#83)." "src/core/domain" "Domain"

                    venue_options_e = component "venue-options" "Domain. The fixed facility and accessibility values, so a request and a venue match by equality." "src/core/domain" "Domain"

                    venue_catalogue_port = component "VenueCatalogue" "Port. Lists, finds, adds and revises venues." "src/core/ports/outbound" "Port"

                    venue_availability_port = component "VenueAvailability" "Port. The spans during which a venue is held by a live booking or an in-force block, each marked as which." "src/core/ports/outbound" "Port"

                    supabase_venue_catalogue_ad = component "SupabaseVenueCatalogue" "Adapter. The venue_catalogue, venue_catalogue_create and venue_catalogue_update RPCs." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_venue_availability_ad = component "SupabaseVenueAvailability" "Adapter. The venue_busy_intervals RPC, returning each interval's kind (booking or block)." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                group "Venues: booking" {

                    venue_booking_ui = component "Venue booking tab + actions" "Driving adapter. The assigned Coordinator picks a venue, requests, re-requests, re-lays out, cancels a booking or clears its flag." "src/app/staff/coordinator/events/[id]/venue-booking" "Driving Adapter,Week7"

                    booking_review_ui = component "Booking request review pages + actions" "Driving adapter. Venue Staff list booking requests by section, read one beside its venue, and approve, hold or reject it." "src/app/staff/venue" "Driving Adapter,Week7"

                    view_venue_booking_options_uc = component "ViewVenueBookingOptionsUseCase" "Use case. Reads the event, the venues with their suitability, the event's bookings and their flags, and a re-request draft." "src/core/use-cases" "Use Case,Week7"

                    submit_venue_booking_request_uc = component "SubmitVenueBookingRequestUseCase" "Use case. The assigned Coordinator requests a venue for the event's dates; Venue Staff are told." "src/core/use-cases" "Use Case,Week7"

                    change_booking_room_layout_uc = component "ChangeBookingRoomLayoutUseCase" "Use case. Moves a pending booking request to another room layout, checking the layout's capacity." "src/core/use-cases" "Use Case,Week7"

                    cancel_venue_booking_uc = component "CancelVenueBookingUseCase" "Use case. The assigned Coordinator cancels a venue booking, freeing its slots; Venue Staff are told of a confirmed one." "src/core/use-cases" "Use Case,Week7"

                    clear_booking_flag_uc = component "ClearBookingFlagUseCase" "Use case. The assigned Coordinator clears the review flags on a booking that still fits." "src/core/use-cases" "Use Case,Week7"

                    review_booking_requests_uc = component "ReviewBookingRequestsUseCase" "Use case. Lists booking requests for Venue Staff by section and reads one beside its venue." "src/core/use-cases" "Use Case,Week7"

                    decide_booking_request_uc = component "DecideBookingRequestUseCase" "Use case. Venue Staff approve, hold or reject a booking request, or resolve a hold; the Coordinator is told." "src/core/use-cases" "Use Case,Week7"

                    booking_e = component "booking" "Domain. Builds a booking request, decides it, cancels it and checks its layout capacity and slot clashes, venue buffers included." "src/core/domain" "Domain,Week7"

                    booking_review_flag_e = component "booking-review-flag" "Domain. Which bookings a venue block flags, which flags a clear removes, and the re-request that replaces a flagged booking." "src/core/domain" "Domain,Week7"

                    venue_change_flag_e = component "venue-change-flag" "Domain. Which live bookings a venue edit no longer fits, with one reason per booking and source." "src/core/domain" "Domain,Week7"

                    venue_suitability_e = component "venue-suitability" "Domain. Advice on whether a venue fits an event's layout, capacity, accessibility and facilities; never blocks a request." "src/core/domain" "Domain,Week7"

                    booking_repository_port = component "BookingRepository" "Port. Lists an event's bookings and a venue's booked slots; submits, re-lays out and cancels a booking." "src/core/ports/outbound" "Port,Week7"

                    booking_review_repository_port = component "BookingReviewRepository" "Port. Venue Staff's booking requests: list by section, find one, record a decision or a hold resolution." "src/core/ports/outbound" "Port,Week7"

                    booking_flag_repository_port = component "BookingFlagRepository" "Port. The open review flags on an event's bookings, and clearing a booking's flags." "src/core/ports/outbound" "Port,Week7"

                    venue_change_review_port = component "VenueChangeReview" "Port. The bookings a venue edit is judged against, and storing the flags it raises." "src/core/ports/outbound" "Port,Week7"

                    venue_staff_directory_port = component "VenueStaffDirectory" "Port. The ids of all Venue Staff accounts, a system read." "src/core/ports/outbound" "Port,Week7"

                    supabase_booking_ad = component "SupabaseBookingRepository" "Adapter. The coordinator booking RPCs and the venue booked and blocked slot RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_booking_review_ad = component "SupabaseBookingReviewRepository" "Adapter. The venue_staff_bookings, venue_staff_decide_booking and venue_staff_resolve_hold RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_booking_flag_ad = component "SupabaseBookingFlagRepository" "Adapter. The coordinator_event_flags and coordinator_clear_booking_flags RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_venue_change_review_ad = component "SupabaseVenueChangeReview" "Adapter. The venue_change_bookings and venue_change_flag_bookings RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_venue_staff_directory_ad = component "SupabaseVenueStaffDirectory" "Adapter. The venue_staff_ids RPC, read as the service role." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Venues: calendar" {

                    venue_calendar_ui = component "Venue calendar pages" "Driving adapter. A week of one venue's calendar for Coordinators and Venue Staff, and every venue's calendar for one day." "src/app/staff/coordinator/venues" "Driving Adapter,Week7"

                    venue_unavailability_ui = component "Venue unavailability pages + actions" "Driving adapter. Venue Staff list, record and lift blocks on a venue." "src/app/staff/venue/unavailability" "Driving Adapter,Week7"

                    view_venue_calendar_uc = component "ViewVenueCalendarUseCase" "Use case. Derives a week of one venue's calendar from its bookings and blocks, read live." "src/core/use-cases" "Use Case,Week7"

                    view_venues_on_day_uc = component "ViewVenuesOnDayUseCase" "Use case. Derives every venue's calendar for one day, side by side." "src/core/use-cases" "Use Case,Week7"

                    record_venue_unavailability_uc = component "RecordVenueUnavailabilityUseCase" "Use case. Venue Staff block a venue for a period with a reason; flagged bookings' Coordinators and lapsed events' Organisers are told." "src/core/use-cases" "Use Case,Week7"

                    list_venue_unavailability_uc = component "ListVenueUnavailabilityUseCase" "Use case. Lists every block on every venue, in force and lifted. Venue Staff only." "src/core/use-cases" "Use Case,Week7"

                    lift_venue_unavailability_uc = component "LiftVenueUnavailabilityUseCase" "Use case. Venue Staff lift an in-force block early." "src/core/use-cases" "Use Case,Week7"

                    venue_calendar_e = component "venue-calendar" "Domain. Derives each 15-minute period as available, confirmed, held, blocked or closed." "src/core/domain" "Domain,Week7"

                    venue_unavailability_e = component "venue-unavailability" "Domain. Defines a block with one of five reasons, refuses a duplicate in force, and lifts it." "src/core/domain" "Domain,Week7"

                    venue_buffers_e = component "venue-buffers" "Domain. A venue's setup and turnaround minutes: both or neither, on the 15-minute grid, defined once then locked." "src/core/domain" "Domain,Week7"

                    opening_hours_e = component "opening-hours" "Domain. A venue's opening window, the same every day, on the 15-minute grid; names the closed periods in a range." "src/core/domain" "Domain,Week7"

                    padded_window_e = component "padded-window" "Domain. The time a booking takes from its venue: the booked time plus setup before and turnaround after, split per date." "src/core/domain" "Domain,Week7"

                    slot_grid_e = component "slot-grid" "Domain. Converts between 15-minute slot codes '0' to '95' and time ranges." "src/core/domain" "Domain,Week7"

                    time_of_day_e = component "time-of-day" "Domain. HH:MM times in minutes after midnight on the 15-minute grid; 24:00 ends a day." "src/core/domain" "Domain,Week7"

                    venue_unavailability_repository_port = component "VenueUnavailabilityRepository" "Port. Records, lists, finds and lifts blocks; reads the bookings a block sits over and flagged and blocked slots." "src/core/ports/outbound" "Port,Week7"

                    confirmation_lapses_port = component "ConfirmationLapses" "Port. The events a block or venue edit took out of Confirmed, with who to tell." "src/core/ports/outbound" "Port,Week7"

                    supabase_venue_unavailability_ad = component "SupabaseVenueUnavailabilityRepository" "Adapter. The venue_staff record, list, lift and affected-booking unavailability RPCs, and venue_blocked_slots." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_confirmation_lapses_ad = component "SupabaseConfirmationLapses" "Adapter. The confirmation_lapses RPC." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Events" {

                    confirm_event_uc = component "ConfirmEventUseCase" "Confirms an event for its assigned Coordinator once readiness and the safety check allow it, then notifies the Organiser and any attendees." "src/core/use-cases" "Use Case,Week7"

                    cancel_event_uc = component "CancelEventUseCase" "Cancels an event for its assigned Coordinator, gives back its venue holds, and notifies the Organiser and attendees." "src/core/use-cases" "Use Case,Week7"

                    complete_event_uc = component "CompleteEventUseCase" "Marks a Confirmed event Completed once it has ended, with optional operational notes." "src/core/use-cases" "Use Case,Week7"

                    update_event_details_uc = component "UpdateEventDetailsUseCase" "Saves the ordinary details the assigned Coordinator edits directly, only the fields that changed." "src/core/use-cases" "Use Case,Week7"

                    set_event_registration_uc = component "SetEventRegistrationUseCase" "Turns registration on or off and sets its window for the assigned Coordinator." "src/core/use-cases" "Use Case,Week7"

                    set_event_required_facilities_uc = component "SetEventRequiredFacilitiesUseCase" "Records the facilities an event needs, ticked from the venue facility list." "src/core/use-cases" "Use Case,Week7"

                    event_readiness_e = component "event-readiness" "Domain. What is still incomplete for an event, whether it may be confirmed, and when a confirmation lapses." "src/core/domain" "Domain,Week7"

                    event_times_e = component "event-times" "Domain. An event's times as ranges on a date, joined from 15-minute slots." "src/core/domain" "Domain,Week7"

                    event_facilities_e = component "event-facilities" "Domain. Accepts only facilities from the venue list, and says until when they can change." "src/core/domain" "Domain,Week7"

                    event_cancellation_e = component "event-cancellation" "Domain. A Planning, Blocked or Confirmed event may be cancelled; a finished one may not." "src/core/domain" "Domain,Week7"

                    event_completion_e = component "event-completion" "Domain. A Confirmed event may be completed once its latest end time has passed." "src/core/domain" "Domain,Week7"

                    event_details_edit_e = component "event-details-edit" "Domain. Which ordinary details may be edited, which of them changed, and that a name and listed accessibility values are kept." "src/core/domain" "Domain,Week7"

                    event_registration_settings_e = component "event-registration-settings" "Domain. Enabling registration needs both dates and the window may not run backwards." "src/core/domain" "Domain,Week7"

                    event_readiness_repository_port = component "EventReadinessRepository" "Port. Reads the facts that decide whether an event is ready, for its assigned Coordinator." "src/core/ports/outbound" "Port,Week7"

                    supabase_event_readiness_ad = component "SupabaseEventReadinessRepository" "Adapter. The event_readiness RPC." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Safety checks" {

                    safety_list_ui = component "Safety Officer list" "Driving adapter. The events awaiting a safety check." "src/app/staff/safety/page.tsx" "Driving Adapter,Week7"

                    safety_review_ui = component "Safety check review + record action" "Driving adapter. One event as the Safety Officer reviews it; records Approved or Rejected." "src/app/staff/safety/[id]" "Driving Adapter,Week7"

                    list_awaiting_safety_uc = component "ListEventsAwaitingSafetyCheckUseCase" "Lists the events awaiting a check, for a Safety Officer." "src/core/use-cases" "Use Case,Week7"

                    view_safety_check_uc = component "ViewSafetyCheckUseCase" "Reads one event's venues, equipment and recorded checks for a Safety Officer." "src/core/use-cases" "Use Case,Week7"

                    record_safety_check_uc = component "RecordSafetyCheckUseCase" "Records Approved or Rejected on an event and tells its Coordinator." "src/core/use-cases" "Use Case,Week7"

                    resubmit_safety_check_uc = component "ResubmitForSafetyCheckUseCase" "Sends a rejected event back for a fresh check and tells the Safety Officers." "src/core/use-cases" "Use Case,Week7"

                    view_event_safety_checks_uc = component "ViewEventSafetyChecksUseCase" "Reads an event's recorded checks and whether it can be resubmitted, for its Coordinator." "src/core/use-cases" "Use Case,Week7"

                    safety_check_e = component "safety-check" "Domain. When an event awaits a check, how a check is recorded (rejection needs comments), and when it can be resubmitted." "src/core/domain" "Domain,Week7"

                    safety_check_repository_port = component "SafetyCheckRepository" "Port. Reads a review, records a check, resubmits, and reads a Coordinator's check history." "src/core/ports/outbound" "Port,Week7"

                    safety_check_candidate_repository_port = component "SafetyCheckCandidateRepository" "Port. Lists the events that may be awaiting a check." "src/core/ports/outbound" "Port,Week7"

                    safety_check_watch_port = component "SafetyCheckWatch" "Port. Reads an event or booking as a check candidate, and lists the Safety Officers." "src/core/ports/outbound" "Port,Week7"

                    supabase_safety_check_ad = component "SupabaseSafetyCheckRepository" "Adapter. The safety_officer_* and coordinator_* safety check RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_safety_check_candidate_ad = component "SupabaseSafetyCheckCandidateRepository" "Adapter. The safety_officer_safety_check_candidates RPC." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_safety_check_watch_ad = component "SupabaseSafetyCheckWatch" "Adapter. The safety_officer_ids RPC and candidate reads, as the service role." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Change requests" {

                    org_change_request_ui = component "Change request form + action" "Driving adapter. The Organiser asks to change a confirmed event." "src/app/staff/requester/[id]/change-request" "Driving Adapter,Week7"

                    coord_change_request_ui = component "Change request page + decide action" "Driving adapter. The Coordinator reads an open request and accepts or declines each field." "src/app/staff/coordinator/events/[id]/change-request" "Driving Adapter,Week7"

                    submit_change_request_uc = component "SubmitChangeRequestUseCase" "Files an Organiser's change request and tells the event's Coordinator." "src/core/use-cases" "Use Case,Week7"

                    decide_change_request_uc = component "DecideChangeRequestUseCase" "Applies the Coordinator's per-field decision, reschedules, and tells the Organiser, Technical Support and attendees." "src/core/use-cases" "Use Case,Week7"

                    view_event_change_requests_uc = component "ViewEventChangeRequestsUseCase" "Reads an event's open and decided change requests beside its current values." "src/core/use-cases" "Use Case,Week7"

                    change_request_e = component "change-request" "Domain. Who may ask, which fields, the per-field decision, and re-validation of a reschedule." "src/core/domain" "Domain,Week7"

                    change_request_repository_port = component "ChangeRequestRepository" "Port. Finds the target, submits a request, lists an event's requests and records a decision." "src/core/ports/outbound" "Port,Week7"

                    supabase_change_request_ad = component "SupabaseChangeRequestRepository" "Adapter. The submit_change_request and coordinator change request RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Equipment" {

                    tech_catalogue_ui = component "Equipment catalogue + add and update actions" "Driving adapter. Technical Support list the catalogue, add a line and correct its stock." "src/app/staff/technical" "Driving Adapter,Week7"

                    tech_queue_ui = component "Equipment queue pages" "Driving adapter. Technical Support's Needs review, Reviewed and Archive lists." "src/app/staff/technical" "Driving Adapter,Week7"

                    tech_review_ui = component "Event equipment detail + decision actions" "Driving adapter. One event's lines for Technical Support; reserve, mark unfulfilled or release a line." "src/app/staff/technical/[id]" "Driving Adapter,Week7"

                    coord_equipment_ui = component "Event equipment section + actions" "Driving adapter. The Coordinator adds, edits, removes and marks essential the lines of an event's equipment." "src/app/staff/coordinator/events/[id]" "Driving Adapter,Week7"

                    create_equipment_item_uc = component "CreateEquipmentItemUseCase" "Adds a line to the equipment catalogue. Technical Support only." "src/core/use-cases" "Use Case,Week7"

                    update_equipment_stock_uc = component "UpdateEquipmentStockUseCase" "Corrects a line's quantity, location and units out of service." "src/core/use-cases" "Use Case,Week7"

                    list_equipment_catalogue_uc = component "ListEquipmentCatalogueUseCase" "Lists the catalogue with units in service and the days upcoming events reserve more than that." "src/core/use-cases" "Use Case,Week7"

                    list_equipment_queue_uc = component "ListEquipmentQueueUseCase" "Lists the events on one of Technical Support's three lists, with counts of lines needing attention." "src/core/use-cases" "Use Case,Week7"

                    view_event_equipment_for_tech_uc = component "ViewEventEquipmentForTechnicalSupportUseCase" "Reads one event's lines with why each needs attention, units free, and what Technical Support can do." "src/core/use-cases" "Use Case,Week7"

                    reserve_equipment_line_uc = component "ReserveEquipmentLineUseCase" "Reserves the full quantity a line asks for, judged against what is free now." "src/core/use-cases" "Use Case,Week7"

                    mark_equipment_line_unfulfilled_uc = component "MarkEquipmentLineUnfulfilledUseCase" "Marks a line unfulfilled with a comment, reserving nothing." "src/core/use-cases" "Use Case,Week7"

                    release_equipment_line_uc = component "ReleaseEquipmentLineUseCase" "Releases the units held on a line the Coordinator asked to remove." "src/core/use-cases" "Use Case,Week7"

                    equipment_line_decision_uc = component "equipment-line-decision" "Helper. Reads the event and line afresh before Technical Support decide on it." "src/core/use-cases" "Use Case,Week7"

                    view_event_equipment_uc = component "ViewEventEquipmentUseCase" "Reads an event's lines and the catalogue to add from, only for the assigned Coordinator. Thin read." "src/core/use-cases" "Use Case,Week7"

                    record_equipment_requirement_uc = component "RecordEquipmentRequirementUseCase" "Adds a line to an event's equipment requirements; the first line opens the reservation." "src/core/use-cases" "Use Case,Week7"

                    edit_equipment_requirement_uc = component "EditEquipmentRequirementUseCase" "Changes a line's quantity or technical requirements; a reserved line goes under review." "src/core/use-cases" "Use Case,Week7"

                    remove_equipment_requirement_uc = component "RemoveEquipmentRequirementUseCase" "Deletes an unreserved line, or marks a reserved one for removal and under review." "src/core/use-cases" "Use Case,Week7"

                    undo_equipment_removal_uc = component "UndoEquipmentRemovalUseCase" "Takes back a removal Technical Support have not acted on." "src/core/use-cases" "Use Case,Week7"

                    mark_equipment_line_essential_uc = component "MarkEquipmentLineEssentialUseCase" "Marks a line essential or not, recording what was agreed outside the system." "src/core/use-cases" "Use Case,Week7"

                    equipment_requirement_change_uc = component "equipment-requirement-change" "Helper. Checks the caller is the assigned Coordinator and describes what a change did." "src/core/use-cases" "Use Case,Week7"

                    equipment_item_e = component "equipment-item" "Domain. A catalogue line is a pooled quantity with a type and location; builds it and its stock changes." "src/core/domain" "Domain,Week7"

                    equipment_requirement_e = component "equipment-requirement" "Domain. A line's quantity, reserved or under-review state, and the rules for recording, editing and removing it." "src/core/domain" "Domain,Week7"

                    equipment_review_e = component "equipment-review" "Domain. Which list an event is on, why a line needs attention, units free for an event, and the rules to reserve, mark unfulfilled and release a line." "src/core/domain" "Domain,Week7"

                    equipment_catalogue_port = component "EquipmentCatalogue" "Port. Lists, finds, adds and saves catalogue lines, and lists what events have reserved." "src/core/ports/outbound" "Port,Week7"

                    equipment_requirement_repository_port = component "EquipmentRequirementRepository" "Port. Reads an event's lines and the catalogue to pick from; adds, updates, marks and deletes a line." "src/core/ports/outbound" "Port,Week7"

                    technical_equipment_repository_port = component "TechnicalEquipmentRepository" "Port. Reads every event's lines for Technical Support; reserves, marks unfulfilled and releases a line." "src/core/ports/outbound" "Port,Week7"

                    supabase_equipment_catalogue_ad = component "SupabaseEquipmentCatalogue" "Adapter. The technical_support catalogue, create, update and reservations RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_equipment_requirements_ad = component "SupabaseEquipmentRequirementRepository" "Adapter. The coordinator equipment catalogue, event equipment and requirement RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"

                    supabase_technical_equipment_ad = component "SupabaseTechnicalEquipmentRepository" "Adapter. The technical_support event equipment, reserve, unfulfilled and release RPCs." "src/adapters/outbound/supabase" "Driven Adapter,Week7"
                }

                group "Reporting [?]" {
                    reporting_placeholder = component "Reporting module [?]" "Not designed. Brief step 14 plus event, venue-usage and registration reports. No ticket yet." {
                        tags "Placeholder"
                    }
                }

                # =============================================================
                # DOMAIN MAP — one box per module, for the `components-domains` view.
                # A grouping, not a new layer: each arrow below is the union of the
                # component-level relationships it folds in (checked by script). The
                # module views stay the way to zoom in. Excluded from `components`.
                # =============================================================

                dom_identity = component "Identity & Access" "Staff log in and out; each role is sent to its own workspace and shown only its own pages. 3 use cases." "domain map (grouping)" "Domain Capability"
                dom_requests = component "Event Requests" "Organisers draft, submit, view and hand over requests and answer clarifications. The Operations Manager assigns a Coordinator and the Lead reassigns events. The Coordinator reviews, decides, asks for clarification and sees their events. 27 use cases." "domain map (grouping)" "Domain Capability"
                dom_events = component "Events" "The Coordinator confirms, cancels and completes an event, edits its details, and sets its registration and required facilities. 6 use cases." "domain map (grouping)" "Domain Capability"
                dom_registration = component "Registration" "An Attendee browses the events open for registration, registers, views and withdraws a registration by its reference. 5 use cases." "domain map (grouping)" "Domain Capability"
                dom_venues = component "Venues" "Venue Staff maintain the catalogue, decide booking requests and block venues. A Coordinator searches venues and requests, changes and cancels bookings. Weekly and daily calendars. 17 use cases." "domain map (grouping)" "Domain Capability"
                dom_safety = component "Safety Checks" "A Safety Officer sees the events awaiting a check and records Approved or Rejected. The Coordinator reads the checks and resubmits a rejected event. 5 use cases." "domain map (grouping)" "Domain Capability"
                dom_changes = component "Change Requests" "An Organiser files a change request on a confirmed event. The Coordinator decides it field by field. 3 use cases." "domain map (grouping)" "Domain Capability"
                dom_equipment = component "Equipment" "Technical Support maintain the equipment catalogue and reserve or decline each line. The Coordinator records, edits and removes an event's equipment lines. 16 use cases." "domain map (grouping)" "Domain Capability"
                dom_notifications = component "Notifications" "Announces to each role what it needs to know, through the Notifier and Novu. 5 use cases." "domain map (grouping)" "Domain Capability"
                dom_reporting = component "Reporting [?]" "Not designed. Brief step 14 plus event, venue-usage and registration reports. No ticket yet." "domain map (grouping)" "Domain Capability,Placeholder"
            }

            # Row-level security is on for every table with no policies, so callers get in
            # only through security-definer RPCs (organiser_*, operations_*, coordinator_*,
            # attendee_*) or narrow column grants. See supabase/migrations.
            db = container "Application Database" "Event requests, events, accounts, registrations and the audit trail. Reached only through repository ports." "Supabase Postgres" "Database"

            # Built: email + password through Supabase Auth (signInWithPassword, getClaims in
            # SupabaseAuthAdapter), so the container itself is no longer [?]. The customer has
            # still not chosen a method (#62), and account recovery and locked accounts are
            # unspecified (#64), so the [?] now sits on the mechanism only.
            auth = container "Authentication Service" "Verifies credentials and holds sessions. Email + password today; customer method undecided [?]." "Supabase Auth"
        }

        # ---------------------------------------------------------------------
        # EXTERNALS
        # ---------------------------------------------------------------------

        # Novu Cloud: runs the notification workflows. Added since 05. In-app for staff,
        # and the only route to email, for Attendees.
        novu = softwareSystem "Novu Cloud" "Delivers in-app notifications and attendee emails, and hosts each staff member's inbox." "External,Week7"

        # ---------------------------------------------------------------------
        # L1 RELATIONSHIPS
        # ---------------------------------------------------------------------

        organiser   -> epvbs "Submits event and change requests; views confirmed arrangements."
        attendee    -> epvbs "Registers for confirmed events and withdraws."
        coordinator -> epvbs "Reviews and approves requests, requests venue + equipment, confirms and cancels events."
        venue_staff -> epvbs "Approves or rejects venue bookings, maintains the catalogue, blocks venues."
        tech_staff  -> epvbs "Checks and reserves equipment, records defects, supports events."
        ops_manager -> epvbs "Assigns and reassigns Event Coordinators."
        safety_officer -> epvbs "Reviews an event's venues and equipment and records Approved or Rejected."

        # In-app notifications back to the actors. These carry the workflow handoffs, so
        # they are modelled — but excluded from the "context" view below to keep L1 legible.
        # No edge to the Operations Manager: nothing in the brief notifies that role.
        epvbs -> organiser   "Notifies of clarification requests, decisions, confirmation and changes. Event-driven." "In-app" "Notification"
        epvbs -> coordinator "Notifies of assignment, venue and equipment decisions, and readiness gaps. Event-driven." "In-app" "Notification"
        epvbs -> venue_staff "Notifies of booking requests and changes affecting a venue. Event-driven." "In-app" "Notification"
        epvbs -> tech_staff  "Notifies of equipment requirements and changes affecting a reservation. Event-driven." "In-app" "Notification"
        epvbs -> safety_officer "Notifies when an event joins their Awaiting check list. Event-driven." "In-app" "Notification"
        epvbs -> attendee    "Notifies of registration confirmation and event changes. Event-driven." "Email" "Notification"

        # Novu carries both channels (in-app for staff, email for Attendees), so it is the
        # only delivery system that crosses the boundary at L1.
        epvbs -> novu "Sends in-app and email notifications; serves its workflows. Event-driven." "HTTPS" "Week7"
        novu  -> epvbs "Fetches the workflow definitions." "HTTPS" "Week7"

        # ---------------------------------------------------------------------
        # L2 RELATIONSHIPS — every role reaches the same web application
        # ---------------------------------------------------------------------

        organiser   -> epvbs.web "Drafts, submits and tracks their organisation's events." "HTTPS"
        attendee    -> epvbs.web "Registers for confirmed events and withdraws." "HTTPS"
        coordinator -> epvbs.web "Reviews requests, arranges venue and equipment, confirms." "HTTPS"
        venue_staff -> epvbs.web "Decides booking requests and maintains the venue catalogue." "HTTPS"
        tech_staff  -> epvbs.web "Checks and reserves equipment, records defects." "HTTPS"
        ops_manager -> epvbs.web "Assigns and reassigns Event Coordinators." "HTTPS"
        safety_officer -> epvbs.web "Reviews an event's venues and equipment and records the check." "HTTPS"

        epvbs.web -> epvbs.db   "Reads and writes events, accounts and registrations." "PostgREST"
        epvbs.web -> epvbs.auth "Verifies credentials and refreshes sessions." "Supabase Auth"
        epvbs.web -> novu       "Triggers notifications; the browser reads the inbox." "HTTPS" "Week7"
        novu      -> epvbs.web  "Fetches the workflow definitions." "HTTPS" "Week7"

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — driving adapters call use cases
        # ---------------------------------------------------------------------

        epvbs.web.login_ui       -> epvbs.web.login_uc              "Delegates the parsed credentials."
        epvbs.web.logout_ui      -> epvbs.web.logout_uc             "Ends the session."
        epvbs.web.session_mw_ui  -> epvbs.auth                      "Refreshes the session; redirects /staff without one." "Supabase Auth"
        epvbs.web.staff_shell_ui -> epvbs.web.identify_staff_uc     "Resolves the signed-in staff member and their workspaces."

        # The staff shell also reads each role's queue for the sidebar.
        epvbs.web.staff_shell_ui -> epvbs.web.view_my_requests_uc       "Reads the Organiser's queue."
        epvbs.web.staff_shell_ui -> epvbs.web.view_all_requests_uc      "Reads the Operations queue."
        epvbs.web.staff_shell_ui -> epvbs.web.view_all_coordinators_uc  "Reads the Coordinator list."
        epvbs.web.staff_shell_ui -> epvbs.web.view_assigned_requests_uc "Reads the Coordinator's queue."
        epvbs.web.staff_shell_ui -> epvbs.web.view_archived_uc          "Reads the Coordinator's archive."
        epvbs.web.staff_shell_ui -> epvbs.web.view_assigned_events_uc   "Reads the Coordinator's events."

        epvbs.web.request_form_ui -> epvbs.web.save_draft_uc             "Saves the draft."
        epvbs.web.request_form_ui -> epvbs.web.submit_request_uc         "Submits the request."
        epvbs.web.request_form_ui -> epvbs.web.discard_draft_uc          "Discards the draft."
        epvbs.web.request_form_ui -> epvbs.web.view_organiser_request_uc "Loads a draft to keep editing."
        epvbs.web.my_requests_ui  -> epvbs.web.view_my_requests_uc       "Lists the Organiser's requests."
        epvbs.web.my_requests_ui  -> epvbs.web.view_organiser_request_uc "Reads one request."
        epvbs.web.org_requests_ui -> epvbs.web.view_org_requests_uc      "Lists the organisation's requests."
        epvbs.web.org_requests_ui -> epvbs.web.list_org_organisers_uc    "Lists who a request can go to."
        epvbs.web.org_requests_ui -> epvbs.web.change_organiser_uc       "Hands the request to another Organiser."

        epvbs.web.ops_console_ui -> epvbs.web.view_ops_request_uc      "Reads one request and whether it can be assigned."
        epvbs.web.ops_console_ui -> epvbs.web.view_all_coordinators_uc "Lists the Coordinators to pick from."
        epvbs.web.ops_console_ui -> epvbs.web.assign_coordinator_uc    "Assigns or reassigns a Coordinator."

        epvbs.web.coord_requests_ui -> epvbs.web.view_assigned_requests_uc "Lists requests awaiting review."
        epvbs.web.coord_requests_ui -> epvbs.web.view_archived_uc          "Lists rejected and withdrawn requests."
        epvbs.web.coord_requests_ui -> epvbs.web.view_assigned_request_uc  "Reads one assigned request."
        epvbs.web.coord_requests_ui -> epvbs.web.decide_request_uc         "Approves or rejects."
        epvbs.web.coord_events_ui   -> epvbs.web.view_assigned_events_uc   "Lists the Coordinator's events."

        epvbs.web.events_browse_ui     -> epvbs.web.list_open_events_uc            "Lists events open for registration."
        epvbs.web.events_browse_ui     -> epvbs.web.view_event_for_registration_uc "Reads one open event."
        epvbs.web.events_browse_ui     -> epvbs.web.register_uc                    "Registers the Attendee."
        epvbs.web.registration_page_ui -> epvbs.web.view_registration_uc           "Reads the registration by reference."
        epvbs.web.registration_page_ui -> epvbs.web.withdraw_uc                    "Withdraws the registration."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — use cases ask the domain to decide
        # A use case orchestrates; every rule below lives in a domain component.
        # Thin reads (ARCHITECTURE.md s11) have no domain edge: nothing can say no.
        # ---------------------------------------------------------------------

        epvbs.web.login_uc          -> epvbs.web.staff_member_e "Picks the landing page for the account's roles."
        epvbs.web.identify_staff_uc -> epvbs.web.staff_member_e "Derives the workspaces and the Organiser or Coordinator context."

        epvbs.web.save_draft_uc             -> epvbs.web.event_request_e "Builds the Draft and checks edit rights."
        epvbs.web.submit_request_uc         -> epvbs.web.event_request_e "Applies the submit rules: complete, future date, end after start."
        epvbs.web.discard_draft_uc          -> epvbs.web.event_request_e "Checks the caller may still edit it."
        epvbs.web.view_organiser_request_uc -> epvbs.web.event_request_e "Checks the caller's organisation may see it."
        epvbs.web.view_org_requests_uc      -> epvbs.web.event_request_e "Asks what this caller may edit."
        epvbs.web.change_organiser_uc       -> epvbs.web.event_request_e "Replaces the responsible Organiser."
        epvbs.web.view_all_requests_uc      -> epvbs.web.event_request_e "Hides Drafts; splits unassigned from assigned."
        epvbs.web.view_ops_request_uc       -> epvbs.web.event_request_e "Hides Drafts; asks whether a Coordinator can be assigned."
        epvbs.web.assign_coordinator_uc     -> epvbs.web.event_request_e "Applies the assignment: Submitted to Under Review."
        epvbs.web.view_assigned_requests_uc -> epvbs.web.event_request_e "Places each request in the Coordinator's queue."
        epvbs.web.view_archived_uc          -> epvbs.web.event_request_e "Places each request in the archive."
        epvbs.web.view_assigned_request_uc  -> epvbs.web.event_request_e "Refuses anyone but the assigned Coordinator."
        epvbs.web.decide_request_uc         -> epvbs.web.event_request_e "Applies approval or rejection; rejection needs a reason."

        epvbs.web.list_open_events_uc            -> epvbs.web.event_e        "Keeps the events open for registration."
        epvbs.web.view_event_for_registration_uc -> epvbs.web.event_e        "Refuses an event not open for registration."
        epvbs.web.register_uc                    -> epvbs.web.event_e        "Checks the event is open and not full."
        epvbs.web.register_uc                    -> epvbs.web.registration_e "Refuses a second live registration; builds the new one."
        epvbs.web.register_uc                    -> epvbs.web.attendee_e     "Validates the name and email."
        epvbs.web.view_registration_uc           -> epvbs.web.registration_e "Asks whether it can still be withdrawn."
        epvbs.web.withdraw_uc                    -> epvbs.web.registration_e "Applies the withdrawal."
        epvbs.web.withdraw_uc                    -> epvbs.web.event_e        "Checks the event still allows withdrawal."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — use cases require ports
        # ---------------------------------------------------------------------

        epvbs.web.login_uc          -> epvbs.web.auth_port            "Verifies credentials and opens a session."
        epvbs.web.login_uc          -> epvbs.web.user_repository_port "Loads the account behind the credentials."
        epvbs.web.logout_uc         -> epvbs.web.auth_port            "Reads, then ends, the session."
        epvbs.web.logout_uc         -> epvbs.web.user_repository_port "Looks up who is logging out."
        epvbs.web.logout_uc         -> epvbs.web.audit_logger_port    "Records the logout."
        epvbs.web.identify_staff_uc -> epvbs.web.auth_port            "Reads the current session."
        epvbs.web.identify_staff_uc -> epvbs.web.user_repository_port "Loads the account and its roles."

        epvbs.web.save_draft_uc             -> epvbs.web.event_request_repository_port "Saves the draft."
        epvbs.web.submit_request_uc         -> epvbs.web.event_request_repository_port "Saves the submitted request."
        epvbs.web.submit_request_uc         -> epvbs.web.clock_port                    "Reads today for the future-date rule."
        epvbs.web.discard_draft_uc          -> epvbs.web.event_request_repository_port "Deletes the draft."
        epvbs.web.view_my_requests_uc       -> epvbs.web.event_request_repository_port "Lists the requests the Organiser raised."
        epvbs.web.view_organiser_request_uc -> epvbs.web.event_request_repository_port "Finds the request."
        epvbs.web.view_org_requests_uc      -> epvbs.web.event_request_repository_port "Lists the organisation's requests."
        epvbs.web.change_organiser_uc       -> epvbs.web.event_request_repository_port "Records the new responsible Organiser."
        epvbs.web.list_org_organisers_uc    -> epvbs.web.user_account_repository_port  "Lists the organisation's Organisers."

        epvbs.web.view_all_requests_uc     -> epvbs.web.event_request_repository_port "Lists every request."
        epvbs.web.view_ops_request_uc      -> epvbs.web.event_request_repository_port "Finds the request."
        epvbs.web.view_all_coordinators_uc -> epvbs.web.user_account_repository_port  "Lists every Coordinator."
        epvbs.web.assign_coordinator_uc    -> epvbs.web.user_account_repository_port  "Checks the assignee is a Coordinator."
        epvbs.web.assign_coordinator_uc    -> epvbs.web.event_request_repository_port "Records the assignment."

        epvbs.web.view_assigned_requests_uc -> epvbs.web.event_request_repository_port   "Lists the requests assigned to the caller."
        epvbs.web.view_assigned_requests_uc -> epvbs.web.client_org_repository_port      "Names the client organisations."
        epvbs.web.view_archived_uc          -> epvbs.web.event_request_repository_port   "Lists the requests assigned to the caller."
        epvbs.web.view_archived_uc          -> epvbs.web.client_org_repository_port      "Names the client organisations."
        epvbs.web.view_assigned_request_uc  -> epvbs.web.event_request_repository_port   "Finds the request."
        epvbs.web.view_assigned_request_uc  -> epvbs.web.client_org_repository_port      "Names the client organisation."
        epvbs.web.view_assigned_request_uc  -> epvbs.web.user_account_repository_port    "Names the responsible Organiser."
        epvbs.web.decide_request_uc         -> epvbs.web.event_request_repository_port   "Records the decision; approval opens the Event."
        epvbs.web.view_assigned_events_uc   -> epvbs.web.coordinator_event_repository_port "Lists the caller's events."

        epvbs.web.list_open_events_uc            -> epvbs.web.event_catalogue_port         "Lists Confirmed events."
        epvbs.web.list_open_events_uc            -> epvbs.web.clock_port                   "Reads now for the registration window."
        epvbs.web.view_event_for_registration_uc -> epvbs.web.event_catalogue_port         "Finds the event."
        epvbs.web.view_event_for_registration_uc -> epvbs.web.clock_port                   "Reads now for the registration window."
        epvbs.web.register_uc                    -> epvbs.web.event_catalogue_port         "Loads the event and its capacity."
        epvbs.web.register_uc                    -> epvbs.web.registration_repository_port "Counts places, checks for a live registration, saves."
        epvbs.web.register_uc                    -> epvbs.web.clock_port                   "Checks the registration period is open."
        epvbs.web.view_registration_uc           -> epvbs.web.registration_repository_port "Finds the registration by reference."
        epvbs.web.view_registration_uc           -> epvbs.web.event_catalogue_port         "Loads its event."
        epvbs.web.withdraw_uc                    -> epvbs.web.registration_repository_port "Records the withdrawal."
        epvbs.web.withdraw_uc                    -> epvbs.web.event_catalogue_port         "Loads the event."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — adapters implement ports
        # The arrow points inward on purpose: compilation depends on the port even
        # though control, at runtime, flows outward through the adapter.
        # ---------------------------------------------------------------------

        epvbs.web.system_clock_ad             -> epvbs.web.clock_port                        "Implements."
        epvbs.web.supabase_audit_ad           -> epvbs.web.audit_logger_port                 "Implements."
        epvbs.web.supabase_auth_ad            -> epvbs.web.auth_port                         "Implements."
        epvbs.web.supabase_user_ad            -> epvbs.web.user_repository_port              "Implements."
        epvbs.web.supabase_event_requests_ad  -> epvbs.web.event_request_repository_port     "Implements."
        epvbs.web.supabase_user_accounts_ad   -> epvbs.web.user_account_repository_port      "Implements."
        epvbs.web.supabase_client_orgs_ad     -> epvbs.web.client_org_repository_port        "Implements."
        epvbs.web.supabase_coord_events_ad    -> epvbs.web.coordinator_event_repository_port "Implements."
        epvbs.web.supabase_event_catalogue_ad -> epvbs.web.event_catalogue_port              "Implements."
        epvbs.web.supabase_registrations_ad   -> epvbs.web.registration_repository_port      "Implements."
        epvbs.web.logging_notifier_ad         -> epvbs.web.notifier_port                     "Implements."

        # The in-memory adapters implement every port but AuditLogger. Ten near-identical
        # arrows would bury the module structure, so they are excluded from the
        # "components" view and drawn in the sprint lenses instead.
        epvbs.web.in_memory_ad -> epvbs.web.clock_port                        "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.auth_port                         "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.user_repository_port              "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.event_request_repository_port     "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.user_account_repository_port      "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.client_org_repository_port        "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.coordinator_event_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.event_catalogue_port              "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.registration_repository_port      "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.notifier_port                     "Implements, for tests."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — the composition root hands each use case its adapters
        # Same treatment: modelled here, drawn in the sprint lenses.
        # ---------------------------------------------------------------------

        epvbs.web.composition_root -> epvbs.web.login_uc                       "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.logout_uc                      "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.identify_staff_uc              "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.save_draft_uc                  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.submit_request_uc              "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.discard_draft_uc               "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_my_requests_uc            "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_organiser_request_uc      "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_org_requests_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.change_organiser_uc            "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_org_organisers_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_all_requests_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_ops_request_uc            "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_all_coordinators_uc       "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.assign_coordinator_uc          "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_assigned_requests_uc      "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_archived_uc               "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_assigned_request_uc       "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.decide_request_uc              "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_assigned_events_uc        "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_open_events_uc            "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_event_for_registration_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.register_uc                    "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_registration_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.withdraw_uc                    "Constructs it with its adapters."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — merged 2026-09-29 .. 2026-10-01
        # ---------------------------------------------------------------------

        # SPM-33 — clarification (PR #57)
        epvbs.web.coord_requests_ui -> epvbs.web.request_clarification_uc    "Returns the request with a question."
        epvbs.web.coord_requests_ui -> epvbs.web.post_coord_clarification_uc "Posts a message on the thread."
        epvbs.web.coord_requests_ui -> epvbs.web.resolve_clarification_uc    "Resolves a clarification."
        epvbs.web.my_requests_ui    -> epvbs.web.post_clarification_uc       "Posts the Organiser's reply."
        epvbs.web.request_clarification_uc    -> epvbs.web.event_request_e "Applies the return: to Returned."
        epvbs.web.resolve_clarification_uc    -> epvbs.web.event_request_e "Applies the resolve: back to Under Review."
        epvbs.web.resolve_clarification_uc    -> epvbs.web.clarification_message_e "Finds the clarification a reply resolves."
        epvbs.web.post_clarification_uc       -> epvbs.web.event_request_e "Checks the request can still be discussed."
        epvbs.web.post_coord_clarification_uc -> epvbs.web.event_request_e "Checks the request can still be discussed."
        epvbs.web.request_clarification_uc    -> epvbs.web.event_request_repository_port "Records the return and its question."
        epvbs.web.resolve_clarification_uc    -> epvbs.web.event_request_repository_port "Records the resolve."
        epvbs.web.resolve_clarification_uc    -> epvbs.web.clarification_thread_port     "Reads the thread."
        epvbs.web.post_clarification_uc       -> epvbs.web.event_request_repository_port "Finds the request."
        epvbs.web.post_clarification_uc       -> epvbs.web.clarification_thread_port     "Appends the message."
        epvbs.web.post_coord_clarification_uc -> epvbs.web.event_request_repository_port "Finds the request."
        epvbs.web.post_coord_clarification_uc -> epvbs.web.clarification_thread_port     "Appends the message."
        epvbs.web.view_assigned_request_uc    -> epvbs.web.clarification_thread_port     "Reads the thread."
        epvbs.web.view_organiser_request_uc   -> epvbs.web.clarification_thread_port     "Reads the thread."
        epvbs.web.supabase_clarification_ad -> epvbs.web.clarification_thread_port "Implements."
        epvbs.web.supabase_clarification_ad -> epvbs.db "Reads and writes the clarification thread." "PostgREST RPC"
        epvbs.web.in_memory_ad     -> epvbs.web.clarification_thread_port   "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.request_clarification_uc    "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.post_coord_clarification_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.resolve_clarification_uc    "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.post_clarification_uc       "Constructs it with its adapters."

        # SPM-101 — record a request's withdrawal (PRs #59-#62)
        epvbs.web.coord_requests_ui   -> epvbs.web.withdraw_request_uc           "Records the withdrawal."
        epvbs.web.withdraw_request_uc -> epvbs.web.event_request_e               "Applies the withdrawal: to Withdrawn."
        epvbs.web.withdraw_request_uc -> epvbs.web.event_request_repository_port "Records the withdrawal."
        epvbs.web.composition_root    -> epvbs.web.withdraw_request_uc           "Constructs it with its adapters."
        epvbs.web.composition_root    -> epvbs.web.search_venues_uc "Constructs it with its adapters."
        epvbs.web.composition_root    -> epvbs.web.update_venue_uc "Constructs it with its adapters."
        epvbs.web.composition_root    -> epvbs.web.create_venue_uc "Constructs it with its adapters."
        epvbs.web.composition_root    -> epvbs.web.view_venue_uc "Constructs it with its adapters."
        epvbs.web.composition_root    -> epvbs.web.list_venues_uc "Constructs it with its adapters."


        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — Venues (SPM-42, SPM-44)
        # ---------------------------------------------------------------------

        epvbs.web.venue_catalogue_ui -> epvbs.web.list_venues_uc  "Lists the catalogue."
        epvbs.web.venue_catalogue_ui -> epvbs.web.view_venue_uc   "Reads one venue."
        epvbs.web.venue_catalogue_ui -> epvbs.web.create_venue_uc "Adds a venue."
        epvbs.web.venue_catalogue_ui -> epvbs.web.update_venue_uc "Revises a venue."
        epvbs.web.venue_search_ui    -> epvbs.web.search_venues_uc "Searches the catalogue."

        epvbs.web.create_venue_uc   -> epvbs.web.venue_e "Checks the caller may maintain venues; builds valid details."
        epvbs.web.update_venue_uc   -> epvbs.web.venue_e "Checks the caller may maintain venues; builds valid details."
        epvbs.web.search_venues_uc  -> epvbs.web.venue_search_e "Builds the criteria; names why a venue was left out."
        epvbs.web.venue_e           -> epvbs.web.venue_options_e "Checks facilities and accessibility are allowed values."
        epvbs.web.venue_search_e    -> epvbs.web.venue_options_e "Checks each option is an allowed value."

        epvbs.web.list_venues_uc   -> epvbs.web.venue_catalogue_port "Lists the venues."
        epvbs.web.view_venue_uc    -> epvbs.web.venue_catalogue_port "Finds the venue."
        epvbs.web.create_venue_uc  -> epvbs.web.venue_catalogue_port "Saves the new venue."
        epvbs.web.update_venue_uc  -> epvbs.web.venue_catalogue_port "Saves the revision."
        epvbs.web.search_venues_uc -> epvbs.web.venue_catalogue_port "Lists the venues to filter."
        epvbs.web.search_venues_uc -> epvbs.web.venue_availability_port "Reads the busy intervals in the window."
        epvbs.web.search_venues_uc -> epvbs.web.clock_port "Reads today for the past-date rule."

        epvbs.web.supabase_venue_catalogue_ad      -> epvbs.web.venue_catalogue_port      "Implements."
        epvbs.web.supabase_venue_availability_ad   -> epvbs.web.venue_availability_port   "Implements."
        epvbs.web.supabase_venue_catalogue_ad      -> epvbs.db "Reads and writes the venue catalogue." "PostgREST RPC"
        epvbs.web.supabase_venue_availability_ad   -> epvbs.db "Reads when venues are held." "PostgREST RPC"

        epvbs.web.in_memory_ad -> epvbs.web.venue_catalogue_port    "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.venue_availability_port "Implements, for tests."


        # ---------------------------------------------------------------------
        # L3 — Events, coordination, workload (fragment: events)
        # ---------------------------------------------------------------------

        epvbs.web.coord_event_detail_ui -> epvbs.web.view_coordinator_event_uc        "Reads one event with its readiness."
        epvbs.web.coord_event_detail_ui -> epvbs.web.confirm_event_uc                 "Confirms the event."
        epvbs.web.coord_event_detail_ui -> epvbs.web.cancel_event_uc                  "Cancels the event."
        epvbs.web.coord_event_detail_ui -> epvbs.web.complete_event_uc                "Marks the event completed."
        epvbs.web.coord_event_detail_ui -> epvbs.web.update_event_details_uc          "Saves the ordinary details."
        epvbs.web.coord_event_detail_ui -> epvbs.web.set_event_registration_uc        "Saves the registration settings."
        epvbs.web.coord_requests_ui     -> epvbs.web.find_assigned_event_by_request_uc "Finds the event an approved request became."
        epvbs.web.lead_workload_ui      -> epvbs.web.view_coordinator_workloads_uc    "Lists each Coordinator's workload."
        epvbs.web.lead_event_ui         -> epvbs.web.view_lead_event_uc               "Reads one event to reassign."
        epvbs.web.lead_event_ui         -> epvbs.web.view_all_coordinators_uc         "Lists the Coordinators to pick from."
        epvbs.web.lead_event_ui         -> epvbs.web.reassign_event_coordinator_uc    "Hands the event to another Coordinator."
        epvbs.web.confirm_event_uc                 -> epvbs.web.event_readiness_e            "Assesses readiness and applies the confirmation."
        epvbs.web.cancel_event_uc                  -> epvbs.web.event_cancellation_e         "Applies the cancellation."
        epvbs.web.complete_event_uc                -> epvbs.web.event_completion_e           "Applies the completion once the event has ended."
        epvbs.web.update_event_details_uc          -> epvbs.web.event_details_edit_e         "Works out which details changed."
        epvbs.web.set_event_registration_uc        -> epvbs.web.event_registration_settings_e "Checks the settings and whether they can still change."
        epvbs.web.set_event_required_facilities_uc -> epvbs.web.event_facilities_e           "Checks the facilities and whether they can still change."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.event_readiness_e            "Assesses readiness and the confirmation state."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.event_cancellation_e         "Asks whether the event can be cancelled."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.event_completion_e           "Asks whether the event can be completed."
        epvbs.web.view_coordinator_workloads_uc    -> epvbs.web.coordinator_workload_e       "Builds each Coordinator's workload."
        epvbs.web.view_lead_event_uc               -> epvbs.web.coordinator_workload_e       "Asks whether the event is still active."
        epvbs.web.reassign_event_coordinator_uc    -> epvbs.web.coordinator_workload_e       "Applies the reassignment to an active event."
        epvbs.web.event_completion_e              -> epvbs.web.event_times_e            "Finds when the event ends."
        epvbs.web.event_e                         -> epvbs.web.event_times_e            "Orders events by their first start."
        epvbs.web.event_request_e                 -> epvbs.web.event_times_e            "Reads the requested times as ranges."
        epvbs.web.event_details_edit_e            -> epvbs.web.event_facilities_e       "Shares the window in which an event can be edited."
        epvbs.web.event_registration_settings_e   -> epvbs.web.event_facilities_e       "Shares the window in which an event can be edited."
        epvbs.web.event_facilities_e              -> epvbs.web.venue_options_e          "Checks each facility is on the venue list."
        epvbs.web.event_details_edit_e            -> epvbs.web.venue_options_e          "Checks accessibility values are on the list."
        epvbs.web.coordinator_workload_e          -> epvbs.web.event_request_e          "Reads which queue a request is in."
        epvbs.web.confirm_event_uc                 -> epvbs.web.coordinator_event_repository_port "Finds the event and records the confirmation."
        epvbs.web.confirm_event_uc                 -> epvbs.web.event_readiness_repository_port   "Reads the readiness facts."
        epvbs.web.confirm_event_uc                 -> epvbs.web.notifier_port                     "Tells the Organiser the event is confirmed."
        epvbs.web.cancel_event_uc                  -> epvbs.web.coordinator_event_repository_port "Finds the event and records the cancellation."
        epvbs.web.cancel_event_uc                  -> epvbs.web.notifier_port                     "Tells the Organiser the event is cancelled."
        epvbs.web.complete_event_uc                -> epvbs.web.coordinator_event_repository_port "Finds the event and records the completion."
        epvbs.web.complete_event_uc                -> epvbs.web.clock_port                        "Reads now to check the event has ended."
        epvbs.web.update_event_details_uc          -> epvbs.web.coordinator_event_repository_port "Finds the event and saves the changes."
        epvbs.web.set_event_registration_uc        -> epvbs.web.coordinator_event_repository_port "Finds the event and saves the settings."
        epvbs.web.set_event_required_facilities_uc -> epvbs.web.coordinator_event_repository_port "Finds the event and saves the facilities."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.coordinator_event_repository_port "Finds the assigned event and its details."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.event_readiness_repository_port   "Reads the readiness facts."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.client_org_repository_port        "Names the client organisation."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.user_account_repository_port      "Names the owning Organiser."
        epvbs.web.view_coordinator_event_uc        -> epvbs.web.clock_port                        "Reads now to see whether the event has ended."
        epvbs.web.find_assigned_event_by_request_uc -> epvbs.web.coordinator_event_repository_port "Finds the event opened from the request."
        epvbs.web.view_coordinator_workloads_uc    -> epvbs.web.lead_event_repository_port        "Lists every event."
        epvbs.web.view_coordinator_workloads_uc    -> epvbs.web.user_account_repository_port      "Lists every Coordinator."
        epvbs.web.view_coordinator_workloads_uc    -> epvbs.web.event_request_repository_port     "Lists every request."
        epvbs.web.view_coordinator_workloads_uc    -> epvbs.web.client_org_repository_port        "Names the client organisations."
        epvbs.web.view_lead_event_uc               -> epvbs.web.lead_event_repository_port        "Finds the event with its times."
        epvbs.web.view_lead_event_uc               -> epvbs.web.client_org_repository_port        "Names the client organisation."
        epvbs.web.reassign_event_coordinator_uc    -> epvbs.web.lead_event_repository_port        "Finds the event and records the new Coordinator."
        epvbs.web.reassign_event_coordinator_uc    -> epvbs.web.user_account_repository_port      "Checks the assignee is a Coordinator; names them."
        epvbs.web.reassign_event_coordinator_uc    -> epvbs.web.client_org_repository_port        "Names the client organisation."
        epvbs.web.reassign_event_coordinator_uc    -> epvbs.web.notifier_port                     "Tells the new Coordinator and the Organiser."
        epvbs.web.assign_coordinator_uc  -> epvbs.web.client_org_repository_port "Names the client organisation for the notices."
        epvbs.web.assign_coordinator_uc  -> epvbs.web.notifier_port              "Tells the Coordinator and the Organiser."
        epvbs.web.view_all_requests_uc   -> epvbs.web.client_org_repository_port "Names the client organisations."
        epvbs.web.view_ops_request_uc    -> epvbs.web.client_org_repository_port "Names the client organisation."
        epvbs.web.decide_request_uc      -> epvbs.web.notifier_port              "Tells the Organiser of the decision."
        epvbs.web.register_uc            -> epvbs.web.notifier_port              "Confirms the registration to the Attendee."
        epvbs.web.supabase_event_readiness_ad -> epvbs.web.event_readiness_repository_port "Implements."
        epvbs.web.supabase_lead_events_ad     -> epvbs.web.lead_event_repository_port      "Implements."
        epvbs.web.in_memory_ad -> epvbs.web.event_readiness_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.lead_event_repository_port      "Implements, for tests."
        epvbs.web.supabase_event_readiness_ad -> epvbs.db "Reads what is arranged for an event." "PostgREST RPC"
        epvbs.web.supabase_lead_events_ad     -> epvbs.db "Reads every event and records a reassignment." "PostgREST RPC"
        epvbs.web.composition_root -> epvbs.web.confirm_event_uc                  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.cancel_event_uc                   "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.complete_event_uc                 "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.update_event_details_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.set_event_registration_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.set_event_required_facilities_uc  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_coordinator_event_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.find_assigned_event_by_request_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_lead_event_uc                "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.reassign_event_coordinator_uc     "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_coordinator_workloads_uc     "Constructs it with its adapters."

        # ---------------------------------------------------------------------
        # L3 — Venues: booking, calendar, blocks (fragment: venues)
        # ---------------------------------------------------------------------

        epvbs.web.venue_booking_ui -> epvbs.web.view_venue_booking_options_uc "Reads the booking page for an event."
        epvbs.web.venue_booking_ui -> epvbs.web.submit_venue_booking_request_uc "Requests or re-requests a venue."
        epvbs.web.venue_booking_ui -> epvbs.web.change_booking_room_layout_uc "Moves a pending request to another layout."
        epvbs.web.venue_booking_ui -> epvbs.web.cancel_venue_booking_uc "Cancels a booking."
        epvbs.web.venue_booking_ui -> epvbs.web.clear_booking_flag_uc "Clears a flag on a booking."
        epvbs.web.booking_review_ui -> epvbs.web.review_booking_requests_uc "Lists and reads booking requests."
        epvbs.web.booking_review_ui -> epvbs.web.decide_booking_request_uc "Approves, holds or rejects a request."
        epvbs.web.staff_shell_ui -> epvbs.web.review_booking_requests_uc "Lists the requests in the Venue Staff sidebar."
        epvbs.web.venue_calendar_ui -> epvbs.web.view_venue_calendar_uc "Reads a week of one venue."
        epvbs.web.venue_calendar_ui -> epvbs.web.view_venues_on_day_uc "Reads every venue for one day."
        epvbs.web.venue_unavailability_ui -> epvbs.web.list_venue_unavailability_uc "Lists the blocks."
        epvbs.web.venue_unavailability_ui -> epvbs.web.record_venue_unavailability_uc "Blocks a venue."
        epvbs.web.venue_unavailability_ui -> epvbs.web.lift_venue_unavailability_uc "Lifts a block."
        epvbs.web.venue_unavailability_ui -> epvbs.web.list_venues_uc "Lists the venues to choose from."
        epvbs.web.submit_venue_booking_request_uc  -> epvbs.web.booking_e "Builds the request; refuses repeated dates."
        epvbs.web.submit_venue_booking_request_uc  -> epvbs.web.booking_review_flag_e "Finds the flagged booking a re-request replaces."
        epvbs.web.review_booking_requests_uc       -> epvbs.web.booking_e "Asks whether a booking holds its slots."
        epvbs.web.decide_booking_request_uc        -> epvbs.web.booking_e "Decides the request or resolves the hold."
        epvbs.web.cancel_venue_booking_uc          -> epvbs.web.booking_e "Cancels the booking; asks whether Venue Staff are told."
        epvbs.web.change_booking_room_layout_uc    -> epvbs.web.booking_e "Chooses the new layout; checks its capacity."
        epvbs.web.clear_booking_flag_uc            -> epvbs.web.booking_review_flag_e "Picks the flags to clear."
        epvbs.web.view_venue_booking_options_uc    -> epvbs.web.booking_review_flag_e "Builds the re-request draft for a flagged booking."
        epvbs.web.view_venue_booking_options_uc    -> epvbs.web.venue_suitability_e "Checks each venue against the event's needs."
        epvbs.web.view_venue_calendar_uc           -> epvbs.web.venue_calendar_e "Derives the week's periods."
        epvbs.web.view_venue_calendar_uc           -> epvbs.web.venue_search_e "Reads the date in the venue's zone."
        epvbs.web.view_venues_on_day_uc            -> epvbs.web.venue_calendar_e "Derives the day's periods."
        epvbs.web.view_venues_on_day_uc            -> epvbs.web.venue_search_e "Reads the date in the venue's zone."
        epvbs.web.record_venue_unavailability_uc   -> epvbs.web.venue_unavailability_e "Builds the block; refuses a duplicate in force."
        epvbs.web.record_venue_unavailability_uc   -> epvbs.web.venue_e "Checks the caller may maintain venues."
        epvbs.web.list_venue_unavailability_uc     -> epvbs.web.venue_e "Checks the caller may maintain venues."
        epvbs.web.lift_venue_unavailability_uc     -> epvbs.web.venue_unavailability_e "Lifts the block."
        epvbs.web.lift_venue_unavailability_uc     -> epvbs.web.venue_e "Checks the caller may maintain venues."
        epvbs.web.update_venue_uc                  -> epvbs.web.venue_buffers_e "Refuses a change to locked setup and turnaround."
        epvbs.web.update_venue_uc                  -> epvbs.web.venue_change_flag_e "Finds the bookings the edit no longer fits."
        epvbs.web.booking_e              -> epvbs.web.opening_hours_e         "Checks the booked time is inside opening hours."
        epvbs.web.booking_e              -> epvbs.web.padded_window_e         "Pads each booking with setup and turnaround."
        epvbs.web.booking_e              -> epvbs.web.time_of_day_e           "Works in 15-minute grid times."
        epvbs.web.booking_e              -> epvbs.web.venue_buffers_e         "Reads the venue's setup and turnaround."
        epvbs.web.booking_e              -> epvbs.web.venue_e                 "Reads the venue's layouts and capacity."
        epvbs.web.booking_review_flag_e  -> epvbs.web.booking_e               "Flags live bookings."
        epvbs.web.booking_review_flag_e  -> epvbs.web.slot_grid_e             "Maps booked slots to times."
        epvbs.web.booking_review_flag_e  -> epvbs.web.time_of_day_e           "Works in 15-minute grid times."
        epvbs.web.booking_review_flag_e  -> epvbs.web.venue_unavailability_e  "Reads the block that flags a booking."
        epvbs.web.venue_change_flag_e    -> epvbs.web.booking_e               "Judges live bookings."
        epvbs.web.venue_change_flag_e    -> epvbs.web.booking_review_flag_e   "Raises the same kind of flag."
        epvbs.web.venue_change_flag_e    -> epvbs.web.slot_grid_e             "Maps booked slots to times."
        epvbs.web.venue_change_flag_e    -> epvbs.web.venue_e                 "Compares the venue before and after."
        epvbs.web.venue_change_flag_e    -> epvbs.web.venue_suitability_e     "Re-checks the event's needs against the new venue."
        epvbs.web.venue_suitability_e    -> epvbs.web.booking_e               "Reads the booking's status."
        epvbs.web.venue_suitability_e    -> epvbs.web.venue_e                 "Reads the venue's layouts and capacity."
        epvbs.web.venue_suitability_e    -> epvbs.web.venue_options_e         "Matches facilities and accessibility by equality."
        epvbs.web.venue_calendar_e       -> epvbs.web.booking_e               "Reads each booking's slots and status."
        epvbs.web.venue_calendar_e       -> epvbs.web.opening_hours_e         "Marks closed periods."
        epvbs.web.venue_calendar_e       -> epvbs.web.slot_grid_e             "Maps slots to periods."
        epvbs.web.venue_calendar_e       -> epvbs.web.time_of_day_e           "Works in 15-minute grid times."
        epvbs.web.venue_calendar_e       -> epvbs.web.venue_unavailability_e  "Reads the blocks."
        epvbs.web.venue_unavailability_e -> epvbs.web.booking_e               "Reads the bookings a block sits over."
        epvbs.web.venue_unavailability_e -> epvbs.web.booking_review_flag_e   "Names the flag reason."
        epvbs.web.venue_unavailability_e -> epvbs.web.opening_hours_e         "Checks the block against opening hours."
        epvbs.web.venue_unavailability_e -> epvbs.web.slot_grid_e             "Maps the block to slots."
        epvbs.web.venue_unavailability_e -> epvbs.web.time_of_day_e           "Works in 15-minute grid times."
        epvbs.web.venue_unavailability_e -> epvbs.web.venue_e                 "Reads the venue."
        epvbs.web.venue_unavailability_e -> epvbs.web.venue_search_e          "Reads busy intervals."
        epvbs.web.venue_buffers_e        -> epvbs.web.time_of_day_e           "Keeps buffers on the 15-minute grid."
        epvbs.web.opening_hours_e        -> epvbs.web.time_of_day_e           "Keeps hours on the 15-minute grid."
        epvbs.web.padded_window_e        -> epvbs.web.time_of_day_e           "Works in 15-minute grid times."
        epvbs.web.slot_grid_e            -> epvbs.web.booking_e               "Reads a slot code on a date."
        epvbs.web.slot_grid_e            -> epvbs.web.time_of_day_e           "Converts codes to time ranges."
        epvbs.web.venue_e                -> epvbs.web.opening_hours_e         "Checks the venue's opening hours."
        epvbs.web.venue_e                -> epvbs.web.venue_buffers_e         "Checks the venue's setup and turnaround."
        epvbs.web.venue_search_e         -> epvbs.web.opening_hours_e         "Finds the closed periods in the searched window."
        epvbs.web.venue_search_e         -> epvbs.web.padded_window_e         "Pads the window and each booking."
        epvbs.web.venue_search_e         -> epvbs.web.time_of_day_e           "Checks searched times are on the grid."
        epvbs.web.venue_search_e         -> epvbs.web.venue_buffers_e         "Reads the venue's setup and turnaround."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.coordinator_event_repository_port "Finds the Coordinator's event."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.venue_catalogue_port              "Finds the venue."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.booking_repository_port           "Reads the venue's slots; saves the request."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.booking_flag_repository_port      "Reads the flags a re-request may replace."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.venue_staff_directory_port        "Finds the Venue Staff to tell."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.notifier_port                     "Tells Venue Staff of the request."
        epvbs.web.submit_venue_booking_request_uc -> epvbs.web.clock_port                        "Reads now for the hold and past dates."
        epvbs.web.view_venue_booking_options_uc   -> epvbs.web.coordinator_event_repository_port "Reads the event's details."
        epvbs.web.view_venue_booking_options_uc   -> epvbs.web.venue_catalogue_port              "Lists the venues."
        epvbs.web.view_venue_booking_options_uc   -> epvbs.web.booking_repository_port           "Lists the event's bookings."
        epvbs.web.view_venue_booking_options_uc   -> epvbs.web.booking_flag_repository_port      "Lists the flags on those bookings."
        epvbs.web.change_booking_room_layout_uc   -> epvbs.web.coordinator_event_repository_port "Finds the Coordinator's event."
        epvbs.web.change_booking_room_layout_uc   -> epvbs.web.venue_catalogue_port              "Finds the venue's layouts."
        epvbs.web.change_booking_room_layout_uc   -> epvbs.web.booking_repository_port           "Saves the new layout."
        epvbs.web.cancel_venue_booking_uc         -> epvbs.web.coordinator_event_repository_port "Finds the Coordinator's event."
        epvbs.web.cancel_venue_booking_uc         -> epvbs.web.booking_repository_port           "Cancels the booking."
        epvbs.web.cancel_venue_booking_uc         -> epvbs.web.venue_staff_directory_port        "Finds the Venue Staff to tell."
        epvbs.web.cancel_venue_booking_uc         -> epvbs.web.notifier_port                     "Tells Venue Staff of a confirmed cancellation."
        epvbs.web.clear_booking_flag_uc           -> epvbs.web.coordinator_event_repository_port "Finds the Coordinator's event."
        epvbs.web.clear_booking_flag_uc           -> epvbs.web.booking_flag_repository_port      "Clears the flags."
        epvbs.web.review_booking_requests_uc      -> epvbs.web.booking_review_repository_port    "Lists and finds booking requests."
        epvbs.web.review_booking_requests_uc      -> epvbs.web.venue_catalogue_port              "Finds the request's venue."
        epvbs.web.review_booking_requests_uc      -> epvbs.web.clock_port                        "Reads now for hold expiry."
        epvbs.web.decide_booking_request_uc       -> epvbs.web.booking_review_repository_port    "Finds the request; saves the decision."
        epvbs.web.decide_booking_request_uc       -> epvbs.web.clock_port                        "Stamps the decision."
        epvbs.web.decide_booking_request_uc       -> epvbs.web.notifier_port                     "Tells the Coordinator of the decision."
        epvbs.web.view_venue_calendar_uc          -> epvbs.web.venue_catalogue_port              "Finds the venue."
        epvbs.web.view_venue_calendar_uc          -> epvbs.web.booking_repository_port           "Reads the venue's booked slots."
        epvbs.web.view_venue_calendar_uc          -> epvbs.web.venue_unavailability_repository_port "Reads the venue's blocked slots."
        epvbs.web.view_venue_calendar_uc          -> epvbs.web.clock_port                        "Reads now for past days."
        epvbs.web.view_venues_on_day_uc           -> epvbs.web.venue_catalogue_port              "Lists the venues."
        epvbs.web.view_venues_on_day_uc           -> epvbs.web.booking_repository_port           "Reads each venue's booked slots."
        epvbs.web.view_venues_on_day_uc           -> epvbs.web.venue_unavailability_repository_port "Reads each venue's blocked slots."
        epvbs.web.view_venues_on_day_uc           -> epvbs.web.clock_port                        "Reads now for past days."
        epvbs.web.record_venue_unavailability_uc  -> epvbs.web.venue_unavailability_repository_port "Saves the block; reads the bookings it flags."
        epvbs.web.record_venue_unavailability_uc  -> epvbs.web.venue_catalogue_port              "Finds the venue."
        epvbs.web.record_venue_unavailability_uc  -> epvbs.web.clock_port                        "Reads now for past periods."
        epvbs.web.record_venue_unavailability_uc  -> epvbs.web.confirmation_lapses_port          "Reads the events taken out of Confirmed."
        epvbs.web.record_venue_unavailability_uc  -> epvbs.web.notifier_port                     "Tells Coordinators and Organisers."
        epvbs.web.list_venue_unavailability_uc    -> epvbs.web.venue_unavailability_repository_port "Lists the blocks."
        epvbs.web.lift_venue_unavailability_uc    -> epvbs.web.venue_unavailability_repository_port "Finds and lifts the block."
        epvbs.web.lift_venue_unavailability_uc    -> epvbs.web.clock_port                        "Stamps the lift."
        epvbs.web.update_venue_uc                 -> epvbs.web.venue_change_review_port          "Reads the bookings at the venue; saves the flags."
        epvbs.web.update_venue_uc                 -> epvbs.web.clock_port                        "Reads now for live bookings."
        epvbs.web.update_venue_uc                 -> epvbs.web.notifier_port                     "Tells Coordinators and Organisers."
        epvbs.web.supabase_booking_ad               -> epvbs.web.booking_repository_port              "Implements."
        epvbs.web.supabase_booking_review_ad        -> epvbs.web.booking_review_repository_port       "Implements."
        epvbs.web.supabase_booking_flag_ad          -> epvbs.web.booking_flag_repository_port         "Implements."
        epvbs.web.supabase_venue_change_review_ad   -> epvbs.web.venue_change_review_port             "Implements."
        epvbs.web.supabase_venue_staff_directory_ad -> epvbs.web.venue_staff_directory_port           "Implements."
        epvbs.web.supabase_venue_unavailability_ad  -> epvbs.web.venue_unavailability_repository_port "Implements."
        epvbs.web.supabase_confirmation_lapses_ad   -> epvbs.web.confirmation_lapses_port             "Implements."
        epvbs.web.supabase_booking_ad               -> epvbs.db "Reads and writes bookings and booked slots." "PostgREST RPC"
        epvbs.web.supabase_booking_review_ad        -> epvbs.db "Reads and decides booking requests." "PostgREST RPC"
        epvbs.web.supabase_booking_flag_ad          -> epvbs.db "Reads and clears booking flags." "PostgREST RPC"
        epvbs.web.supabase_venue_change_review_ad   -> epvbs.db "Reads bookings at a venue and writes the flags." "PostgREST RPC"
        epvbs.web.supabase_venue_staff_directory_ad -> epvbs.db "Reads the Venue Staff ids, as the service role." "PostgREST RPC"
        epvbs.web.supabase_venue_unavailability_ad  -> epvbs.db "Reads and writes venue blocks and the bookings they flag." "PostgREST RPC"
        epvbs.web.supabase_confirmation_lapses_ad   -> epvbs.db "Reads the events a cause took out of Confirmed." "PostgREST RPC"
        epvbs.web.in_memory_ad -> epvbs.web.booking_repository_port              "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.booking_review_repository_port       "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.booking_flag_repository_port         "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.venue_change_review_port             "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.venue_staff_directory_port           "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.venue_unavailability_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.confirmation_lapses_port             "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.view_venue_booking_options_uc  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.submit_venue_booking_request_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.change_booking_room_layout_uc  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.cancel_venue_booking_uc        "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.clear_booking_flag_uc          "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.review_booking_requests_uc     "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.decide_booking_request_uc      "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_venue_calendar_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_venues_on_day_uc          "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.record_venue_unavailability_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_venue_unavailability_uc   "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.lift_venue_unavailability_uc   "Constructs it with its adapters."

        # ---------------------------------------------------------------------
        # L3 — Equipment (fragment: equipment)
        # ---------------------------------------------------------------------

        epvbs.web.tech_catalogue_ui -> epvbs.web.list_equipment_catalogue_uc "Lists the catalogue."
        epvbs.web.tech_catalogue_ui -> epvbs.web.create_equipment_item_uc    "Adds a line."
        epvbs.web.tech_catalogue_ui -> epvbs.web.update_equipment_stock_uc   "Corrects a line's stock."
        epvbs.web.tech_queue_ui     -> epvbs.web.list_equipment_queue_uc     "Lists an event queue."
        epvbs.web.staff_shell_ui    -> epvbs.web.list_equipment_queue_uc     "Fills Technical Support's queue pane."
        epvbs.web.tech_review_ui    -> epvbs.web.view_event_equipment_for_tech_uc  "Reads one event's lines."
        epvbs.web.tech_review_ui    -> epvbs.web.reserve_equipment_line_uc         "Reserves a line."
        epvbs.web.tech_review_ui    -> epvbs.web.mark_equipment_line_unfulfilled_uc "Marks a line unfulfilled."
        epvbs.web.tech_review_ui    -> epvbs.web.release_equipment_line_uc         "Releases a line."
        epvbs.web.coord_equipment_ui -> epvbs.web.view_event_equipment_uc          "Reads the event's lines."
        epvbs.web.coord_equipment_ui -> epvbs.web.record_equipment_requirement_uc  "Adds a line."
        epvbs.web.coord_equipment_ui -> epvbs.web.edit_equipment_requirement_uc    "Edits a line."
        epvbs.web.coord_equipment_ui -> epvbs.web.remove_equipment_requirement_uc  "Removes a line."
        epvbs.web.coord_equipment_ui -> epvbs.web.undo_equipment_removal_uc        "Undoes a removal."
        epvbs.web.coord_equipment_ui -> epvbs.web.mark_equipment_line_essential_uc "Marks a line essential."
        epvbs.web.reserve_equipment_line_uc            -> epvbs.web.equipment_line_decision_uc "Reads the event and line afresh."
        epvbs.web.mark_equipment_line_unfulfilled_uc   -> epvbs.web.equipment_line_decision_uc "Reads the event and line afresh."
        epvbs.web.equipment_line_decision_uc           -> epvbs.web.technical_equipment_repository_port "Reads the event's stock."
        epvbs.web.record_equipment_requirement_uc      -> epvbs.web.equipment_requirement_change_uc "Checks the caller; describes the change."
        epvbs.web.edit_equipment_requirement_uc        -> epvbs.web.equipment_requirement_change_uc "Checks the caller; describes the change."
        epvbs.web.remove_equipment_requirement_uc      -> epvbs.web.equipment_requirement_change_uc "Checks the caller; describes the change."
        epvbs.web.undo_equipment_removal_uc            -> epvbs.web.equipment_requirement_change_uc "Checks the caller; describes the change."
        epvbs.web.mark_equipment_line_essential_uc     -> epvbs.web.equipment_requirement_change_uc "Checks the caller."
        epvbs.web.equipment_requirement_change_uc      -> epvbs.web.coordinator_event_repository_port "Finds the event for its assigned Coordinator."
        epvbs.web.create_equipment_item_uc          -> epvbs.web.equipment_item_e        "Builds a valid catalogue line."
        epvbs.web.update_equipment_stock_uc         -> epvbs.web.equipment_item_e        "Builds the stock change."
        epvbs.web.list_equipment_catalogue_uc       -> epvbs.web.equipment_item_e        "Works out units in service."
        epvbs.web.list_equipment_catalogue_uc       -> epvbs.web.equipment_review_e      "Works out the days a type is short."
        epvbs.web.list_equipment_queue_uc           -> epvbs.web.equipment_review_e      "Decides the list and why a line needs attention."
        epvbs.web.view_event_equipment_for_tech_uc  -> epvbs.web.equipment_review_e      "Decides attention, units free and what can be done."
        epvbs.web.reserve_equipment_line_uc         -> epvbs.web.equipment_review_e      "Checks units are free; reserves the line."
        epvbs.web.mark_equipment_line_unfulfilled_uc -> epvbs.web.equipment_review_e     "Requires a comment; marks the line unfulfilled."
        epvbs.web.release_equipment_line_uc         -> epvbs.web.equipment_review_e      "Releases the held units."
        epvbs.web.view_event_equipment_uc           -> epvbs.web.equipment_requirement_e "Decides whether the lines are editable."
        epvbs.web.record_equipment_requirement_uc   -> epvbs.web.equipment_requirement_e "Builds a valid new line."
        epvbs.web.edit_equipment_requirement_uc     -> epvbs.web.equipment_requirement_e "Applies the edit; puts a reserved line under review."
        epvbs.web.remove_equipment_requirement_uc   -> epvbs.web.equipment_requirement_e "Deletes or marks the line for removal."
        epvbs.web.undo_equipment_removal_uc         -> epvbs.web.equipment_requirement_e "Takes the removal request back."
        epvbs.web.mark_equipment_line_essential_uc  -> epvbs.web.equipment_requirement_e "Sets the essential mark."
        epvbs.web.equipment_review_e                -> epvbs.web.equipment_requirement_e "Reads a line's state and reservation."
        epvbs.web.list_equipment_catalogue_uc       -> epvbs.web.venue_search_e          "Reads today's calendar date."
        epvbs.web.create_equipment_item_uc           -> epvbs.web.equipment_catalogue_port "Saves the new line."
        epvbs.web.update_equipment_stock_uc          -> epvbs.web.equipment_catalogue_port "Finds the line; saves the change."
        epvbs.web.list_equipment_catalogue_uc        -> epvbs.web.equipment_catalogue_port "Lists the lines and their reservations."
        epvbs.web.list_equipment_catalogue_uc        -> epvbs.web.clock_port               "Reads today."
        epvbs.web.list_equipment_queue_uc            -> epvbs.web.technical_equipment_repository_port "Lists events with equipment."
        epvbs.web.view_event_equipment_for_tech_uc   -> epvbs.web.technical_equipment_repository_port "Reads one event's lines and stock."
        epvbs.web.reserve_equipment_line_uc          -> epvbs.web.technical_equipment_repository_port "Saves the reservation."
        epvbs.web.mark_equipment_line_unfulfilled_uc -> epvbs.web.technical_equipment_repository_port "Saves the decision."
        epvbs.web.release_equipment_line_uc          -> epvbs.web.technical_equipment_repository_port "Releases the line."
        epvbs.web.view_event_equipment_uc            -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.view_event_equipment_uc            -> epvbs.web.equipment_requirement_repository_port "Reads the lines and the catalogue."
        epvbs.web.record_equipment_requirement_uc    -> epvbs.web.equipment_requirement_repository_port "Adds the line."
        epvbs.web.edit_equipment_requirement_uc      -> epvbs.web.equipment_requirement_repository_port "Updates the line."
        epvbs.web.remove_equipment_requirement_uc    -> epvbs.web.equipment_requirement_repository_port "Deletes or updates the line."
        epvbs.web.undo_equipment_removal_uc          -> epvbs.web.equipment_requirement_repository_port "Updates the line."
        epvbs.web.mark_equipment_line_essential_uc   -> epvbs.web.equipment_requirement_repository_port "Saves the mark."
        epvbs.web.record_equipment_requirement_uc    -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.edit_equipment_requirement_uc      -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.remove_equipment_requirement_uc    -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.undo_equipment_removal_uc          -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.mark_equipment_line_essential_uc   -> epvbs.web.coordinator_event_repository_port "Finds the event."
        epvbs.web.supabase_equipment_catalogue_ad    -> epvbs.web.equipment_catalogue_port "Implements."
        epvbs.web.supabase_equipment_requirements_ad -> epvbs.web.equipment_requirement_repository_port "Implements."
        epvbs.web.supabase_technical_equipment_ad    -> epvbs.web.technical_equipment_repository_port "Implements."
        epvbs.web.supabase_equipment_catalogue_ad    -> epvbs.db "Reads and writes the equipment catalogue." "PostgREST RPC"
        epvbs.web.supabase_equipment_requirements_ad -> epvbs.db "Reads and writes an event's equipment lines." "PostgREST RPC"
        epvbs.web.supabase_technical_equipment_ad    -> epvbs.db "Reads equipment lines; records Technical Support's decisions." "PostgREST RPC"
        epvbs.web.in_memory_ad -> epvbs.web.equipment_catalogue_port                "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.equipment_requirement_repository_port   "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.technical_equipment_repository_port     "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.create_equipment_item_uc          "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.update_equipment_stock_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_equipment_catalogue_uc       "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_equipment_queue_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_event_equipment_for_tech_uc  "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.reserve_equipment_line_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.mark_equipment_line_unfulfilled_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.release_equipment_line_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_event_equipment_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.record_equipment_requirement_uc   "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.edit_equipment_requirement_uc     "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.remove_equipment_requirement_uc   "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.undo_equipment_removal_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.mark_equipment_line_essential_uc  "Constructs it with its adapters."

        # ---------------------------------------------------------------------
        # L3 — Notifications, safety checks, change requests (fragment: notify)
        # ---------------------------------------------------------------------

        epvbs.web.supabase_recording_notifier_ad -> epvbs.web.notifier_port "Implements, wrapping the Notifier that delivers."
        epvbs.web.supabase_recording_notifier_ad -> epvbs.db "Records each notice, as the service role." "PostgREST"
        epvbs.web.novu_notifier_ad -> epvbs.web.notifier_port "Implements."
        epvbs.web.novu_notifier_ad -> epvbs.web.logging_notifier_ad "Logs the Connections request, which has no workflow."
        epvbs.web.novu_notifier_ad -> epvbs.web.novu_workflows_ad "Names the workflow to trigger for each notice."
        epvbs.web.novu_notifier_ad -> novu "Triggers the workflow for a recipient." "HTTPS"
        epvbs.web.novu_workflows_ad -> epvbs.web.notification_content_ad "Takes each notice's wording."
        epvbs.web.novu_bridge_ui -> epvbs.web.novu_workflows_ad "Serves the workflow definitions."
        novu -> epvbs.web.novu_bridge_ui "Fetches the workflow definitions and runs the steps." "HTTPS"
        epvbs.web.staff_inbox_ui -> novu "Reads, marks read and archives the inbox; sets preferences." "HTTPS"
        epvbs.web.staff_shell_ui -> epvbs.web.staff_inbox_ui "Mounts the inbox provider with the signed subscriber id."
        epvbs.web.staff_shell_ui -> epvbs.web.notify_expired_holds_uc "Sweeps expired holds after each page view."
        epvbs.web.composition_root -> epvbs.web.novu_subscriber_hash_ad "Signs the signed-in member's subscriber id."
        epvbs.web.announce_equipment_attention_uc -> epvbs.web.notifier_port "Tells Technical Support a line needs attention."
        epvbs.web.announce_equipment_attention_uc -> epvbs.web.equipment_notice_directory_port "Lists the Technical Support staff."
        epvbs.web.announce_equipment_outcome_uc -> epvbs.web.notifier_port "Tells the Coordinator every line's outcome."
        epvbs.web.announce_equipment_outcome_uc -> epvbs.web.equipment_notice_directory_port "Finds the event's assigned Coordinator."
        epvbs.web.announce_attendee_change_uc -> epvbs.web.notifier_port "Emails each attendee the reschedule or cancellation."
        epvbs.web.announce_safety_check_entry_uc -> epvbs.web.notifier_port "Tells each Safety Officer an event is ready."
        epvbs.web.announce_safety_check_entry_uc -> epvbs.web.safety_check_watch_port "Reads the candidate and lists the Safety Officers."
        epvbs.web.announce_safety_check_entry_uc -> epvbs.web.safety_check_e "Asks whether the change put the event on the list."
        epvbs.web.notify_expired_holds_uc -> epvbs.web.notifier_port "Tells the Coordinator the hold expired."
        epvbs.web.notify_expired_holds_uc -> epvbs.web.expired_hold_notices_port "Claims the holds that have expired."
        epvbs.web.supabase_expired_hold_notices_ad -> epvbs.web.expired_hold_notices_port "Implements."
        epvbs.web.supabase_equipment_notice_directory_ad -> epvbs.web.equipment_notice_directory_port "Implements."
        epvbs.web.supabase_expired_hold_notices_ad -> epvbs.db "Claims expired holds." "PostgREST RPC"
        epvbs.web.supabase_equipment_notice_directory_ad -> epvbs.db "Reads Technical Support staff and an event's Coordinator." "PostgREST RPC"
        epvbs.web.in_memory_ad -> epvbs.web.expired_hold_notices_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.equipment_notice_directory_port "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.announce_equipment_attention_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.announce_equipment_outcome_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.announce_attendee_change_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.announce_safety_check_entry_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.notify_expired_holds_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.supabase_recording_notifier_ad "Wraps the delivering notifier in it for every use case."
        epvbs.web.composition_root -> epvbs.web.novu_notifier_ad "Chooses it when Novu is configured."
        epvbs.web.composition_root -> epvbs.web.logging_notifier_ad "Falls back to it without Novu."
        epvbs.web.safety_list_ui -> epvbs.web.list_awaiting_safety_uc "Lists the events awaiting a check."
        epvbs.web.safety_review_ui -> epvbs.web.view_safety_check_uc "Reads one event for review."
        epvbs.web.safety_review_ui -> epvbs.web.record_safety_check_uc "Records Approved or Rejected."
        epvbs.web.coord_events_ui -> epvbs.web.view_event_safety_checks_uc "Reads the event's recorded checks."
        epvbs.web.coord_events_ui -> epvbs.web.resubmit_safety_check_uc "Sends a rejected event back for a check."
        epvbs.web.list_awaiting_safety_uc -> epvbs.web.safety_check_e "Keeps the events that await a check."
        epvbs.web.view_safety_check_uc -> epvbs.web.safety_check_e "Asks whether the event awaits a check."
        epvbs.web.record_safety_check_uc -> epvbs.web.safety_check_e "Builds the check; a rejection needs comments."
        epvbs.web.resubmit_safety_check_uc -> epvbs.web.safety_check_e "Asks whether the event can be resubmitted."
        epvbs.web.view_event_safety_checks_uc -> epvbs.web.safety_check_e "Asks whether the event can be resubmitted."
        epvbs.web.list_awaiting_safety_uc -> epvbs.web.safety_check_candidate_repository_port "Lists the candidates."
        epvbs.web.view_safety_check_uc -> epvbs.web.safety_check_repository_port "Reads the review."
        epvbs.web.record_safety_check_uc -> epvbs.web.safety_check_repository_port "Records the check."
        epvbs.web.record_safety_check_uc -> epvbs.web.notifier_port "Tells the Coordinator the outcome."
        epvbs.web.resubmit_safety_check_uc -> epvbs.web.safety_check_repository_port "Reads the history and resubmits."
        epvbs.web.resubmit_safety_check_uc -> epvbs.web.announce_safety_check_entry_uc "Tells the Safety Officers it is back on their list."
        epvbs.web.view_event_safety_checks_uc -> epvbs.web.safety_check_repository_port "Reads the history."
        epvbs.web.supabase_safety_check_ad -> epvbs.web.safety_check_repository_port "Implements."
        epvbs.web.supabase_safety_check_candidate_ad -> epvbs.web.safety_check_candidate_repository_port "Implements."
        epvbs.web.supabase_safety_check_watch_ad -> epvbs.web.safety_check_watch_port "Implements."
        epvbs.web.supabase_safety_check_ad -> epvbs.db "Reads and records safety checks." "PostgREST RPC"
        epvbs.web.supabase_safety_check_candidate_ad -> epvbs.db "Reads the candidate events." "PostgREST RPC"
        epvbs.web.supabase_safety_check_watch_ad -> epvbs.db "Reads candidates and Safety Officers, as the service role." "PostgREST RPC"
        epvbs.web.in_memory_ad -> epvbs.web.safety_check_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.safety_check_candidate_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.safety_check_watch_port "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.list_awaiting_safety_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_safety_check_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.record_safety_check_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.resubmit_safety_check_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_event_safety_checks_uc "Constructs it with its adapters."
        epvbs.web.org_change_request_ui -> epvbs.web.submit_change_request_uc "Files the change request."
        epvbs.web.coord_change_request_ui -> epvbs.web.view_event_change_requests_uc "Reads the open and decided requests."
        epvbs.web.coord_change_request_ui -> epvbs.web.decide_change_request_uc "Accepts or declines each field."
        epvbs.web.coord_events_ui -> epvbs.web.view_event_change_requests_uc "Reads the event's change requests."
        epvbs.web.submit_change_request_uc -> epvbs.web.change_request_e "Checks the caller may ask; keeps each field once."
        epvbs.web.decide_change_request_uc -> epvbs.web.change_request_e "Checks the caller may decide; applies the decision."
        epvbs.web.view_event_change_requests_uc -> epvbs.web.change_request_e "Splits requests into pending and decided."
        epvbs.web.submit_change_request_uc -> epvbs.web.change_request_repository_port "Finds the target and saves the request."
        epvbs.web.submit_change_request_uc -> epvbs.web.notifier_port "Tells the Coordinator what was asked."
        epvbs.web.decide_change_request_uc -> epvbs.web.change_request_repository_port "Records the decision."
        epvbs.web.decide_change_request_uc -> epvbs.web.confirmation_lapses_port "Finds what the decision took out of Confirmed."
        epvbs.web.decide_change_request_uc -> epvbs.web.notifier_port "Tells the Organiser the outcome, reschedule or lapse."
        epvbs.web.decide_change_request_uc -> epvbs.web.announce_equipment_attention_uc "Tells Technical Support of lines new dates released."
        epvbs.web.decide_change_request_uc -> epvbs.web.announce_attendee_change_uc "Emails attendees of a reschedule."
        epvbs.web.view_event_change_requests_uc -> epvbs.web.change_request_repository_port "Lists the event's requests."
        epvbs.web.view_event_change_requests_uc -> epvbs.web.coordinator_event_repository_port "Reads the event's current values."
        epvbs.web.decide_change_request_uc -> epvbs.web.coordinator_event_repository_port "Reads the event being changed."
        epvbs.web.supabase_change_request_ad -> epvbs.web.change_request_repository_port "Implements."
        epvbs.web.supabase_change_request_ad -> epvbs.db "Reads and writes change requests." "PostgREST RPC"
        epvbs.web.in_memory_ad -> epvbs.web.change_request_repository_port "Implements, for tests."
        epvbs.web.composition_root -> epvbs.web.submit_change_request_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.decide_change_request_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.view_event_change_requests_uc "Constructs it with its adapters."

        # Cross-area edges the per-area drafts could not draw alone.
        epvbs.web.confirm_event_uc -> epvbs.web.safety_check_repository_port "Reads the safety-check history."
        epvbs.web.view_coordinator_event_uc -> epvbs.web.safety_check_repository_port "Reads the safety-check history."
        epvbs.web.view_coordinator_event_uc -> epvbs.web.safety_check_e "Asks whether a safety check blocks confirmation."
        epvbs.web.view_coordinator_event_uc -> epvbs.web.booking_flag_repository_port "Reads the open flags on its bookings."
        epvbs.web.event_readiness_e -> epvbs.web.equipment_requirement_e "Asks whether each requirement is reserved in full."
        epvbs.web.event_readiness_e -> epvbs.web.safety_check_e "Asks whether a safety check blocks confirmation."
        epvbs.web.event_registration_settings_e -> epvbs.web.booking_e "Checks a date is a calendar date."
        epvbs.web.confirm_event_uc -> epvbs.web.announce_attendee_change_uc "Tells the Attendees."
        epvbs.web.cancel_event_uc -> epvbs.web.announce_attendee_change_uc "Tells the Attendees."
        epvbs.web.venue_booking_ui -> epvbs.web.set_event_required_facilities_uc "Saves the facilities the event needs."
        epvbs.web.venue_booking_ui -> epvbs.web.find_assigned_event_by_request_uc "Finds the event a request became."
        epvbs.web.coord_event_detail_ui -> epvbs.web.view_event_change_requests_uc "Reads the event's change requests."
        epvbs.web.coord_event_detail_ui -> epvbs.web.view_event_safety_checks_uc "Reads the event's safety checks."
        epvbs.web.coord_event_detail_ui -> epvbs.web.view_venue_booking_options_uc "Reads the venue booking options."
        epvbs.web.record_equipment_requirement_uc -> epvbs.web.announce_equipment_attention_uc "Tells Technical Support."
        epvbs.web.edit_equipment_requirement_uc -> epvbs.web.announce_equipment_attention_uc "Tells Technical Support."
        epvbs.web.remove_equipment_requirement_uc -> epvbs.web.announce_equipment_attention_uc "Tells Technical Support."
        epvbs.web.undo_equipment_removal_uc -> epvbs.web.announce_equipment_attention_uc "Tells Technical Support."
        epvbs.web.reserve_equipment_line_uc -> epvbs.web.announce_equipment_outcome_uc "Tells the Coordinator the outcome."
        epvbs.web.mark_equipment_line_unfulfilled_uc -> epvbs.web.announce_equipment_outcome_uc "Tells the Coordinator the outcome."
        epvbs.web.release_equipment_line_uc -> epvbs.web.announce_equipment_outcome_uc "Tells the Coordinator the outcome."
        epvbs.web.edit_equipment_requirement_uc -> epvbs.web.announce_safety_check_entry_uc "Announces a safety-check entry."
        epvbs.web.remove_equipment_requirement_uc -> epvbs.web.announce_safety_check_entry_uc "Announces a safety-check entry."
        epvbs.web.undo_equipment_removal_uc -> epvbs.web.announce_safety_check_entry_uc "Announces a safety-check entry."
        epvbs.web.announce_equipment_outcome_uc -> epvbs.web.technical_equipment_repository_port "Reads the event's equipment."
        epvbs.web.decide_booking_request_uc -> epvbs.web.announce_safety_check_entry_uc "Wraps the decision with the safety-check announcement."
        epvbs.web.decide_change_request_uc -> epvbs.web.equipment_requirement_repository_port "Reads the event's equipment requirements."
        epvbs.web.decide_change_request_uc -> epvbs.web.event_readiness_repository_port "Reads the event's readiness facts."
        epvbs.web.announce_attendee_change_uc -> epvbs.web.registration_repository_port "Lists the event's Registered attendees."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — driven adapters reach infrastructure
        # RPCs per adapter, for tracing (all security definer, in supabase/migrations):
        #   event requests  organiser_event_requests, organiser_event_request,
        #                   organiser_submit_event_request, organiser_save_event_request,
        #                   organiser_discard_event_request_draft,
        #                   organiser_reassign_event_request, operations_event_requests,
        #                   operations_assign_event_coordinator, coordinator_event_requests,
        #                   coordinator_decide_event_request (also writes audit_record)
        #   user accounts   user_account_names, organisation_event_organisers,
        #                   operations_event_coordinators
        #   client orgs     client_organisation_names
        #   coord. events   coordinator_events
        #   registrations   attendee_places_taken, attendee_live_registration,
        #                   attendee_register, attendee_registration, attendee_withdraw
        # EventCatalogue, UserRepository and AuditLogger read or write tables directly.
        # ---------------------------------------------------------------------

        epvbs.web.supabase_auth_ad            -> epvbs.auth "Signs in, reads claims, signs out." "Supabase Auth"
        epvbs.web.supabase_user_ad            -> epvbs.db   "Reads the account and its roles, as the service role." "PostgREST"
        epvbs.web.supabase_audit_ad           -> epvbs.db   "Inserts audit records, as the service role." "PostgREST"
        epvbs.web.supabase_event_requests_ad  -> epvbs.db   "Reads and writes event requests." "PostgREST RPC"
        epvbs.web.supabase_user_accounts_ad   -> epvbs.db   "Reads account names, Organisers and Coordinators." "PostgREST RPC"
        epvbs.web.supabase_client_orgs_ad     -> epvbs.db   "Reads organisation names." "PostgREST RPC"
        epvbs.web.supabase_coord_events_ad    -> epvbs.db   "Reads the Coordinator's events." "PostgREST RPC"
        epvbs.web.supabase_event_catalogue_ad -> epvbs.db   "Reads Confirmed events." "PostgREST"
        epvbs.web.supabase_registrations_ad   -> epvbs.db   "Reads and writes registrations." "PostgREST RPC"

        # ---------------------------------------------------------------------
        # L3 — Domain map (view: components-domains). One arrow per pair; the label
        # lists every interaction folded into it. Role arrows are curated from the
        # driving adapters' descriptions: the model has no person-to-adapter edges.
        # ---------------------------------------------------------------------

        safety_officer -> epvbs.web.dom_safety "Sees the events awaiting a check; records Approved or Rejected."
        organiser -> epvbs.web.dom_requests "Drafts, submits, tracks and hands over requests; answers clarifications."
        organiser -> epvbs.web.dom_changes "Files change requests on a confirmed event."
        ops_manager -> epvbs.web.dom_requests "Assigns Event Coordinators; reassigns an active event."
        coordinator -> epvbs.web.dom_requests "Reviews, decides and asks for clarification on assigned requests."
        coordinator -> epvbs.web.dom_events "Confirms, cancels and completes events; edits details, registration and facilities."
        coordinator -> epvbs.web.dom_venues "Searches venues; requests, changes and cancels bookings."
        coordinator -> epvbs.web.dom_equipment "Records, edits and removes an event's equipment lines."
        coordinator -> epvbs.web.dom_safety "Reads an event's checks and resubmits a rejected one."
        coordinator -> epvbs.web.dom_changes "Decides an Organiser's change requests."
        venue_staff -> epvbs.web.dom_venues "Maintains the catalogue, decides booking requests, blocks venues."
        tech_staff -> epvbs.web.dom_equipment "Maintains the equipment catalogue; reserves or declines each line."
        attendee -> epvbs.web.dom_registration "Browses open events; registers and withdraws by reference."

        epvbs.web.dom_changes -> epvbs.web.dom_equipment "Reads the event's equipment requirements."
        epvbs.web.dom_changes -> epvbs.web.dom_requests "Reads the event's current values."
        epvbs.web.dom_changes -> epvbs.web.dom_events "Reads the event's readiness facts."
        epvbs.web.dom_changes -> epvbs.web.dom_notifications "Tells the Coordinator what was asked, the Organiser the outcome, Technical Support the lines released, and attendees of a reschedule."
        epvbs.web.dom_changes -> epvbs.web.dom_venues "Finds what a decision took out of Confirmed."
        epvbs.web.dom_equipment -> epvbs.web.dom_notifications "Tells Technical Support a line needs attention, tells the Coordinator each line's outcome, and announces a safety-check entry."
        epvbs.web.dom_requests -> epvbs.web.dom_changes "Shows the event's change requests."
        epvbs.web.dom_requests -> epvbs.web.dom_safety "Shows an event's safety checks and resubmits a rejected event."
        epvbs.web.dom_requests -> epvbs.web.dom_venues "Shows the event's booking flags and venue booking options."
        epvbs.web.dom_events -> epvbs.web.dom_equipment "Asks whether every requirement is reserved in full."
        epvbs.web.dom_events -> epvbs.web.dom_requests "Finds the event and saves its facilities."
        epvbs.web.dom_events -> epvbs.web.dom_notifications "Tells attendees of a confirmation or cancellation."
        epvbs.web.dom_events -> epvbs.web.dom_safety "Asks whether a safety check blocks confirmation."
        epvbs.web.dom_events -> epvbs.web.dom_venues "Checks a registration date is a calendar date."
        epvbs.web.dom_identity -> epvbs.web.dom_requests "The staff shell reads each role's request queue for its sidebar."
        epvbs.web.dom_identity -> epvbs.web.dom_equipment "The staff shell fills Technical Support's queue pane."
        epvbs.web.dom_equipment -> epvbs.web.dom_requests "Finds the event for its assigned Coordinator."
        epvbs.web.dom_equipment -> epvbs.web.dom_venues "Reads today's calendar date."
        epvbs.web.dom_registration -> epvbs.web.dom_events "Orders events by their first start."
        epvbs.web.dom_registration -> epvbs.web.dom_notifications "Confirms the registration to the Attendee."
        epvbs.web.dom_requests -> epvbs.web.dom_events "The Coordinator's pages confirm, cancel, complete and edit an event."
        epvbs.web.dom_requests -> epvbs.web.dom_notifications "Tells the Coordinator and the Organiser of an assignment, reassignment or decision."
        epvbs.web.dom_identity -> epvbs.web.dom_notifications "The staff shell mounts the inbox and sweeps expired holds after each page view."
        epvbs.web.dom_identity -> epvbs.web.dom_venues "The staff shell lists booking requests in the Venue Staff sidebar."
        epvbs.web.dom_notifications -> epvbs.web.dom_equipment "Reads an event's equipment to report each line's outcome."
        epvbs.web.dom_notifications -> epvbs.web.dom_registration "Lists the event's Registered attendees."
        epvbs.web.dom_notifications -> epvbs.web.dom_safety "Lists the Safety Officers and asks whether an event is on their list."
        epvbs.web.dom_safety -> epvbs.web.dom_notifications "Tells the Coordinator the outcome and the Safety Officers a rejected event is back."
        epvbs.web.dom_venues -> epvbs.web.dom_requests "Finds the Coordinator's event for a booking."
        epvbs.web.dom_venues -> epvbs.web.dom_events "Saves the facilities an event needs."
        epvbs.web.dom_venues -> epvbs.web.dom_notifications "Wraps a booking decision with the safety-check announcement."

        epvbs.web.dom_identity -> epvbs.auth "Signs users in, reads claims and signs them out."
        epvbs.web.dom_identity -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_requests -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_events -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_registration -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_venues -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_safety -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_changes -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_equipment -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_notifications -> epvbs.db "Reads and writes through its repository adapters."
        epvbs.web.dom_notifications -> novu "Sends notifications and drives the staff inbox."
    }

    views {

        systemContext epvbs "context" "Who uses the Event Planning and Venue Booking System, and what crosses its boundary." {
            include *
            # Notification return edges live in the model for the journey workspaces; at L1
            # they only add noise, so the context view keeps just the actor -> system edges.
            exclude "epvbs -> organiser" "epvbs -> coordinator" "epvbs -> venue_staff" "epvbs -> tech_staff" "epvbs -> safety_officer" "epvbs -> attendee"
            autoLayout lr
            default
        }

        container epvbs "containers" "What the system is made of: one web application, its database, and the authentication service." {
            include *
            autoLayout lr
        }

        component epvbs.web "components" "Inside the web application: the Ports & Adapters rings, grouped by module. Colour = ring, boundary = module." {
            include *
            # Wiring edges. Both say "the composition root assembles this"; drawn in
            # the sprint lenses, where there is room for them.
            exclude "epvbs.web.composition_root -> *"
            exclude "epvbs.web.in_memory_ad -> *"
            exclude epvbs.web.dom_identity epvbs.web.dom_requests epvbs.web.dom_events epvbs.web.dom_registration epvbs.web.dom_venues epvbs.web.dom_safety epvbs.web.dom_changes epvbs.web.dom_equipment epvbs.web.dom_notifications epvbs.web.dom_reporting
            autoLayout lr
        }

        component epvbs.web "components-domains" "The domain map: one box per module, who uses it, and how the modules depend on each other. Open a module view for its use cases." {
            include epvbs.web.dom_identity epvbs.web.dom_requests epvbs.web.dom_events epvbs.web.dom_registration epvbs.web.dom_venues epvbs.web.dom_safety epvbs.web.dom_changes epvbs.web.dom_equipment epvbs.web.dom_notifications epvbs.web.dom_reporting attendee coordinator ops_manager organiser safety_officer tech_staff venue_staff epvbs.auth novu
            autoLayout lr
        }

        # ---------------------------------------------------------------------
        # ONE VIEW PER MODULE — the full "components" view is the whole system at
        # once; each view below is one module's slice, driving adapter to database.
        # ---------------------------------------------------------------------

        component epvbs.web "components-identity" "Identity & Access: login, logout, the session middleware and the staff shell's role gate." {
            include epvbs.web.login_ui epvbs.web.logout_ui epvbs.web.session_mw_ui epvbs.web.staff_shell_ui
            include epvbs.web.login_uc epvbs.web.logout_uc epvbs.web.identify_staff_uc
            include epvbs.web.staff_member_e
            include epvbs.web.auth_port epvbs.web.user_repository_port epvbs.web.audit_logger_port
            include epvbs.web.supabase_auth_ad epvbs.web.supabase_user_ad epvbs.web.supabase_audit_ad
            include epvbs.db epvbs.auth
            autoLayout lr
        }

        component epvbs.web "components-organiser" "Event Requests as the Organiser drives them: draft, submit, discard, view, and hand to another Organiser." {
            include epvbs.web.request_form_ui epvbs.web.my_requests_ui epvbs.web.org_requests_ui
            include epvbs.web.save_draft_uc epvbs.web.submit_request_uc epvbs.web.discard_draft_uc
            include epvbs.web.view_my_requests_uc epvbs.web.view_organiser_request_uc epvbs.web.view_org_requests_uc
            include epvbs.web.change_organiser_uc epvbs.web.list_org_organisers_uc
            include epvbs.web.event_request_e
            include epvbs.web.event_request_repository_port epvbs.web.user_account_repository_port epvbs.web.clock_port
            include epvbs.web.supabase_event_requests_ad epvbs.web.supabase_user_accounts_ad epvbs.web.system_clock_ad
            include epvbs.db
            # Clarification: the Organiser's reply.
            include epvbs.web.post_clarification_uc epvbs.web.clarification_thread_port epvbs.web.supabase_clarification_ad
            autoLayout lr
        }

        component epvbs.web "components-operations" "Event Requests as the Operations Manager drives them: the queue, one request, and assigning a Coordinator." {
            include epvbs.web.ops_console_ui epvbs.web.staff_shell_ui
            include epvbs.web.view_all_requests_uc epvbs.web.view_ops_request_uc epvbs.web.view_all_coordinators_uc epvbs.web.assign_coordinator_uc
            include epvbs.web.event_request_e
            include epvbs.web.event_request_repository_port epvbs.web.user_account_repository_port
            include epvbs.web.supabase_event_requests_ad epvbs.web.supabase_user_accounts_ad
            include epvbs.db
            # The staff shell stays for its queue edge; its other role edges belong elsewhere.
            exclude "epvbs.web.staff_shell_ui -> epvbs.web.view_my_requests_uc"
            autoLayout lr
        }

        component epvbs.web "components-coordinator" "Event Requests as the Coordinator drives them: queue, archive, one request, the decision, and My events." {
            include epvbs.web.coord_requests_ui epvbs.web.coord_events_ui
            include epvbs.web.view_assigned_requests_uc epvbs.web.view_archived_uc epvbs.web.view_assigned_request_uc
            include epvbs.web.decide_request_uc epvbs.web.view_assigned_events_uc
            include epvbs.web.event_request_e
            include epvbs.web.event_request_repository_port epvbs.web.client_org_repository_port
            include epvbs.web.user_account_repository_port epvbs.web.coordinator_event_repository_port
            include epvbs.web.supabase_event_requests_ad epvbs.web.supabase_client_orgs_ad
            include epvbs.web.supabase_user_accounts_ad epvbs.web.supabase_coord_events_ad
            include epvbs.db
            # Clarification and withdrawal, merged 2026-09-29.
            include epvbs.web.request_clarification_uc epvbs.web.post_coord_clarification_uc epvbs.web.resolve_clarification_uc
            include epvbs.web.clarification_message_e epvbs.web.clarification_thread_port epvbs.web.supabase_clarification_ad
            include epvbs.web.withdraw_request_uc
            autoLayout lr
        }

        component epvbs.web "components-registration" "Registration: an Attendee with no account browses open events, registers, and withdraws by reference." {
            include epvbs.web.events_browse_ui epvbs.web.registration_page_ui
            include epvbs.web.list_open_events_uc epvbs.web.view_event_for_registration_uc epvbs.web.register_uc
            include epvbs.web.view_registration_uc epvbs.web.withdraw_uc
            include epvbs.web.event_e epvbs.web.registration_e epvbs.web.attendee_e
            include epvbs.web.event_catalogue_port epvbs.web.registration_repository_port epvbs.web.clock_port
            include epvbs.web.supabase_event_catalogue_ad epvbs.web.supabase_registrations_ad epvbs.web.system_clock_ad
            include epvbs.db attendee
            autoLayout lr
        }

        component epvbs.web "components-venues" "Venues: Venue Staff maintain the catalogue; a Coordinator searches it against what is already booked." {
            include epvbs.web.venue_catalogue_ui epvbs.web.venue_search_ui
            include epvbs.web.list_venues_uc epvbs.web.view_venue_uc epvbs.web.create_venue_uc epvbs.web.update_venue_uc epvbs.web.search_venues_uc
            include epvbs.web.venue_e epvbs.web.venue_search_e epvbs.web.venue_options_e
            include epvbs.web.venue_catalogue_port epvbs.web.venue_availability_port epvbs.web.clock_port
            include epvbs.web.supabase_venue_catalogue_ad epvbs.web.supabase_venue_availability_ad epvbs.web.system_clock_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-events" "Events: confirm, cancel, complete and edit an event, set registration and facilities, and the readiness rules." {
            include epvbs.web.confirm_event_uc epvbs.web.cancel_event_uc epvbs.web.complete_event_uc epvbs.web.update_event_details_uc
            include epvbs.web.set_event_registration_uc epvbs.web.set_event_required_facilities_uc epvbs.web.event_readiness_e epvbs.web.event_times_e
            include epvbs.web.event_facilities_e epvbs.web.event_cancellation_e epvbs.web.event_completion_e epvbs.web.event_details_edit_e
            include epvbs.web.event_registration_settings_e epvbs.web.event_readiness_repository_port epvbs.web.supabase_event_readiness_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-venues-booking" "Venues: booking. A Coordinator requests a venue for an event; Venue Staff review and decide." {
            include epvbs.web.venue_booking_ui epvbs.web.booking_review_ui epvbs.web.view_venue_booking_options_uc epvbs.web.submit_venue_booking_request_uc
            include epvbs.web.change_booking_room_layout_uc epvbs.web.cancel_venue_booking_uc epvbs.web.clear_booking_flag_uc epvbs.web.review_booking_requests_uc
            include epvbs.web.decide_booking_request_uc epvbs.web.booking_e epvbs.web.booking_review_flag_e epvbs.web.venue_change_flag_e
            include epvbs.web.venue_suitability_e epvbs.web.booking_repository_port epvbs.web.booking_review_repository_port epvbs.web.booking_flag_repository_port
            include epvbs.web.venue_change_review_port epvbs.web.venue_staff_directory_port epvbs.web.supabase_booking_ad epvbs.web.supabase_booking_review_ad
            include epvbs.web.supabase_booking_flag_ad epvbs.web.supabase_venue_change_review_ad epvbs.web.supabase_venue_staff_directory_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-venues-calendar" "Venues: calendar. Weekly and daily calendars, blocks, and the time, hours and buffer rules." {
            include epvbs.web.venue_calendar_ui epvbs.web.venue_unavailability_ui epvbs.web.view_venue_calendar_uc epvbs.web.view_venues_on_day_uc
            include epvbs.web.record_venue_unavailability_uc epvbs.web.list_venue_unavailability_uc epvbs.web.lift_venue_unavailability_uc epvbs.web.venue_calendar_e
            include epvbs.web.venue_unavailability_e epvbs.web.venue_buffers_e epvbs.web.opening_hours_e epvbs.web.padded_window_e
            include epvbs.web.slot_grid_e epvbs.web.time_of_day_e epvbs.web.venue_unavailability_repository_port epvbs.web.confirmation_lapses_port
            include epvbs.web.supabase_venue_unavailability_ad epvbs.web.supabase_confirmation_lapses_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-equipment" "Equipment: the catalogue, requirements on an event, and Technical Support reservations." {
            include epvbs.web.tech_catalogue_ui epvbs.web.tech_queue_ui epvbs.web.tech_review_ui epvbs.web.coord_equipment_ui
            include epvbs.web.create_equipment_item_uc epvbs.web.update_equipment_stock_uc epvbs.web.list_equipment_catalogue_uc epvbs.web.list_equipment_queue_uc
            include epvbs.web.view_event_equipment_for_tech_uc epvbs.web.reserve_equipment_line_uc epvbs.web.mark_equipment_line_unfulfilled_uc epvbs.web.release_equipment_line_uc
            include epvbs.web.equipment_line_decision_uc epvbs.web.view_event_equipment_uc epvbs.web.record_equipment_requirement_uc epvbs.web.edit_equipment_requirement_uc
            include epvbs.web.remove_equipment_requirement_uc epvbs.web.undo_equipment_removal_uc epvbs.web.mark_equipment_line_essential_uc epvbs.web.equipment_requirement_change_uc
            include epvbs.web.equipment_item_e epvbs.web.equipment_requirement_e epvbs.web.equipment_review_e epvbs.web.equipment_catalogue_port
            include epvbs.web.equipment_requirement_repository_port epvbs.web.technical_equipment_repository_port epvbs.web.supabase_equipment_catalogue_ad epvbs.web.supabase_equipment_requirements_ad
            include epvbs.web.supabase_technical_equipment_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-notifications" "Notifications: the announcers, the Notifier adapters, Novu and the staff inbox." {
            include epvbs.web.notifier_port epvbs.web.logging_notifier_ad epvbs.web.announce_equipment_attention_uc epvbs.web.announce_equipment_outcome_uc
            include epvbs.web.announce_attendee_change_uc epvbs.web.announce_safety_check_entry_uc epvbs.web.notify_expired_holds_uc epvbs.web.expired_hold_notices_port
            include epvbs.web.equipment_notice_directory_port epvbs.web.supabase_expired_hold_notices_ad epvbs.web.supabase_equipment_notice_directory_ad epvbs.web.supabase_recording_notifier_ad
            include epvbs.web.novu_notifier_ad epvbs.web.novu_subscriber_hash_ad epvbs.web.novu_workflows_ad epvbs.web.notification_content_ad
            include epvbs.web.novu_bridge_ui epvbs.web.staff_inbox_ui
            include epvbs.db
            include novu
            autoLayout lr
        }

        component epvbs.web "components-safety" "Safety checks: events awaiting a check, and the Safety Officer recording one." {
            include epvbs.web.safety_list_ui epvbs.web.safety_review_ui epvbs.web.list_awaiting_safety_uc epvbs.web.view_safety_check_uc
            include epvbs.web.record_safety_check_uc epvbs.web.resubmit_safety_check_uc epvbs.web.view_event_safety_checks_uc epvbs.web.safety_check_e
            include epvbs.web.safety_check_repository_port epvbs.web.safety_check_candidate_repository_port epvbs.web.safety_check_watch_port epvbs.web.supabase_safety_check_ad
            include epvbs.web.supabase_safety_check_candidate_ad epvbs.web.supabase_safety_check_watch_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-change-requests" "Change requests: an Organiser asks to change a confirmed event; the Coordinator decides." {
            include epvbs.web.org_change_request_ui epvbs.web.coord_change_request_ui epvbs.web.submit_change_request_uc epvbs.web.decide_change_request_uc
            include epvbs.web.view_event_change_requests_uc epvbs.web.change_request_e epvbs.web.change_request_repository_port epvbs.web.supabase_change_request_ad
            include epvbs.db
            autoLayout lr
        }

        component epvbs.web "components-lead" "Event Coordinator Lead: workload and reassigning an event\'s Coordinator." {
            include epvbs.web.ops_console_ui epvbs.web.view_all_requests_uc epvbs.web.view_ops_request_uc epvbs.web.view_all_coordinators_uc
            include epvbs.web.assign_coordinator_uc epvbs.web.lead_workload_ui epvbs.web.lead_event_ui epvbs.web.view_coordinator_workloads_uc
            include epvbs.web.view_lead_event_uc epvbs.web.reassign_event_coordinator_uc epvbs.web.coordinator_workload_e epvbs.web.lead_event_repository_port
            include epvbs.web.supabase_lead_events_ad
            include epvbs.db
            autoLayout lr
        }

        styles {

            element "Person" {
                shape person
                background "#fff2cc"
                stroke "#d6b656"
                strokeWidth 2
                color "#7f6000"
            }

            element "Software System" {
                shape RoundedBox
                background "#dae8fc"
                stroke "#6c8ebf"
                strokeWidth 2
                color "#1f3864"
            }

            element "Container" {
                shape RoundedBox
                background "#dae8fc"
                stroke "#6c8ebf"
                strokeWidth 2
                color "#1f3864"
            }

            element "Database" {
                shape Cylinder
            }

            element "Component" {
                shape Component
                background "#eef5fd"
                stroke "#6c8ebf"
                strokeWidth 2
                color "#1f3864"
            }

            element "External" {
                background "#e8f8f5"
                stroke "#1abc9c"
                strokeWidth 2
                color "#0e6655"
            }

            element "External Unknown" {
                background "#fdecea"
                stroke "#e74c3c"
                strokeWidth 2
                color "#922b21"
                border dashed
            }

            # -------------------------------------------------------------
            # RING TAGS — the Ports & Adapters position of a component.
            # Read outside-in: orange drives the application, blue orchestrates,
            # green decides, dashed grey is the contract, purple satisfies it.
            # Legend recorded in ../GLOSSARY.md.
            # -------------------------------------------------------------

            element "Driving Adapter" {
                background "#fde9d9"
                stroke "#d79b00"
                color "#7f3f00"
            }

            element "Use Case" {
                background "#dae8fc"
                stroke "#6c8ebf"
                color "#1f3864"
            }

            element "Domain" {
                background "#d5e8d4"
                stroke "#82b366"
                color "#274e13"
            }

            element "Port" {
                background "#f7f7f7"
                stroke "#666666"
                color "#333333"
                border dashed
            }

            element "Driven Adapter" {
                background "#e1d5e7"
                stroke "#9673a6"
                color "#4c1130"
            }

            element "Composition Root" {
                background "#fff2cc"
                stroke "#d6b656"
                color "#7f6000"
            }

            # A module named by the brief with no ticket and no design behind it.
            element "Domain Capability" {
                background "#1f3864"
                stroke "#0f1f3d"
                color "#ffffff"
                width 520
                height 380
                fontSize 26
            }

            element "Placeholder" {
                background "#f5f5f5"
                stroke "#b3b3b3"
                color "#7f7f7f"
                border dashed
            }

            element "Group:ConnectSphere (internal)" {
                color "#7f7f7f"
            }

            element "Group:Client & participants (external)" {
                color "#1abc9c"
            }

            # -------------------------------------------------------------
            # MODULE GROUP COLOURS — one per module, applied to the boundary.
            # Modules with no ticket share a muted grey, so the map reads at a
            # glance as "built here, named but not designed there".
            # -------------------------------------------------------------

            element "Group:Shared Platform" {
                color "#7f7f7f"
            }

            element "Group:Identity & Access" {
                color "#9673a6"
            }

            # Event Requests is one module drawn as four groups, so all four share
            # its red; the boundary label says which workspace drives each.
            element "Group:Event Requests: shared" {
                color "#b85450"
            }

            element "Group:Event Requests: Organiser" {
                color "#b85450"
            }

            element "Group:Event Requests: Operations" {
                color "#b85450"
            }

            element "Group:Event Requests: Coordinator" {
                color "#b85450"
            }

            element "Group:Registration" {
                color "#82b366"
            }

            element "Group:Notifications" {
                color "#1abc9c"
            }

            element "Group:Venues: booking" {
                color "#d79b00"
            }

            element "Group:Venues: calendar" {
                color "#d79b00"
            }

            element "Group:Events" {
                color "#b85450"
            }

            element "Group:Safety checks" {
                color "#6c8ebf"
            }

            element "Group:Change requests" {
                color "#6c8ebf"
            }

            element "Group:Venues: catalogue" {
                color "#d79b00"
            }

            element "Group:Equipment" {
                color "#b3b3b3"
            }

            element "Group:Reporting [?]" {
                color "#b3b3b3"
            }

            relationship "Relationship" {
                thickness 2
                color "#666666"
                routing Orthogonal
            }

            # System -> actor notifications: dashed teal, so a handoff reads differently
            # from a user action on the journey diagrams.
            relationship "Notification" {
                color "#1abc9c"
                style dashed
            }

            # -------------------------------------------------------------
            # WEEK 7 — added since 05-before-week-7 (9e8eb610). Heavier border,
            # ring colours unchanged, so the new parts read as "added to this".
            # -------------------------------------------------------------

            element "Week7" {
                strokeWidth 5
            }

            relationship "Week7" {
                thickness 3
            }
        }
    }
}
