workspace extends ../01-main/workspace.dsl {

    name "ConnectSphere — Sprint 2 Build Slice"
    description "Cycle lens. What Sprint 2 (20 Sep - 4 Oct) is adding, all of it still in open pull requests, and the Sprint 2 modules not yet started."

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: Linear team "SPM - IS212", cycle "Sprint 2" (2026-09-20 → 2026-10-04),
    # read 2026-09-27 mid-sprint, plus the open PRs on GitHub the same day.
    #   In open PRs (drawn, faded — tag "Unmerged" in 01-main)
    #     Events         SPM-50 confirm an event                      PR #55
    #                    SPM-33 request clarification                 PR #57
    #                    SPM-101 record a request's withdrawal        PRs #59-#62
    #     Notifications  SPM-57 notify a Coordinator of assignment    PRs #63-#71
    #   Planned, not started (placeholders only)
    #     Venues         SPM-42 catalogue, SPM-43 calendar, SPM-44 search,
    #                    SPM-45 suitability, SPM-46 booking request, SPM-104 layout
    #     Equipment      SPM-40 catalogue, SPM-41 requirements
    #     Notifications  SPM-58, SPM-59, SPM-60 notify the Organiser
    #   Not drawn: SPM-49 update planning info, SPM-76 check-in, SPM-15 navigation,
    #   SPM-16 access-denied response — no code yet and no placeholder to hang them on.
    #
    # NOTHING DRAWN FADED HERE IS ON MAIN. It was read in the PR diffs, so it is not
    # [?], but it can still change in review. 01-main's L3 relationships comment lists
    # the merge risks found. When a PR merges, update 01-main; this lens follows.
    #
    # Modelling decisions
    #  - Views only, like every lens. The Sprint 2 components live in 01-main.
    #  - The merged components each PR attaches to are drawn at full strength, so the
    #    faded parts read as "added to this", not floating.
    #  - Wiring edges (composition root, in-memory adapters) are excluded; 01-main
    #    records them, and they add a dozen arrows that all say the same thing.
    # =========================================================================

    views {

        component epvbs.web "sprint2-components" "What Sprint 2 adds, faded until merged, on the parts of main it touches." {
            include "element.tag==Unmerged"
            include novu

            # Merged components the PRs extend.
            include epvbs.web.coord_requests_ui epvbs.web.my_requests_ui
            include epvbs.web.assign_coordinator_uc epvbs.web.view_assigned_request_uc epvbs.web.view_organiser_request_uc
            include epvbs.web.event_request_e
            include epvbs.web.event_request_repository_port epvbs.web.coordinator_event_repository_port
            include epvbs.web.client_org_repository_port epvbs.web.user_account_repository_port
            include epvbs.web.notifier_port
            include epvbs.db

            # Sprint 2 scope with no code behind it yet.
            include epvbs.web.venues_placeholder epvbs.web.equipment_placeholder epvbs.web.notifications_placeholder

            exclude "epvbs.web.composition_root -> *"
            exclude "epvbs.web.in_memory_ad -> *"
            autoLayout lr
            default
        }
    }
}
