workspace extends ../01-main/workspace.dsl {

    name "ConnectSphere — Sprint 1 Build Slice"
    description "Cycle lens. The part of the reference model Sprint 1 (6-20 Sep) actually builds, and the order it can be built in."

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: Linear team "SPM - IS212", cycle "Sprint 1" (2026-09-06 → 2026-09-20).
    #   Users                     SPM-13 log in, SPM-14 log out
    #   Events                    SPM-38 draft, SPM-31 submit, SPM-29 assign,
    #                             SPM-39 view my organisation's events
    #   Registration & Attendees  SPM-24 register, SPM-28 withdraw
    #   (SPM-30 reassign is closed as a duplicate of SPM-29 and is not modelled.)
    # Target shape: ../../docs/ARCHITECTURE.md
    #
    # NOTHING HERE IS VERIFIED AGAINST CODE — none of these tickets is built. This is
    # the intended slice, not observed structure.
    #
    # Modelling decisions
    #  - Model elements all come from 01-main; this workspace adds views only. A module
    #    that gains tickets gains its components upstream, not here.
    #  - Venues, Equipment and Reporting are excluded: no Sprint 1 ticket touches them.
    #    Notifications stays, because SPM-24 promises the Attendee a confirmation and
    #    02-workflow step 3.1 notifies the assigned Coordinator.
    #  - Composition-root and in-memory wiring edges are DRAWN here and hidden in
    #    01-main. With three modules there is room for them, and they are the two
    #    things a first sprint gets wrong: constructing adapters inside a Server Action,
    #    and having nothing to test a use case against.
    # =========================================================================

    views {

        # ---------------------------------------------------------------------
        # THE SLICE — every component the eight tickets touch, wiring included
        # ---------------------------------------------------------------------

        component epvbs.web "sprint1-components" "What Sprint 1 builds: Identity & Access, Events, Registration, and the shared platform under them." {
            include *
            # Named by the brief, no ticket in this cycle. They stay in 01-main.
            exclude epvbs.web.venues_placeholder epvbs.web.equipment_placeholder epvbs.web.reporting_placeholder
            autoLayout lr
            default
        }

        # ---------------------------------------------------------------------
        # THE PART THAT NEEDS NO INFRASTRUCTURE
        # ARCHITECTURE.md s14 steps 1-5: domain, driving ports, driven ports, use
        # cases, in-memory adapters — designed and tested before Supabase exists.
        # Everything excluded below is steps 6-8, and can start later in the sprint.
        # ---------------------------------------------------------------------

        component epvbs.web "sprint1-core" "The hexagon interior: buildable and fully testable with no database, no auth service and no server." {
            include *

            # Driving adapters — the Next.js side, ARCHITECTURE.md step 8.
            exclude epvbs.web.login_ui epvbs.web.logout_ui
            exclude epvbs.web.event_form_ui epvbs.web.event_list_ui epvbs.web.assignment_ui
            exclude epvbs.web.registration_ui

            # Real driven adapters and the infrastructure behind them — steps 6-7.
            # The in-memory adapters stay: they are what makes this slice testable.
            exclude epvbs.web.supabase_auth_ad epvbs.web.supabase_users_ad
            exclude epvbs.web.supabase_events_ad epvbs.web.supabase_registrations_ad
            exclude epvbs.web.system_clock_ad epvbs.web.logging_notifier_ad
            exclude epvbs.db epvbs.auth

            # Modules with no Sprint 1 ticket.
            exclude epvbs.web.venues_placeholder epvbs.web.equipment_placeholder epvbs.web.reporting_placeholder

            autoLayout lr
        }
    }
}
