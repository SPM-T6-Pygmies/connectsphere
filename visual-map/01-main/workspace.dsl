workspace "ConnectSphere — Event Planning and Venue Booking System" "Reference model. L1 system context: who uses the system and what crosses its boundary." {

    # =========================================================================
    # PROVENANCE  — read before editing
    # -------------------------------------------------------------------------
    # Source: ../../spm-brain
    #   Brief         spm-brain/raw/Customer Brief no. 1.md
    #   Clarified by  spm-brain/wiki/concepts/*.md   ("#N" = IS212 discussion answer no.)
    # Domain terms:   ../GLOSSARY.md
    #
    # NOTHING HERE IS VERIFIED AGAINST CODE. The system is not built yet, so this map
    # states *intended scope* from the requirements, not observed structure. Treat every
    # element as requirements-derived; [?] marks what is unsettled even in the requirements.
    #
    # L1 modelling decisions
    #  - No external system integrations are in scope (#79, #12). The incumbent tooling
    #    (email, spreadsheets, shared calendars, messaging apps, manual documents) is
    #    REPLACED, not integrated — so it is deliberately not drawn as an external system.
    #  - Contracts and payments (#24), the coordinator-assignment SOP (#93) and the
    #    post-event equipment health checklist (#85) are handled outside the system:
    #    real-world processes, no software system to draw.
    #  - Authentication is required but the method is undecided (#62). No identity
    #    provider is modelled — drawing one would invent an integration.
    #  - In-app notification return edges are in the model but excluded from the "context"
    #    view: five extra edges would not survive at L1. They are modelled because they are
    #    the handoffs the journey workspaces sequence (see 02-workflow).
    #  - No containers yet: the internal structure has not been designed, and guessing it
    #    would be invention. L2/L3 land here once the architecture is decided.
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
        # SYSTEM UNDER FOCUS
        # ---------------------------------------------------------------------

        epvbs = softwareSystem "Event Planning and Venue Booking System" "Single platform for event requests, venue booking, equipment, registration, changes and reporting."

        # ---------------------------------------------------------------------
        # EXTERNALS
        # ---------------------------------------------------------------------

        # [?] Existence is confirmed — notifications go out over in-app AND email,
        # configurable per notification type (#37) — but no provider is chosen, and #79
        # frames email as a notification-channel requirement, not a general integration.
        email = softwareSystem "Email Delivery Service [?]" "Carries outbound email notifications. Provider not chosen." "External"

        # ---------------------------------------------------------------------
        # RELATIONSHIPS
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

            element "Group:ConnectSphere (internal)" {
                color "#7f7f7f"
            }

            element "Group:Client & participants (external)" {
                color "#1abc9c"
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
