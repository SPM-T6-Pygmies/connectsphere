workspace "ConnectSphere — Event Planning and Venue Booking System" "Reference model. L1 who uses the system, L2 what it is made of, L3 the Ports & Adapters structure inside the web application." {

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
    # VERIFIED AGAINST CODE on main @ f9c71d5 (2026-09-27). Every L2/L3 element traces
    # to a file: use cases and adapters to src/composition/container.ts, ports to
    # src/core/ports/outbound, rules to src/core/domain, RPCs to supabase/migrations.
    # [?] now marks what is unsettled in the requirements, or not built at all.
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
    #  - The email external system keeps its L1 edge and gains no container edge: no adapter
    #    sends email yet. The Notifier port's only implementation logs (see Notifications).
    #    An email edge at L2 today would claim a delivery path that does not exist.
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
            ops_manager = person "Event Operations Manager" "Assigns and reassigns Event Coordinators. Follows an SOP kept outside the system."
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

                    event_request_repository_port = component "EventRequestRepository" "Port. Lists, finds and saves requests; records assignment, reassignment and decisions." "src/core/ports/outbound" "Port"

                    user_account_repository_port = component "UserAccountRepository" "Port. Names accounts; lists an organisation's Organisers and every Coordinator." "src/core/ports/outbound" "Port"

                    client_org_repository_port = component "ClientOrganisationRepository" "Port. Names client organisations." "src/core/ports/outbound" "Port"

                    supabase_event_requests_ad = component "SupabaseEventRequestRepository" "Adapter. Event request RPCs; snake_case columns and ISO dates stop here." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_user_accounts_ad = component "SupabaseUserAccountRepository" "Adapter. Account name, Organiser and Coordinator RPCs." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_client_orgs_ad = component "SupabaseClientOrganisationRepository" "Adapter. The organisation-name RPC." "src/adapters/outbound/supabase" "Driven Adapter"
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
                }

                # SPM-29 view requests, SPM-130 assign a Coordinator.
                group "Event Requests: Operations" {

                    ops_console_ui = component "Assignment console + assign action" "Driving adapter. One request and the Coordinator picker." "src/app/staff/ops" "Driving Adapter"

                    view_all_requests_uc = component "ViewAllEventRequestsUseCase" "Lists every request except Drafts, as unassigned or assigned." "src/core/use-cases" "Use Case"

                    view_ops_request_uc = component "ViewOperationsEventRequestUseCase" "Reads one request and whether a Coordinator can be assigned." "src/core/use-cases" "Use Case"

                    view_all_coordinators_uc = component "ViewAllEventCoordinatorsUseCase" "Lists every Coordinator. Thin read." "src/core/use-cases" "Use Case"

                    assign_coordinator_uc = component "AssignEventCoordinatorUseCase" "Attaches or replaces the Coordinator. Immediate, no acceptance step." "src/core/use-cases" "Use Case"
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

                    coordinator_event_repository_port = component "CoordinatorEventRepository" "Port. Lists the events a Coordinator is assigned to." "src/core/ports/outbound" "Port"

                    supabase_coord_events_ad = component "SupabaseCoordinatorEventRepository" "Adapter. The Coordinator's events RPC." "src/adapters/outbound/supabase" "Driven Adapter"
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

                    event_e = component "event" "Domain. Open for registration, full, and whether withdrawal is still allowed." "src/core/domain" "Domain"

                    registration_e = component "registration" "Domain. One live registration per email; withdrawn is final. No waiting list." "src/core/domain" "Domain"

                    attendee_e = component "attendee" "Domain. A non-blank name and a normalised email." "src/core/domain" "Domain"

                    event_catalogue_port = component "EventCatalogue" "Port. Lists Confirmed events and finds one." "src/core/ports/outbound" "Port"

                    registration_repository_port = component "RegistrationRepository" "Port. Counts places, finds and saves registrations, records withdrawals." "src/core/ports/outbound" "Port"

                    supabase_event_catalogue_ad = component "SupabaseEventCatalogue" "Adapter. Event rows readable by anonymous visitors." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_registrations_ad = component "SupabaseRegistrationRepository" "Adapter. Registration RPCs and the places-taken count." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # NOTIFICATIONS   — Linear project "Notifications"
                # On main the Notifier port's only method (connectionRequested) serves
                # the Connections worked example, which this map does not draw. No
                # event-domain use case notifies anyone yet, and every staff inbox
                # renders wireframe fixtures (src/lib/wireframe/notifications.ts).
                # =============================================================

                group "Notifications [?]" {

                    notifier_port = component "Notifier" "Port. Announces what a role needs to know. No event-domain method yet." "src/core/ports/outbound" "Port"

                    logging_notifier_ad = component "LoggingNotifier" "Adapter. Writes to the log. No delivery channel is built." "src/adapters/outbound/logging" "Driven Adapter"

                    notifications_placeholder = component "Notification inbox [?]" "Not built. Every staff role's inbox is a wireframe with fixture data." {
                        tags "Placeholder"
                    }
                }

                # =============================================================
                # MODULES WITH NO CORE YET — named, not designed.
                # Their tables exist in the initial schema and the venue and technical
                # staff pages render wireframe fixtures (src/lib/wireframe), but no use
                # case, port or adapter reads them. Replace a placeholder with real
                # components when its tickets are built.
                # =============================================================

                group "Venues [?]" {
                    venues_placeholder = component "Venue booking module [?]" "Wireframe pages only. Brief steps 6-7: search, request, approve, reject, block." {
                        tags "Placeholder"
                    }
                }

                group "Equipment [?]" {
                    equipment_placeholder = component "Equipment module [?]" "Wireframe pages only. Brief step 8: availability, reservation, technical support." {
                        tags "Placeholder"
                    }
                }

                group "Reporting [?]" {
                    reporting_placeholder = component "Reporting module [?]" "Not designed. Brief step 14 plus event, venue-usage and registration reports. No ticket yet." {
                        tags "Placeholder"
                    }
                }
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

        # [?] Existence is confirmed — notifications go out over in-app AND email,
        # configurable per notification type (#37) — but no provider is chosen, and #79
        # frames email as a notification-channel requirement, not a general integration.
        email = softwareSystem "Email Delivery Service [?]" "Carries outbound email notifications. Provider not chosen." "External"

        # ---------------------------------------------------------------------
        # L1 RELATIONSHIPS
        # ---------------------------------------------------------------------

        organiser   -> epvbs "Submits event and change requests; views confirmed arrangements."
        attendee    -> epvbs "Registers for confirmed events and withdraws."
        coordinator -> epvbs "Reviews and approves requests, requests venue + equipment, confirms and cancels events."
        venue_staff -> epvbs "Approves or rejects venue bookings, maintains the catalogue, blocks venues."
        tech_staff  -> epvbs "Checks and reserves equipment, records defects, supports events."
        ops_manager -> epvbs "Assigns and reassigns Event Coordinators."

        # In-app notifications back to the actors. These carry the workflow handoffs, so
        # they are modelled — but excluded from the "context" view below to keep L1 legible.
        # No edge to the Operations Manager: nothing in the brief notifies that role.
        epvbs -> organiser   "Notifies of clarification requests, decisions, confirmation and changes. Event-driven." "In-app" "Notification"
        epvbs -> coordinator "Notifies of assignment, venue and equipment decisions, and readiness gaps. Event-driven." "In-app" "Notification"
        epvbs -> venue_staff "Notifies of booking requests and changes affecting a venue. Event-driven." "In-app" "Notification"
        epvbs -> tech_staff  "Notifies of equipment requirements and changes affecting a reservation. Event-driven." "In-app" "Notification"
        epvbs -> attendee    "Notifies of registration opening, confirmation and event changes. Event-driven." "In-app" "Notification"

        # Only the email channel crosses the system boundary, so only email is drawn at L1.
        epvbs -> email "Sends notifications and reminders. Event-driven." "Email"

        # ---------------------------------------------------------------------
        # L2 RELATIONSHIPS — every role reaches the same web application
        # ---------------------------------------------------------------------

        organiser   -> epvbs.web "Drafts, submits and tracks their organisation's events." "HTTPS"
        attendee    -> epvbs.web "Registers for confirmed events and withdraws." "HTTPS"
        coordinator -> epvbs.web "Reviews requests, arranges venue and equipment, confirms." "HTTPS"
        venue_staff -> epvbs.web "Decides booking requests and maintains the venue catalogue." "HTTPS"
        tech_staff  -> epvbs.web "Checks and reserves equipment, records defects." "HTTPS"
        ops_manager -> epvbs.web "Assigns and reassigns Event Coordinators." "HTTPS"

        epvbs.web -> epvbs.db   "Reads and writes events, accounts and registrations." "PostgREST"
        epvbs.web -> epvbs.auth "Verifies credentials and refreshes sessions." "Supabase Auth"

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
    }

    views {

        systemContext epvbs "context" "Who uses the Event Planning and Venue Booking System, and what crosses its boundary." {
            include *
            # Notification return edges live in the model for the journey workspaces; at L1
            # they only add noise, so the context view keeps just the actor -> system edges.
            exclude "epvbs -> organiser" "epvbs -> coordinator" "epvbs -> venue_staff" "epvbs -> tech_staff" "epvbs -> attendee"
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

            element "Group:Notifications [?]" {
                color "#1abc9c"
            }

            element "Group:Venues [?]" {
                color "#b3b3b3"
            }

            element "Group:Equipment [?]" {
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
        }
    }
}
