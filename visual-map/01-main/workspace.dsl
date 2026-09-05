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
    # NOTHING HERE IS VERIFIED AGAINST CODE. src/ currently holds only the worked
    # "connections" example from docs/ARCHITECTURE.md, not the event domain — so every
    # element below states *intended* structure derived from requirements plus the
    # architecture decision, not observed structure. [?] marks what is unsettled even
    # in the requirements.
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
    #  - Authentication is required but the method is undecided (#62), so "Authentication
    #    Service" carries [?]. It is drawn because Supabase Auth is the standing assumption
    #    behind the login tickets, not because the customer chose it.
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
    #  - Modules with components are the ones Linear's Sprint 1 (6-20 Sep) has tickets for:
    #    Identity & Access, Events, Registration. Venues, Equipment and Reporting are real
    #    modules from the brief but have no ticket, so each is a single [?] placeholder —
    #    naming the brief step it will come from without inventing its use cases.
    #  - Composition-root and in-memory-adapter edges are modelled but excluded from the
    #    "components" view: fourteen extra arrows that all say "wiring". They are drawn
    #    in 03-sprint-1, where the module count is small enough to carry them.
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

            # [?] Absent from the brief's role table, feature list and 14-step process.
            # Established only by clarification (#73 assigns, #93 SOP outside the system,
            # #94 reassignment). The team must still decide whether this is a distinct
            # system role, a senior-coordinator permission, or an out-of-system actor.
            ops_manager = person "Event Operations Manager [?]" "Assigns and reassigns Event Coordinators. Follows an SOP kept outside the system."
        }

        group "Client & participants (external)" {

            organiser = person "Event Organiser" "Client representative. Submits the event request, supplies requirements, requests changes."

            attendee = person "Attendee" "Participant. Registers for a confirmed event, may join the waiting list, may withdraw."
        }

        # ---------------------------------------------------------------------
        # SYSTEM UNDER FOCUS — L2 containers, L3 components
        # ---------------------------------------------------------------------

        epvbs = softwareSystem "Event Planning and Venue Booking System" "Single platform for event requests, venue booking, equipment, registration, changes and reporting." {

            web = container "Web Application" "Serves every role's pages and actions, and hosts the application core. Ports & Adapters inside." "Next.js 16 App Router / React 19" {

                # =============================================================
                # SHARED PLATFORM — touched by every module
                # =============================================================

                group "Shared Platform" {

                    composition_root = component "Composition Root" "Wires every port to an adapter. The only module that imports both sides." "src/composition/container.ts" "Composition Root"

                    clock_port = component "Clock" "Port. Supplies the current time, so a use case can be tested without freezing globals." "src/core/ports/outbound" "Port"

                    system_clock_ad = component "SystemClock" "Adapter. The real clock." "src/adapters/outbound/system" "Driven Adapter"

                    # A real implementation of every port, not a mock — ARCHITECTURE.md s8.4.
                    # This is what lets the use-case tests run with no database and no server.
                    in_memory_ad = component "In-memory adapters" "Adapters. Map-backed stand-in for every port; the test suite plugs these in instead of Supabase." "src/adapters/outbound/in-memory" "Driven Adapter"
                }

                # =============================================================
                # IDENTITY & ACCESS   — Linear project "Users"
                # Sprint 1: SPM-13 log in, SPM-14 log out. AccessPolicy also carries
                # SPM-39's organisation-scoping rules, which Events reads.
                # =============================================================

                group "Identity & Access" {

                    login_ui = component "Login page + sign-in action" "Driving adapter. Parses credentials, delegates, routes to the role's landing page." "src/app" "Driving Adapter"

                    logout_ui = component "Sign-out action" "Driving adapter. Ends the session and returns to the login page." "src/app" "Driving Adapter"

                    log_in_uc = component "LogInUseCase" "Verifies credentials, opens a session, resolves the caller's role." "src/core/use-cases" "Use Case"

                    log_out_uc = component "LogOutUseCase" "Ends the session so a protected page cannot be reopened." "src/core/use-cases" "Use Case"

                    user_account_e = component "UserAccount" "Domain. Role and client-organisation binding for one account." "src/core/domain" "Domain"

                    access_policy_e = component "AccessPolicy" "Domain. Organisation-wide view, responsible-Organiser edit. The rule behind every scoped read." "src/core/domain" "Domain"

                    # [?] The port is certain — authentication is required. Its mechanism is
                    # not: email/password, SSO and MFA were all raised and none chosen (#62).
                    auth_gateway_port = component "AuthenticationGateway [?]" "Port. Verifies credentials, opens and clears sessions. Mechanism undecided [?]." "src/core/ports/outbound" "Port"

                    user_directory_port = component "UserDirectory" "Port. Looks up accounts and roles, and lists the Coordinators a manager may pick from." "src/core/ports/outbound" "Port"

                    supabase_auth_ad = component "SupabaseAuthGateway [?]" "Adapter. Supabase Auth, cookie sessions via @supabase/ssr." "src/adapters/outbound/supabase" "Driven Adapter"

                    supabase_users_ad = component "SupabaseUserDirectory" "Adapter. Account and role rows, translated to domain types." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # EVENTS   — Linear project "Events"
                # Sprint 1: SPM-38 draft, SPM-31 submit, SPM-29 assign, SPM-39 org view.
                # =============================================================

                group "Events" {

                    event_form_ui = component "Event request form" "Driving adapter. Save-draft and submit actions; turns field errors into messages." "src/app" "Driving Adapter"

                    event_list_ui = component "Event list + detail pages" "Driving adapter. The Organiser's organisation-scoped read." "src/app" "Driving Adapter"

                    assignment_ui = component "Assignment console" "Driving adapter. Pending requests and the Coordinator picker, for the Operations Manager." "src/app" "Driving Adapter"

                    save_draft_uc = component "SaveEventRequestDraftUseCase" "Stores an incomplete request as a Draft and returns it for later editing." "src/core/use-cases" "Use Case"

                    # [?] The mandatory field set for submission is explicitly undecided —
                    # "propose an appropriate set of information" (#72). Do not hard-code one.
                    submit_request_uc = component "SubmitEventRequestUseCase" "Submits a Draft once it is complete. Mandatory field set undecided [?]." "src/core/use-cases" "Use Case"

                    assign_coordinator_uc = component "AssignCoordinatorUseCase" "Attaches or replaces the responsible Coordinator. Takes effect immediately, no acceptance step." "src/core/use-cases" "Use Case"

                    list_events_uc = component "ListOrganisationEventsUseCase" "Lists the events of the caller's client organisation, with per-event edit rights." "src/core/use-cases" "Use Case"

                    event_request_e = component "EventRequest" "Domain. Draft to Submitted to Assigned, and what each transition requires." "src/core/domain" "Domain"

                    event_repository_port = component "EventRepository" "Port. Finds one event, lists an organisation's events, saves a request." "src/core/ports/outbound" "Port"

                    supabase_events_ad = component "SupabaseEventRepository" "Adapter. Event rows; snake_case columns and ISO dates stop here." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # REGISTRATION   — Linear project "Registration & Attendees"
                # Sprint 1: SPM-24 register, SPM-28 withdraw.
                # Waiting list is out of Release 1, so no promotion path is modelled.
                # =============================================================

                group "Registration" {

                    registration_ui = component "Event registration page" "Driving adapter. Register and withdraw actions on a confirmed event." "src/app" "Driving Adapter"

                    register_uc = component "RegisterForEventUseCase" "Registers an Attendee when the event is Confirmed, open, and not yet full." "src/core/use-cases" "Use Case"

                    withdraw_uc = component "WithdrawRegistrationUseCase" "Releases a place and frees it for the next registrant." "src/core/use-cases" "Use Case"

                    registration_e = component "Registration" "Domain. Capacity rule: refuse when full. No waiting list in Release 1." "src/core/domain" "Domain"

                    registration_repository_port = component "RegistrationRepository" "Port. Counts an event's registrations, saves one, withdraws one." "src/core/ports/outbound" "Port"

                    supabase_registrations_ad = component "SupabaseRegistrationRepository" "Adapter. Registration rows and the live-count query." "src/adapters/outbound/supabase" "Driven Adapter"
                }

                # =============================================================
                # NOTIFICATIONS   — Linear project "Notifications". No Sprint 1 ticket.
                # The port is requirements-derived: the brief and 02-workflow both depend
                # on handoff notifications. Only the delivery channel is missing.
                # =============================================================

                group "Notifications [?]" {

                    notifier_port = component "Notifier" "Port. Announces what a role needs to know. In-app and email, configurable per type [?]." "src/core/ports/outbound" "Port"

                    logging_notifier_ad = component "LoggingNotifier [?]" "Adapter. Placeholder: writes to the log. No delivery channel is built yet." "src/adapters/outbound/logging" "Driven Adapter"
                }

                # =============================================================
                # MODULES WITH NO TICKET YET — named, not designed.
                # Each is one placeholder carrying the brief step it will grow from.
                # Replace a placeholder with real components when its tickets are written.
                # =============================================================

                group "Venues [?]" {
                    venues_placeholder = component "Venue booking module [?]" "Not designed. Brief steps 6-7: search, request, approve, reject, block. No ticket yet." {
                        tags "Placeholder"
                    }
                }

                group "Equipment [?]" {
                    equipment_placeholder = component "Equipment module [?]" "Not designed. Brief step 8: availability check, reservation, technical support. No ticket yet." {
                        tags "Placeholder"
                    }
                }

                group "Reporting [?]" {
                    reporting_placeholder = component "Reporting module [?]" "Not designed. Brief step 14 plus event, venue-usage and registration reports. No ticket yet." {
                        tags "Placeholder"
                    }
                }
            }

            db = container "Application Database" "Events, accounts and registrations. Reached only through repository ports." "Supabase Postgres" "Database"

            # [?] Drawn because Supabase Auth is the standing assumption behind SPM-13/14,
            # not because the customer chose a method (#62). Account recovery and locked
            # accounts are unspecified too (#64).
            auth = container "Authentication Service [?]" "Verifies credentials and holds sessions. Mechanism undecided by the customer [?]." "Supabase Auth"
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
        attendee    -> epvbs "Registers for confirmed events, joins the waiting list, withdraws."
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
        epvbs.web -> epvbs.auth "Verifies credentials and refreshes sessions. [?]" "Supabase Auth"

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — driving adapters call use cases
        # ---------------------------------------------------------------------

        epvbs.web.login_ui        -> epvbs.web.log_in_uc             "Delegates the parsed credentials."
        epvbs.web.logout_ui       -> epvbs.web.log_out_uc            "Ends the session."
        epvbs.web.event_form_ui   -> epvbs.web.save_draft_uc         "Saves the draft."
        epvbs.web.event_form_ui   -> epvbs.web.submit_request_uc     "Submits the request."
        epvbs.web.event_list_ui   -> epvbs.web.list_events_uc        "Reads the organisation's events."
        epvbs.web.assignment_ui   -> epvbs.web.assign_coordinator_uc "Assigns or reassigns a Coordinator."
        epvbs.web.registration_ui -> epvbs.web.register_uc           "Registers the Attendee."
        epvbs.web.registration_ui -> epvbs.web.withdraw_uc           "Withdraws the registration."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — use cases ask the domain to decide
        # A use case orchestrates; every rule below lives in a domain component.
        # ---------------------------------------------------------------------

        epvbs.web.log_in_uc             -> epvbs.web.user_account_e  "Resolves the account's role and organisation."
        epvbs.web.list_events_uc        -> epvbs.web.access_policy_e "Asks what this caller may see and edit."
        epvbs.web.save_draft_uc         -> epvbs.web.event_request_e "Builds a Draft."
        epvbs.web.submit_request_uc     -> epvbs.web.event_request_e "Applies the submit transition."
        epvbs.web.assign_coordinator_uc -> epvbs.web.event_request_e "Applies the assignment."
        epvbs.web.register_uc           -> epvbs.web.event_request_e "Checks the event is Confirmed and open."
        epvbs.web.register_uc           -> epvbs.web.registration_e  "Builds a registration against the capacity rule."
        epvbs.web.withdraw_uc           -> epvbs.web.registration_e  "Applies the withdrawal and frees the place."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — use cases require ports
        # ---------------------------------------------------------------------

        epvbs.web.log_in_uc             -> epvbs.web.auth_gateway_port          "Verifies credentials and opens a session."
        epvbs.web.log_in_uc             -> epvbs.web.user_directory_port        "Loads the account behind the credentials."
        epvbs.web.log_out_uc            -> epvbs.web.auth_gateway_port          "Clears the session."
        epvbs.web.save_draft_uc         -> epvbs.web.event_repository_port      "Saves the draft."
        epvbs.web.submit_request_uc     -> epvbs.web.event_repository_port      "Saves the submitted request."
        epvbs.web.submit_request_uc     -> epvbs.web.clock_port                 "Stamps the submission time."
        epvbs.web.assign_coordinator_uc -> epvbs.web.user_directory_port        "Lists the Coordinators a manager may pick from."
        epvbs.web.assign_coordinator_uc -> epvbs.web.event_repository_port      "Records the assignment."
        epvbs.web.assign_coordinator_uc -> epvbs.web.notifier_port              "Announces the assignment to the assignee. [?]"
        epvbs.web.list_events_uc        -> epvbs.web.event_repository_port      "Lists the organisation's events."
        epvbs.web.register_uc           -> epvbs.web.event_repository_port      "Loads the event, its period and its capacity."
        epvbs.web.register_uc           -> epvbs.web.registration_repository_port "Counts registrations, then saves one."
        epvbs.web.register_uc           -> epvbs.web.clock_port                 "Checks the registration period is open."
        epvbs.web.register_uc           -> epvbs.web.notifier_port              "Confirms the registration to the Attendee."
        epvbs.web.withdraw_uc           -> epvbs.web.registration_repository_port "Withdraws the registration."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — adapters implement ports
        # The arrow points inward on purpose: compilation depends on the port even
        # though control, at runtime, flows outward through the adapter.
        # ---------------------------------------------------------------------

        epvbs.web.supabase_auth_ad          -> epvbs.web.auth_gateway_port           "Implements."
        epvbs.web.supabase_users_ad         -> epvbs.web.user_directory_port         "Implements."
        epvbs.web.supabase_events_ad        -> epvbs.web.event_repository_port       "Implements."
        epvbs.web.supabase_registrations_ad -> epvbs.web.registration_repository_port "Implements."
        epvbs.web.system_clock_ad           -> epvbs.web.clock_port                  "Implements."
        epvbs.web.logging_notifier_ad       -> epvbs.web.notifier_port               "Implements."

        # The in-memory adapters implement every port. Six near-identical arrows would
        # bury the module structure, so they are excluded from the "components" view and
        # drawn in 03-sprint-1 instead.
        epvbs.web.in_memory_ad -> epvbs.web.auth_gateway_port           "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.user_directory_port         "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.event_repository_port       "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.registration_repository_port "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.clock_port                  "Implements, for tests."
        epvbs.web.in_memory_ad -> epvbs.web.notifier_port               "Implements, for tests."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — the composition root hands each use case its adapters
        # Same treatment: modelled here, drawn in 03-sprint-1.
        # ---------------------------------------------------------------------

        epvbs.web.composition_root -> epvbs.web.log_in_uc             "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.log_out_uc            "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.save_draft_uc         "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.submit_request_uc     "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.assign_coordinator_uc "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.list_events_uc        "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.register_uc           "Constructs it with its adapters."
        epvbs.web.composition_root -> epvbs.web.withdraw_uc           "Constructs it with its adapters."

        # ---------------------------------------------------------------------
        # L3 RELATIONSHIPS — driven adapters reach infrastructure
        # ---------------------------------------------------------------------

        epvbs.web.supabase_events_ad        -> epvbs.db   "Reads and writes event rows." "PostgREST"
        epvbs.web.supabase_registrations_ad -> epvbs.db   "Reads and writes registration rows." "PostgREST"
        epvbs.web.supabase_users_ad         -> epvbs.db   "Reads account and role rows." "PostgREST"
        epvbs.web.supabase_auth_ad          -> epvbs.auth "Verifies credentials and refreshes sessions." "Supabase Auth"
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
            # 03-sprint-1, where three modules leave room for them.
            exclude "epvbs.web.composition_root -> *"
            exclude "epvbs.web.in_memory_ad -> *"
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

            element "Group:Events" {
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
