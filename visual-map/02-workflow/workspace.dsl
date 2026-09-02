workspace extends ../01-main/workspace.dsl {

    name "ConnectSphere — Event Request Workflow"
    description "Journey lens. The 14-step path an event takes from an Organiser's draft to a closed event, as a sequence of interactions across the system boundary."

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: ../../spm-brain/wiki/concepts/event-request-workflow.md
    #   which draws on  raw/Customer Brief no. 1.md  s5 (the 14-step table)
    #   and             IS212 2026 Discussions Aug 31  ("#N" = discussion answer no.)
    #
    # NOTHING HERE IS VERIFIED AGAINST CODE — the system is not built. This is the
    # *intended* process from the requirements, not observed behaviour.
    #
    # Modelling decisions
    #  - Model elements all come from 01-main; this workspace adds views only.
    #  - Step numbers are carried in the sequence order, not just the label: a whole
    #    number is a brief step (1-14), a decimal is an interaction within that step.
    #    So "7.2" reads as "the second interaction of Step 7 — Venue Request".
    #  - Dashed teal arrows are system -> actor notifications (tag "Notification" in
    #    01-main). They are how a handoff actually happens, so they are drawn here
    #    even though the L1 context view excludes them.
    #  - The brief calls these 14 steps a *typical* flow, not a specification (#11).
    #    Branching and exception paths — resubmission after rejection (#67), venue
    #    re-request after a rejection, cancellation, waiting-list promotion — are
    #    deliberately NOT drawn: a dynamic view shows one path, and the customer has
    #    not settled the others.
    #  - No Operations Manager notification edge: nothing in the brief notifies that
    #    role, and reassignment (#94) is agreed outside the system.
    #  - Email (the external system) is left out of every view. Notification channel
    #    is configurable per notification type (#37); which steps go out over email
    #    is undecided, so drawing an email edge on any given step would be invention.
    # =========================================================================

    views {

        # ---------------------------------------------------------------------
        # OVERVIEW — one interaction per brief step, the actor who owns that step
        # ---------------------------------------------------------------------

        dynamic * "journey" "The 14-step typical process, one interaction per step." {

             1: organiser   -> epvbs "Step 1 — Draft: saves an event request with initial requirements."
             2: organiser   -> epvbs "Step 2 — Submission: submits the request. Mandatory fields and lead time undecided [?]."
             3: ops_manager -> epvbs "Step 3 — Assignment: assigns an Event Coordinator. Manual, no acceptance step."
             4: coordinator -> epvbs "Step 4 — Review: requests clarification where information is incomplete or unclear."
             5: coordinator -> epvbs "Step 5 — Initial approval: decides whether planning may proceed. Decision recorded either way."
             6: coordinator -> epvbs "Step 6 — Venue identification: searches venues by date, capacity, layout, accessibility."
             7: venue_staff -> epvbs "Step 7 — Venue request: approves, rejects, or suggests an alternative."
             8: tech_staff  -> epvbs "Step 8 — Technical requirements: confirms and reserves what can be provided."
             9: coordinator -> epvbs "Step 9 — Preparation: tracks outstanding actions while staff update progress."
            10: coordinator -> epvbs "Step 10 — Confirmation: confirms once essential arrangements are complete."
            11: attendee    -> epvbs "Step 11 — Registration: registers within the permitted period, subject to capacity."
            12: organiser   -> epvbs "Step 12 — Changes: requests a change; the Coordinator assesses the impact."
            13: venue_staff -> epvbs "Step 13 — Delivery: prepares the room; Technical Support prepares the equipment."
            14: coordinator -> epvbs "Step 14 — Completion: records attendance, notes and issues, then closes the event."

            autoLayout lr
            default
        }

        # ---------------------------------------------------------------------
        # PHASE 1 — INTAKE (steps 1-5): draft to a decision on whether to plan
        # ---------------------------------------------------------------------

        dynamic * "intake" "Steps 1-5. Draft, submission, coordinator assignment, clarification, initial approval." {

              1: organiser   -> epvbs "Step 1 — Draft: saves an event request. Name, type, dates, attendance, requirements."
              2: organiser   -> epvbs "Step 2 — Submission: submits the request. Mandatory fields and lead time undecided [?]."

              3: ops_manager -> epvbs "Step 3 — Assignment: assigns an Event Coordinator. Manual, follows an SOP kept outside the system."
            3.1: epvbs       -> coordinator "Notifies the assignee. No acceptance step and no decline path."

              4: coordinator -> epvbs "Step 4 — Review: requests clarification where information is incomplete or unclear."
            4.1: epvbs       -> organiser "Notifies of the clarification request."
            4.2: organiser   -> epvbs "Answers. The exchange is retained on the event record."
            4.3: tech_staff  -> epvbs "Records a technical question. The Coordinator stays the liaison and owns the reply."

              5: coordinator -> epvbs "Step 5 — Initial approval: decides whether planning may proceed. Commits nothing."
            5.1: epvbs       -> organiser "Notifies of the decision. Approved, returned or rejected, all recorded."

            autoLayout lr
        }

        # ---------------------------------------------------------------------
        # PHASE 2 — ARRANGEMENT (steps 6-10): approved to confirmed
        # ---------------------------------------------------------------------

        dynamic * "arrangement" "Steps 6-10. Venue booking, equipment reservation, preparation tracking, confirmation." {

              6: coordinator -> epvbs "Step 6 — Venue identification: searches by date, capacity, layout, accessibility, facilities."

              7: coordinator -> epvbs "Step 7 — Venue request: submits a booking. Venues book in AM / PM / Night slots."
            7.1: epvbs       -> venue_staff "Notifies of the booking request."
            7.2: venue_staff -> epvbs "Approves, rejects, or suggests an alternative venue."
            7.3: epvbs       -> coordinator "Notifies of the booking decision."

              8: epvbs       -> tech_staff "Step 8 — Technical requirements: notifies of the requested equipment and support."
            8.1: tech_staff  -> epvbs "Confirms what can be provided and reserves it. Per session where sessions differ."
            8.2: epvbs       -> coordinator "Notifies of the equipment outcome."

              9: coordinator -> epvbs "Step 9 — Preparation: tracks outstanding actions, aggregated across every session."
            9.1: venue_staff -> epvbs "Updates venue preparation progress."
            9.2: tech_staff  -> epvbs "Updates equipment preparation progress."

             10: coordinator -> epvbs "Step 10 — Confirmation: confirms once essential arrangements are complete."
           10.1: epvbs       -> organiser "Notifies of confirmation. Confirmed arrangements become viewable."

            autoLayout lr
        }

        # ---------------------------------------------------------------------
        # PHASE 3 — DELIVERY & CLOSURE (steps 11-14): confirmed to closed
        # ---------------------------------------------------------------------

        dynamic * "delivery" "Steps 11-14. Attendee registration, changes before the event, delivery, completion." {

             11: epvbs       -> attendee "Step 11 — Registration: notifies that registration has opened."
           11.1: attendee    -> epvbs "Registers within the permitted period, subject to capacity."

             12: organiser   -> epvbs "Step 12 — Changes: requests a change before the event."
           12.1: epvbs       -> coordinator "Notifies of the change request."
           12.2: coordinator -> epvbs "Assesses impact on venue, equipment and registrations. Edit vs impacting change [?]."
           12.3: epvbs       -> attendee "Notifies registered attendees of a confirmed change."

             13: venue_staff -> epvbs "Step 13 — Delivery: prepares the room and records readiness."
           13.1: tech_staff  -> epvbs "Sets up equipment and records readiness."

             14: coordinator -> epvbs "Step 14 — Completion: records attendance, operational notes and issues, then closes."

            autoLayout lr
        }
    }
}
