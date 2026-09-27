workspace extends ../01-main/workspace.dsl {

    name "ConnectSphere — Sprint 1 Build Slice"
    description "Cycle lens. What Sprint 1 (6-20 Sep) built, as it stands on main, and which part of it needs no infrastructure."

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: Linear team "SPM - IS212", cycle "Sprint 1" (2026-09-06 → 2026-09-20).
    # The cycle was planned with 8 stories; it closed with 12 Done, plus sub-issues:
    #   Users                     SPM-13 log in, SPM-14 log out (+ SPM-142 audit grant fix)
    #   Events                    SPM-38 draft, SPM-31 submit, SPM-39 organisation view
    #                             and reassign Organiser, SPM-29 view all requests,
    #                             SPM-130 assign a Coordinator, SPM-121 Coordinator queue,
    #                             SPM-32 view an assigned request, SPM-34 approve/reject
    #   Registration & Attendees  SPM-24 register, SPM-28 withdraw
    #   Not modelled: SPM-30 (duplicate of SPM-29), and SPM-95/96/97 (cancelled, folded
    #   into SPM-29 and SPM-130). SPM-137 "My events" was cancelled in Linear but its use
    #   case and page shipped anyway, so it is drawn.
    #
    # VERIFIED AGAINST CODE on main @ f9c71d5 (2026-09-27): every component shown is in
    # 01-main's verified model. Sprint 2 work in open PRs (tag "Unmerged") is excluded
    # here; it is the 04-sprint-2 lens.
    #
    # Modelling decisions
    #  - Model elements all come from 01-main; this workspace adds views only. A module
    #    that gains tickets gains its components upstream, not here.
    #  - Venues, Equipment, Reporting and the notification inbox are excluded: no Sprint 1
    #    ticket touches them. The Notifier port stays in view only because the in-memory
    #    adapters implement it.
    #  - Composition-root and in-memory wiring edges are DRAWN here and hidden in
    #    01-main. They are the two things a first sprint gets wrong: constructing
    #    adapters inside a Server Action, and having nothing to test a use case against.
    # =========================================================================

    views {

        # ---------------------------------------------------------------------
        # THE SLICE — every component the eight tickets touch, wiring included
        # ---------------------------------------------------------------------

        component epvbs.web "sprint1-components" "What Sprint 1 built: Identity & Access, Event Requests, Registration, and the shared platform under them." {
            include *
            # Named by the brief, no ticket in this cycle. They stay in 01-main.
            exclude epvbs.web.venues_placeholder epvbs.web.equipment_placeholder epvbs.web.reporting_placeholder epvbs.web.notifications_placeholder
            # Sprint 2 work in open PRs; see 04-sprint-2.
            exclude "element.tag==Unmerged"
            autoLayout lr
            default
        }

        # ---------------------------------------------------------------------
        # THE PART THAT NEEDS NO INFRASTRUCTURE
        # ARCHITECTURE.md s14 steps 1-4: domain, driven ports, use cases, in-memory
        # adapters — designed and tested before Supabase exists.
        # Everything excluded below is steps 5-7, and can start later in the sprint.
        # ---------------------------------------------------------------------

        component epvbs.web "sprint1-core" "The hexagon interior: buildable and fully testable with no database, no auth service and no server." {
            include *

            # Driving adapters — the Next.js side, ARCHITECTURE.md step 7.
            exclude epvbs.web.login_ui epvbs.web.logout_ui epvbs.web.session_mw_ui epvbs.web.staff_shell_ui
            exclude epvbs.web.request_form_ui epvbs.web.my_requests_ui epvbs.web.org_requests_ui
            exclude epvbs.web.ops_console_ui epvbs.web.coord_requests_ui epvbs.web.coord_events_ui
            exclude epvbs.web.events_browse_ui epvbs.web.registration_page_ui

            # Real driven adapters and the infrastructure behind them — steps 5-6.
            # The in-memory adapters stay: they are what makes this slice testable.
            exclude epvbs.web.supabase_auth_ad epvbs.web.supabase_user_ad epvbs.web.supabase_audit_ad
            exclude epvbs.web.supabase_event_requests_ad epvbs.web.supabase_user_accounts_ad
            exclude epvbs.web.supabase_client_orgs_ad epvbs.web.supabase_coord_events_ad
            exclude epvbs.web.supabase_event_catalogue_ad epvbs.web.supabase_registrations_ad
            exclude epvbs.web.system_clock_ad epvbs.web.logging_notifier_ad
            exclude epvbs.db epvbs.auth

            # Modules with no Sprint 1 ticket.
            exclude epvbs.web.venues_placeholder epvbs.web.equipment_placeholder epvbs.web.reporting_placeholder epvbs.web.notifications_placeholder

            # Sprint 2 work in open PRs; see 04-sprint-2.
            exclude "element.tag==Unmerged"
            autoLayout lr
        }
    }
}
