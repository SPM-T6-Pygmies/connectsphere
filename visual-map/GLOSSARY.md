# Domain Glossary

Vocabulary for the maps in this repo — the **Event Planning and Venue Booking System** for
ConnectSphere Event Services.

**Source:** `spm-brain/raw/Customer Brief no. 1.md` (IS212 AY2026/27 T1 customer briefing).
Terms are taken from the brief's own wording so the maps trace back to the customer's language.

**Status:** initial pass. `01-main/workspace.dsl` is not yet authored, so this glossary currently runs
*ahead* of the model rather than describing it. Two consequences:

- The brief is **deliberately ambiguous** by design — business rules are to be settled in the
  customer Q&A sessions. Terms whose existence, rules, or shape the brief leaves open carry `[?]`
  (see [`CONVENTIONS.md`](CONVENTIONS.md) → marker discipline). Removing a `[?]` claims you confirmed
  the rule with the customer.
- Q&A clarifications (the `IS212 2026 Discussions` transcripts) are **not yet folded in**; the
  worked-through versions live in `spm-brain/wiki/concepts/`. Reconcile before removing markers.

Authoring rules live in [`CONVENTIONS.md`](CONVENTIONS.md); DSL syntax in [`SYNTAX.md`](SYNTAX.md).

---

## Organisations & systems

| Term | What it is |
| --- | --- |
| **ConnectSphere Event Services** | The customer. A regional event-planning and venue provider serving organisations across Southeast Asia; owns and operates several event facilities in Singapore and maintains event equipment. ~500 staff acting as Event Coordinators, Venue Staff, and Technical Support Staff. |
| **Event Planning and Venue Booking System** | The system under design. A single custom-built platform for event requests, venue booking, equipment and technical support, attendee registration, changes, notifications, and reporting. Used by both internal staff and external users. |
| **Incumbent tooling** | The current state being replaced: email, spreadsheets, shared calendars, messaging applications, online forms, and manually maintained documents. Information for one event is spread across several of these and owned by different employees. The brief names no integration with any of them `[?]`. |
| **Client organisation** | An external organisation ConnectSphere serves. Several Event Organisers may belong to one organisation, and an organisation may have several past and upcoming events. |

## Actors / roles

The five roles named in the brief (§3). Access to information and functionality depends on the role.

| Term | Internal / External | Role |
| --- | --- | --- |
| **Event Organiser** | External | Client representative with an event to host. Provides the initial requirements, submits the event request, communicates with ConnectSphere, and requests changes after submission or confirmation. |
| **Event Coordinator** | Internal | Assigned to a request and acts as the main ConnectSphere liaison. Reviews and approves requests, seeks clarification, identifies venues, raises venue and equipment requirements, tracks readiness, confirms the event. |
| **Venue Staff** | Internal | Own venue information, availability, and booking decisions; approve or reject venue booking requests, block venues, and physically prepare the venue. |
| **Technical Support Staff** | Internal | Own equipment records, availability, and reservations; review technical requirements and may be assigned to support an event on-site. |
| **Attendee** | External | Participant who registers for and attends an event. Must not see internal planning information. |

## Domain concepts — event & request

| Term | Meaning |
| --- | --- |
| **Event Request** | What an Event Organiser submits: event name, description, purpose, preferred dates and times, expected attendance, venue requirements, room-layout preferences, accessibility needs, equipment requirements, registration requirements, and other special arrangements. |
| **Draft Event Request** | An event request saved before submission, so incomplete information can be completed or reviewed later. |
| **Event** | The record the request becomes once planning proceeds; carries the arrangements (venue, equipment, technical support, programme, registration) through to completion. Whether request and event are one record or two is not settled by the brief `[?]`. |
| **Event Category** | Classification of an event — conference, workshop, training session, exhibition, meeting, seminar, networking event, or another type defined by ConnectSphere. |
| **Event Status** | The stage an event has reached, so users can see where it stands. See [Codes / enums](#codes--enums). |
| **Coordinator Assignment** | Attaching an Event Coordinator to an event as the responsible internal owner. Reassignment may be needed when staff responsibilities or availability change. |
| **Review and Clarification** | The Coordinator's pass over a submitted request: request amendment or clarification from the Organiser where information is incomplete or unclear (e.g. "a large room" with no expected attendance; "hybrid" with no video-conferencing detail). |
| **Initial Approval** | The Coordinator's decision that planning should proceed. Rejected or returned requests retain a record of the decision. |
| **Programme / Agenda** | The recorded schedule for an event — sessions, breaks, presentations, or other scheduled activities. Recorded by the Event Organiser or the Event Coordinator. |
| **Session** | One scheduled block within an event. A **multi-session event** has several sessions within a day or across days, potentially with different timings and operational requirements. |
| **Recurring / similar event** | Reuse of information from a previous event to reduce repeated data entry, while still allowing different dates and requirements `[?]` ("where useful" — shape unconfirmed). |
| **Comments and Discussion** | Planning conversation between the Event Organiser and relevant internal users, retained with the event record. |
| **Supporting Documents** | Files attached to an event — programmes, floor plans, presentation requirements, or other supporting material. |
| **Event Confirmation** | The Coordinator's act of confirming the event once the essential arrangements are complete. Confirmed arrangements become visible to the appropriate users. Which arrangements are "essential" is not defined by the brief `[?]`. |
| **Completion** | Marking an event as having taken place; attendance information, operational notes, or issues may then be recorded and the event closed. |

## Domain concepts — venue

| Term | Meaning |
| --- | --- |
| **Venue** | A room or space owned and operated by ConnectSphere. |
| **Venue Catalogue** | The record of each venue's location, capacity, facilities, accessibility, supported room layouts, operating hours, and other characteristics. |
| **Venue Availability Calendar** | The view of when a venue is available, tentatively held, confirmed, blocked, or otherwise unavailable. |
| **Venue Suitability** | Whether a venue fits an event. Depends on date and time, maximum capacity, supported layouts, accessibility, available facilities, existing bookings, operating hours, setup requirements, and turnaround time. A venue is not normally suitable when expected attendance exceeds its capacity. |
| **Venue Booking Request** | The Coordinator's request for a venue, carrying the event timing and venue requirements for Venue Staff to review. |
| **Venue Booking Approval** | Venue Staff's approve/reject decision on a booking request, optionally with a reason or a suggested alternative arrangement. |
| **Tentative Hold** | A temporary hold on a venue while an event is still being finalised. Governed by different rules from a confirmed booking `[?]` (permitted "where ConnectSphere's business process allows"; rules and expiry unconfirmed). |
| **Booking Conflict** | Incompatible or overlapping venue bookings. The system should detect these and help prevent **double-booking** — the same venue or equipment being treated as available for more than one event. |
| **Setup and Turnaround Time** | Preparation time before an event and reset time after it. Venue availability must account for these, not only the published start and end times — insufficient turnaround between consecutive events is a named pain point. |
| **Venue Unavailability (block)** | Venue Staff marking a venue unusable for maintenance, renovation, safety restrictions, an internal activity, or another operational reason. |
| **Room Layout** | The arrangement a venue supports or an event requires — classroom, theatre, boardroom, banquet, exhibition, or another. Venue Staff record which layouts each venue supports. |
| **Capacity** | A venue's maximum attendance, weighed against the event's **expected attendance** throughout planning. A significant attendance change may require an existing venue booking's suitability to be reviewed. |

## Domain concepts — equipment & technical support

| Term | Meaning |
| --- | --- |
| **Equipment Catalogue** | The record of event equipment — type, description, quantity, location, and operational status. |
| **Equipment Request** | The equipment a Coordinator records as required for an event, with quantities and relevant technical requirements. |
| **Equipment Availability Check** | Technical Support Staff determining whether sufficient suitable equipment exists for the required date and time. Equipment may be unavailable because it is reserved for another event, located at another venue, damaged, or under maintenance. |
| **Equipment Reservation** | Committing available equipment to an event so the same limited equipment is not simultaneously committed to incompatible events. |
| **Equipment Maintenance Status** | Damaged, under repair, or otherwise unavailable equipment, which must not be treated as available for event use. |
| **Technical Support Request** | A Coordinator's indication that an event needs technical support before or during the event, with a description of the support required. |
| **Technical Staff Assignment** | Allocating suitable Technical Support Staff to an event according to availability and event requirements. |

## Domain concepts — readiness & registration

| Term | Meaning |
| --- | --- |
| **Event Readiness** | Whether the important arrangements — venue, equipment, technical support, programme, registration setup — are ready. A named difficulty today is identifying which upcoming events still have incomplete arrangements. |
| **Outstanding Action** | A planning matter that is incomplete or needs action before an event can be confirmed or delivered. |
| **Attendee Registration** | An Attendee signing up for a confirmed event and providing the required registration information. Only for events where registration is enabled. |
| **Registration Capacity** | The limit on registrations for an event. Registrations beyond it must be prevented or otherwise handled. |
| **Registration Period** | When registration opens and closes. Attendees can only register while registration is available. |
| **Waiting List** | Additional Attendees queued once an event reaches capacity `[?]` ("where supported" — promotion rules unconfirmed). |
| **Registration Withdrawal** | An Attendee giving up their place where permitted; the released place may become available to another Attendee. |
| **Attendance Recording** | Recording whether registered Attendees actually attended, so registration and attendance stay distinguishable. |

## Domain concepts — change management

| Term | Meaning |
| --- | --- |
| **Event Change Request** | A permitted change the Event Organiser requests after submission or confirmation, for the Coordinator to review. |
| **Change Impact** | The knock-on effect of a change on arrangements already made — the brief's central problem. Raising attendance 80 → 150 may make the booked venue unsuitable; changing the date may create a venue or equipment conflict; extending an event may break the turnaround before another booking. Significant changes (date, time, attendance, venue requirements, equipment requirements) require existing arrangements to be reviewed again. |
| **Ordinary edit vs impacting change** | The distinction the system must draw between a routine information update and a change that affects already-confirmed arrangements `[?]` (boundary undefined in the brief). |
| **Rescheduling** | Moving an event, with venue, equipment, technical-support, and attendee arrangements reconsidered or updated. |
| **Postponement** | Deferring an event at the Organiser's request. Listed alongside rescheduling and cancellation as a notification trigger; whether it is a distinct status is unconfirmed `[?]`. |
| **Cancellation** | Cancelling an event. Related venue and equipment reservations must stop being committed to it, subject to the applicable business rules — cancelled events continuing to occupy reservations is a named pain point. |

## Cross-cutting concepts

| Term | Meaning |
| --- | --- |
| **Notification** | An in-application or other-channel message telling a user that something relevant changed — request submitted, coordinator assigned, clarification requested, request approved/rejected/returned, venue booking requested/approved/rejected/changed, equipment confirmed or unavailable, event confirmed, significant change requested, event rescheduled/postponed/cancelled, registration opening/closing/reaching capacity, waiting-list change, withdrawal affecting availability, upcoming event still incomplete, availability change affecting an upcoming event. Channel beyond in-app is unspecified `[?]`. |
| **Reminder** | A time-driven prompt about upcoming events, incomplete arrangements, registration deadlines, preparation activities, or other time-sensitive matters `[?]` ("may" — not committed in the brief). |
| **Event Calendar** | A calendar view of upcoming events, filtered by the viewer's role and access rights. |
| **Activity History** | The record of significant actions — who performed the action and when — supporting accountability and troubleshooting. |
| **Change History** | The record of how important event information changed over time, visible to users with appropriate access. Determining who changed what and when is a named pain point. |
| **Role-Based Dashboard** | A per-role overview of what needs attention — events requiring action, upcoming bookings, equipment requests, attendee registrations. |
| **Event Report** | A summary of an event's details, schedule, venue, operational requirements, and registration information. |
| **Venue Usage Report** | Venue bookings and usage over a selected period, for internal operational planning. |
| **Registration Report** | Attendee information viewable or exportable by Event Organisers and Event Coordinators, subject to access restrictions. |
| **Export** | Producing reports or event information in common formats for meetings, operational use, or record-keeping. Formats unspecified `[?]`. |

## Typical planning process (brief §5)

The expected happy path. Exact business rules per step are to be clarified in the customer Q&A, so
treat the sequence as indicative `[?]`. Journey workspaces (`NN-<journey>/`) should name their lens
against these steps.

| Step | Name | What happens |
| --- | --- | --- |
| 1 | Draft Event Request | Organiser drafts the initial requirements, editable before submission. |
| 2 | Submission | Organiser submits the request to ConnectSphere. |
| 3 | Coordinator Assignment | A Coordinator becomes responsible for the event. |
| 4 | Review and Clarification | Coordinator reviews; requests clarification or amendment. |
| 5 | Initial Approval | Coordinator decides whether planning proceeds; decisions are recorded. |
| 6 | Venue Identification | Coordinator searches venues against date, time, capacity, layout, accessibility, facilities, setup. |
| 7 | Venue Request | Venue Staff approve, reject, or suggest an alternative. |
| 8 | Technical Requirements | Technical Support Staff review equipment/support and reserve what is available. |
| 9 | Event Preparation | Coordinator monitors outstanding arrangements; Venue and Technical staff update progress. |
| 10 | Event Confirmation | Coordinator confirms; the Organiser can view confirmed arrangements. |
| 11 | Attendee Registration | Attendees register within the permitted period and capacity. |
| 12 | Changes Before the Event | Coordinator assesses whether requested changes affect existing arrangements. |
| 13 | Event Delivery | Venue and equipment prepared; all users see the latest confirmed information. |
| 14 | Completion | Event marked completed; attendance, operational notes, and issues recorded; event closed. |

## Codes / enums

The brief gives these as examples rather than fixed sets — treat the whole section as `[?]` until the
customer confirms it.

| Code | Meaning |
| --- | --- |
| `draft` | Event status: saved but not yet submitted. |
| `submitted` | Event status: sent to ConnectSphere, not yet picked up. |
| `under review` | Event status: Coordinator is reviewing / seeking clarification. |
| `approved` | Event status: planning may proceed. |
| `planning` | Event status: arrangements being made. |
| `awaiting arrangements` | Event status: blocked on venue, equipment, or support decisions. |
| `confirmed` | Event status: essential arrangements complete and visible to the Organiser. |
| `completed` | Event status: the event has taken place and been closed. |
| `cancelled` | Event status: called off; reservations must be released. |
| `rejected` | Event status: the request was declined, with the decision recorded. |
| `available` / `tentatively held` / `confirmed` / `blocked` / `unavailable` | Venue availability states on the calendar. |
| `conference` / `workshop` / `training session` / `exhibition` / `meeting` / `seminar` / `networking event` | Event categories, plus any other type ConnectSphere defines. |
| `classroom` / `theatre` / `boardroom` / `banquet` / `exhibition` | Room layouts, plus any other arrangement. |
| Equipment unavailability reasons | Reserved for another event, located at another venue, damaged, or under maintenance. Not stated as a formal enum `[?]`. |
| Registration states | Registered, waitlisted, withdrawn, attended — implied by the registration features, never enumerated `[?]`. |

## Non-functional vocabulary (brief §8)

| Term | What the customer means by it |
| --- | --- |
| **Performance** | Common operations — viewing an event, searching venues, opening a venue calendar, checking equipment availability, submitting a registration — complete in reasonable time. No figure given `[?]`. |
| **Security** | Access depends on role *and* relationship to an event: an Organiser cannot see unrelated clients' events; an Attendee cannot see internal planning information. |
| **Usability** | All user groups complete their common activities without extensive training. The UI must not assume knowledge of ConnectSphere's internal processes. |
| **Reliability and consistency** | No contradictory information about event dates, venue bookings, equipment availability, or registration status when related arrangements change. |
| **Scalability** | Supports three years of growth in events, users, client organisations, venues, equipment, and registrations. |
| **Auditability** | Important actions recorded: what changed, who changed it, when. |
| **Maintainability** | Processes will evolve; new functionality and business rules can be added without rebuilding the system. |
| **Responsive design** | Desktop- and mobile-friendly: external users on personal devices, internal staff while preparing venues and equipment. |

## Naming legend (artifact identifiers in the DSL)

**Provisional** — `01-main/workspace.dsl` has not been authored yet, so nothing below is in use.
Record the real legend here once the model exists (see [`CONVENTIONS.md`](CONVENTIONS.md) → Naming).
The suffixes follow the implementation repo's Ports & Adapters layout (`src/core/ports`,
`src/core/use-cases`, `src/core/domain`, `src/adapters`, `src/composition`).

| Prefix / pattern | Kind |
| --- | --- |
| `_port` suffix | Domain port interface (`src/core/ports`). |
| `_uc` suffix | Use-case component (`src/core/use-cases`). |
| `_e` suffix | Domain entity group component (`src/core/domain`). |
| `_t` suffix | Database table component. |
