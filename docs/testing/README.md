# Manual test setup

One page to find, for every manual-test document, what it tests, who does what and where, and the commands that load its data. Each row of the table links the Linear ticket, the document with the cases, and a setup section below with commands you can copy.

## Read this first

- **Start every section from a fresh reset.** Each setup begins with `supabase db reset`, which **drops all local data**. Seeds from different sections overlap (same venues, days and accounts), so do not stack them: reset, then load only the section you are testing.
- **Do not run every script.** Some are not safe to re-run (the "Safe to re-run" column of the [scripts README](../../scripts/README.md)), and the cases assume a known starting state.
- **Where a section says "SQL in the doc"**, part of the setup is a SQL block inside the manual-test document. It is kept there, not copied here, so there is one copy to keep current. Open the linked document's Setup and run it after the commands.
- **Notifications** need Novu: run `pnpm novu:clear` after a reset and start the app with `NOVU_BRIDGE_URL` set (root [README](../../README.md) → Notifications).
- **Accounts:** every seeded account uses the password `TestPass123!` ([`supabase/SEED.md`](../../supabase/SEED.md)). Sign in at <http://localhost:3000/auth/login> after `pnpm dev:local`.
- **Seed versus fixture:** a *seed* loads a feature area's sample data; a *fixture* sets up the exact starting point of one case set. Some docs use both.

## Summary

| Ticket | What it tests | Page, who, stage | Manual cases | Setup |
| --- | --- | --- | --- | --- |
| **Event requests and the Coordinator** | | | | |
| [SPM-38](https://linear.app/pygmies/issue/SPM-38) Event Request Draft | A saved draft reopens with its preferred date and time window | The Organiser's event request form. **Who:** Event Organiser. **Stage:** Part-way through filling in a new request | [EVENT_REQUEST_DRAFT_MANUAL_TESTS.md](EVENT_REQUEST_DRAFT_MANUAL_TESTS.md) (TC-DRAFT-001) | [reset only](#spm-38-event-request-draft) |
| [SPM-31](https://linear.app/pygmies/issue/SPM-31) Submit an event request<br>[SPM-38](https://linear.app/pygmies/issue/SPM-38) Event Request Draft | The Organiser submits an event request on the slot-based form, or saves it as a draft first | **My event requests** → **New request**. **Who:** Event Organiser. **Stage:** Raising a new request | [EVENT_REQUEST_MANUAL_TESTS.md](EVENT_REQUEST_MANUAL_TESTS.md) (TC-EVREQ-001–007) | [reset only](#spm-31-spm-38-submit-and-draft-an-event-request) |
| [SPM-31](https://linear.app/pygmies/issue/SPM-31) Submit an event request | The Organiser submits a request, reads the acknowledgement and finds it again on My event requests | The request form and **My event requests**. **Who:** Event Organiser. **Stage:** Raising a new request | [EVENT_REQUEST_SUBMIT_MANUAL_TESTS.md](EVENT_REQUEST_SUBMIT_MANUAL_TESTS.md) (TC-SUBMIT-001–003) | [reset only](#spm-31-submit-an-event-request) |
| [SPM-327](https://linear.app/pygmies/issue/SPM-327) Request an event with a preferred start and end time | An Organiser requests an event with a preferred start and end time on the 15-minute grid | The request form and request detail. **Who:** Event Organiser, then Coordinator and Lead reading it. **Stage:** Raising or reading a request | [REQUEST_TIMES_MANUAL_TESTS.md](REQUEST_TIMES_MANUAL_TESTS.md) (TC-REQTIME-001–006) | [reset only](#spm-327-request-an-event-with-a-preferred-start-and-end-time) |
| [SPM-39](https://linear.app/pygmies/issue/SPM-39) View my organisation's events | An Organiser sees every request from their own organisation, with Edit only where allowed | `/staff/requester/organisation`. **Who:** Event Organiser. **Stage:** Several requests exist, some from colleagues | [ORGANISATION_EVENTS_MANUAL_TESTS.md](ORGANISATION_EVENTS_MANUAL_TESTS.md) (TC-ORGEV-001–004) | [reset + seeds](#spm-39-view-my-organisations-events) |
| [SPM-101](https://linear.app/pygmies/issue/SPM-101) Record the withdrawal of a submitted event request | The Coordinator records a withdrawal the Organiser asked for outside the system | The request's detail page `/staff/coordinator/<id>`. **Who:** Assigned Event Coordinator (Organiser and Lead set it up). **Stage:** A request is Under Review and the Organiser asks to withdraw | [EVENT_REQUEST_WITHDRAWAL_MANUAL_TESTS.md](EVENT_REQUEST_WITHDRAWAL_MANUAL_TESTS.md) (TC-WITHDRAW-001–003) | [reset only](#spm-101-record-the-withdrawal-of-a-submitted-event-request) |
| [SPM-29](https://linear.app/pygmies/issue/SPM-29) Viewing of all event requests<br>[SPM-130](https://linear.app/pygmies/issue/SPM-130) Assignment of Event Requests | The Event Coordinator Lead lists unassigned and assigned requests and assigns or reassigns a coordinator | `/staff/lead`, `/staff/lead/assigned`, `/staff/lead/<id>`. **Who:** Event Coordinator Lead. **Stage:** A request is Submitted and waiting for a coordinator, or already assigned | [ASSIGNMENT_MANUAL_TESTS.md](ASSIGNMENT_MANUAL_TESTS.md) (TC-ASSIGN-001–008) | [reset + seeds](#spm-29-spm-130-coordinator-assignment) |
| Event Coordinator Lead<br>[SPM-255](https://linear.app/pygmies/issue/SPM-255) [SPM-256](https://linear.app/pygmies/issue/SPM-256) [SPM-257](https://linear.app/pygmies/issue/SPM-257) | The Lead reviews unassigned requests, oversees each coordinator's workload and reassigns an active event | `/staff/lead` (Unassigned, Coordinators) and a request or event's detail. **Who:** Event Coordinator Lead. **Stage:** Requests are waiting, or an active event needs a new coordinator | [COORDINATOR_LEAD_MANUAL_TESTS.md](COORDINATOR_LEAD_MANUAL_TESTS.md) (TC-LEAD-001–006) | [reset + seeds](#spm-255-spm-256-spm-257-event-coordinator-lead) |
| [SPM-121](https://linear.app/pygmies/issue/SPM-121) View the event requests assigned to me<br>[SPM-32](https://linear.app/pygmies/issue/SPM-32) View an assigned event request | A coordinator sees only the requests assigned to them and opens one read-only | `/staff/coordinator` and `/staff/coordinator/<id>`. **Who:** Assigned Event Coordinator. **Stage:** A request is assigned and awaiting a decision | [COORDINATOR_QUEUE_MANUAL_TESTS.md](COORDINATOR_QUEUE_MANUAL_TESTS.md) (TC-COORDQ-001–005) | [reset + seeds](#spm-121-spm-32-coordinator-queue-and-request-detail) |
| [SPM-33](https://linear.app/pygmies/issue/SPM-33) Request clarification on an event request | The Coordinator asks the Organiser a question and returns the request; both reply in a thread and the Coordinator resolves each question | Coordinator: `/staff/coordinator/<id>`. Organiser: `/staff/requester/<id>`. **Who:** Event Coordinator and Event Organiser. **Stage:** A request is Under Review and the Coordinator needs more information | [CLARIFICATION_MANUAL_TESTS.md](CLARIFICATION_MANUAL_TESTS.md) (TC-CLARIFY-001–008) | [reset + seeds](#spm-33-request-clarification-on-an-event-request) |
| [SPM-34](https://linear.app/pygmies/issue/SPM-34) Approve or reject an event request | The Coordinator approves a request into a Planning event or rejects it with a reason | `/staff/coordinator/<id>`. **Who:** Assigned Event Coordinator. **Stage:** A request is Under Review | [REQUEST_DECISION_MANUAL_TESTS.md](REQUEST_DECISION_MANUAL_TESTS.md) (TC-DECIDE-001–004) | [reset + seeds](#spm-34-approve-or-reject-an-event-request) |
| Organiser notifications<br>[SPM-58](https://linear.app/pygmies/issue/SPM-58) [SPM-59](https://linear.app/pygmies/issue/SPM-59) [SPM-60](https://linear.app/pygmies/issue/SPM-60) [SPM-66](https://linear.app/pygmies/issue/SPM-66) | The Organiser is told when their request gets a coordinator, a clarification question or a decision, and when the event is confirmed | The Organiser's notification bell. **Who:** Event Organiser, Event Coordinator Lead, Event Coordinator. **Stage:** A request moves through assignment, clarification and decision | [ORGANISER_NOTIFICATIONS_MANUAL_TESTS.md](ORGANISER_NOTIFICATIONS_MANUAL_TESTS.md) (TC-ORGNOTIFY-001–008) | [reset only](#spm-58-spm-59-spm-60-1-organiser-notifications) |
| Staff notification inbox<br>[SPM-174](https://linear.app/pygmies/issue/SPM-174) [SPM-172](https://linear.app/pygmies/issue/SPM-172) [SPM-179](https://linear.app/pygmies/issue/SPM-179) [SPM-180](https://linear.app/pygmies/issue/SPM-180) [SPM-164](https://linear.app/pygmies/issue/SPM-164) | Staff get in-app notices: assignment, clarification posts, with read/archive and channel preferences | The notification bell and inbox in the staff header. **Who:** Event Coordinator, Event Coordinator Lead, Event Organiser. **Stage:** A request is assigned or the Organiser posts on it | [NOTIFICATIONS_MANUAL_TESTS.md](NOTIFICATIONS_MANUAL_TESTS.md) (TC-NOTIFY-001–013) | [reset + seeds](#spm-174-spm-172-spm-179-2-staff-notification-inbox) |
| **The event after approval** | | | | |
| [SPM-285](https://linear.app/pygmies/issue/SPM-285) Split the coordinator event page into tabs | The coordinator event page has Event, Venue, Equipment, Safety and Registration tabs; the open tab is kept in the address | `/staff/coordinator/events/<id>` and `?tab=`. **Who:** Assigned Event Coordinator. **Stage:** An event exists in Planning | [EVENT_PAGE_TABS_MANUAL_TESTS.md](EVENT_PAGE_TABS_MANUAL_TESTS.md) (TC-EVTABS-001–002) | [reset + seeds](#spm-285-split-the-coordinator-event-page-into-tabs) |
| [SPM-326](https://linear.app/pygmies/issue/SPM-326) Run events on start and end times | Event pages show real start and end times, in the viewer's timezone, not AM/PM/Night | Every event page (coordinator, organiser, public). **Who:** Coordinator, Organiser or Attendee. **Stage:** Any event with times set | [EVENT_TIMES_MANUAL_TESTS.md](EVENT_TIMES_MANUAL_TESTS.md) (TC-EVTIME-001–007) | [reset + seeds](#spm-326-run-events-on-start-and-end-times) |
| [SPM-49](https://linear.app/pygmies/issue/SPM-49) Update event planning information | The Coordinator edits an event's ordinary details; significant fields are shown locked | The event's **Event** tab. **Who:** Assigned Event Coordinator. **Stage:** The event is Planning or Confirmed | [UPDATE_EVENT_DETAILS_MANUAL_TESTS.md](UPDATE_EVENT_DETAILS_MANUAL_TESTS.md) (TC-EVDETAILS-001–004) | [reset + seeds](#spm-49-update-event-planning-information) |
| [SPM-52](https://linear.app/pygmies/issue/SPM-52) Submit a change request<br>[SPM-100](https://linear.app/pygmies/issue/SPM-100) Decide a change request, field by field | The Organiser asks to change an event's significant fields; the Coordinator accepts or declines each field | Organiser: the event's **Request a change** form. Coordinator: the event's **Change requests** page. **Who:** Event Organiser (owner), then the assigned Event Coordinator. **Stage:** The event is Planning or Confirmed and has no change request open | [CHANGE_REQUEST_MANUAL_TESTS.md](CHANGE_REQUEST_MANUAL_TESTS.md) (TC-CHANGE-001–009) | [reset + seeds](#spm-52-spm-100-change-requests) |
| [SPM-309](https://linear.app/pygmies/issue/SPM-309) Flag venue bookings after an accepted change | After a Coordinator accepts a change to date/time, attendance or venue needs, the event's live venue bookings show "Event changed" | The event's **Change requests** page, then its **Venue** tab. **Who:** Event Coordinator (`coordinator@test.com`, assigned to all four fixture events). **Stage:** An event is in Planning, it has bookings, and the Organiser's change request is waiting | [EVENT_CHANGE_FLAG_MANUAL_TESTS.md](EVENT_CHANGE_FLAG_MANUAL_TESTS.md) (TC-EVCHG-001–004) | [reset + seeds](#spm-309-flag-venue-bookings-after-an-accepted-change) |
| [SPM-68](https://linear.app/pygmies/issue/SPM-68) Notify the organiser of a reschedule or cancellation | The owning Organiser is told once when the Coordinator accepts new times or cancels the event | The Organiser's notification bell; the request page. **Who:** Assigned Event Coordinator, then the owning Event Organiser. **Stage:** A change request is decided, or an event is cancelled | [EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md](EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md) (TC-EVCHANGE-001–007) | [reset + seeds](#spm-68-notify-the-organiser-of-a-reschedule-or-cancellation) |
| [SPM-50](https://linear.app/pygmies/issue/SPM-50) Confirm an event<br>[SPM-264](https://linear.app/pygmies/issue/SPM-264) Block confirmation until the safety check is approved | Confirmation is refused until the essential arrangements are complete and the latest safety check is Approved | The **Confirmation** card of `/staff/coordinator/events/<id>`. **Who:** Assigned Event Coordinator; Safety Officer for the safety check. **Stage:** The event is Planning and the Coordinator is about to confirm | [CONFIRM_EVENT_MANUAL_TESTS.md](CONFIRM_EVENT_MANUAL_TESTS.md) (TC-CONFIRM-001–008) | [reset + seeds](#spm-50-spm-264-confirm-an-event) |
| [SPM-318](https://linear.app/pygmies/issue/SPM-318) Block confirmation on an unfulfilled essential line | Confirmation is refused while an essential equipment line is not reserved in full, naming each such line | The **Confirmation** card on the event's page. **Who:** Assigned Event Coordinator. **Stage:** The event is Planning, equipment lines exist, and the Coordinator is about to confirm | [CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md](CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md) (TC-CONFIRM-EQUIP-001–003) | [reset + seeds](#spm-318-block-confirmation-on-an-unfulfilled-essential-line) |
| [SPM-312](https://linear.app/pygmies/issue/SPM-312) Block confirmation while an arrangement is flagged | Confirmation is refused while any venue booking is flagged, naming each flagged booking once | The **Confirmation** card on the event's page. **Who:** Assigned Event Coordinator. **Stage:** Bookings are flagged after a venue block | [CONFIRM_EVENT_FLAG_MANUAL_TESTS.md](CONFIRM_EVENT_FLAG_MANUAL_TESTS.md) (TC-CONFIRM-FLAG-001–003) | [reset + seeds](#spm-312-block-confirmation-while-an-arrangement-is-flagged) |
| [SPM-51](https://linear.app/pygmies/issue/SPM-51) Mark an event as completed | The Coordinator marks a Confirmed event Completed, with notes, once its latest end time has passed | The **Confirmation** card of `/staff/coordinator/events/<id>`. **Who:** Assigned Event Coordinator. **Stage:** The event is Confirmed and its last end time is in the past | [COMPLETE_EVENT_MANUAL_TESTS.md](COMPLETE_EVENT_MANUAL_TESTS.md) (TC-COMPLETE-001–005) | [reset + seeds](#spm-51-mark-an-event-as-completed) |
| [SPM-55](https://linear.app/pygmies/issue/SPM-55) Cancel an event | Cancelling an event gives back everything it holds at a venue in the same step | The event page's **Cancel event** control. **Who:** Assigned Event Coordinator. **Stage:** The event has venue bookings, confirmed, held or pending | [EVENT_CANCEL_MANUAL_TESTS.md](EVENT_CANCEL_MANUAL_TESTS.md) (TC-ECANCEL-001–006) | [reset + seeds](#spm-55-cancel-an-event) |
| [SPM-25](https://linear.app/pygmies/issue/SPM-25) Enable registration for an event | The Coordinator turns registration on or off and sets its dates; attendees see the result | The event's **Registration** tab; public `/events`. **Who:** Assigned Event Coordinator, then an Attendee. **Stage:** The event is Planning or Confirmed | [EVENT_REGISTRATION_SETTINGS_MANUAL_TESTS.md](EVENT_REGISTRATION_SETTINGS_MANUAL_TESTS.md) (TC-REGSET-001–004) | [reset + seeds](#spm-25-enable-registration-for-an-event) |
| Attendee registration and withdrawal<br>[SPM-24](https://linear.app/pygmies/issue/SPM-24) [SPM-28](https://linear.app/pygmies/issue/SPM-28) [SPM-86](https://linear.app/pygmies/issue/SPM-86) [SPM-84](https://linear.app/pygmies/issue/SPM-84) | An attendee finds an open event, registers, and withdraws from the emailed link | Public `/events` and `/registrations/*`, signed out. **Who:** Attendee (signed out). **Stage:** The event is Confirmed and its registration window is open | [EVENT_REGISTRATION_MANUAL_TESTS.md](EVENT_REGISTRATION_MANUAL_TESTS.md) (TC-REG-001–TC-REGWD-003) | [reset + seeds](#spm-24-spm-28-spm-86-1-attendee-registration-and-withdrawal) |
| Registration email<br>[SPM-305](https://linear.app/pygmies/issue/SPM-305) [SPM-306](https://linear.app/pygmies/issue/SPM-306) [SPM-304](https://linear.app/pygmies/issue/SPM-304) | The attendee gets an email with the event details and registration link; the confirmation panel says where it was sent | Public registration page and the attendee's inbox. **Who:** Attendee (signed out). **Stage:** Right after registering for an open event | [REGISTRATION_EMAIL_MANUAL_TESTS.md](REGISTRATION_EMAIL_MANUAL_TESTS.md) (TC-REGEMAIL-001–004) | [reset + seeds](#spm-305-spm-306-spm-304-registration-email) |
| **Venues** | | | | |
| [SPM-42](https://linear.app/pygmies/issue/SPM-42) Maintain the venue catalogue | Venue Staff create and edit venues, including their opening hours | `/staff/venue/catalogue`. **Who:** Venue Staff. **Stage:** Maintaining the catalogue | [VENUE_CATALOGUE_MANUAL_TESTS.md](VENUE_CATALOGUE_MANUAL_TESTS.md) (TC-REQ-001–TC-VENUE-007) | [reset only](#spm-42-maintain-the-venue-catalogue) |
| Venue opening hours<br>[SPM-333](https://linear.app/pygmies/issue/SPM-333) [SPM-332](https://linear.app/pygmies/issue/SPM-332) [SPM-334](https://linear.app/pygmies/issue/SPM-334) [SPM-331](https://linear.app/pygmies/issue/SPM-331) [SPM-335](https://linear.app/pygmies/issue/SPM-335) | A venue's opening hours are one window a day on the 15-minute grid; bookings in closed time are refused | The venue form; the Coordinator's booking request. **Who:** Venue Staff and Event Coordinator. **Stage:** Creating a venue or requesting a booking | [VENUE_OPENING_HOURS_MANUAL_TESTS.md](VENUE_OPENING_HOURS_MANUAL_TESTS.md) (TC-VHOURS-001–008) | [reset + seeds](#spm-333-spm-332-spm-334-2-venue-opening-hours) |
| Venue setup and turnaround<br>[SPM-466](https://linear.app/pygmies/issue/SPM-466) [SPM-462](https://linear.app/pygmies/issue/SPM-462) [SPM-464](https://linear.app/pygmies/issue/SPM-464) [SPM-467](https://linear.app/pygmies/issue/SPM-467) [SPM-468](https://linear.app/pygmies/issue/SPM-468) | Venue Staff set a venue's setup and turnaround time once; they are then locked | The venue create/edit form. **Who:** Venue Staff. **Stage:** Creating or first editing a venue | [VENUE_BUFFERS_MANUAL_TESTS.md](VENUE_BUFFERS_MANUAL_TESTS.md) (TC-VBUFFER-001–006) | [reset + seeds](#spm-466-spm-462-spm-464-2-venue-setup-and-turnaround) |
| Find a venue<br>[SPM-44](https://linear.app/pygmies/issue/SPM-44) [SPM-322](https://linear.app/pygmies/issue/SPM-322) [SPM-250](https://linear.app/pygmies/issue/SPM-250) | The Coordinator searches venues by date, start and end time and filters; closed or booked venues are left out | `/staff/coordinator/venues`. **Who:** Event Coordinator. **Stage:** Looking for a venue for an event | [VENUE_SEARCH_MANUAL_TESTS.md](VENUE_SEARCH_MANUAL_TESTS.md) (TC-VSEARCH-001–020) | [reset + seeds](#spm-44-spm-322-spm-250-find-a-venue) |
| [SPM-323](https://linear.app/pygmies/issue/SPM-323) View a venue's availability on the 15-minute grid | A venue's availability is shown on the 15-minute grid with bookings, holds and blocks | The venue's calendar page. **Who:** Event Coordinator and Venue Staff. **Stage:** Bookings, holds and blocks exist | [VENUE_CALENDAR_MANUAL_TESTS.md](VENUE_CALENDAR_MANUAL_TESTS.md) (TC-VCAL-001–010) | [reset + seeds](#spm-323-view-a-venues-availability-on-the-15-minute-grid) |
| Mark a venue unavailable<br>[SPM-457](https://linear.app/pygmies/issue/SPM-457) [SPM-455](https://linear.app/pygmies/issue/SPM-455) [SPM-454](https://linear.app/pygmies/issue/SPM-454) [SPM-269](https://linear.app/pygmies/issue/SPM-269) [SPM-458](https://linear.app/pygmies/issue/SPM-458) [SPM-453](https://linear.app/pygmies/issue/SPM-453) [SPM-452](https://linear.app/pygmies/issue/SPM-452) | Venue Staff block a venue for a date range and time of day; the block shows in search, calendar and refusals | Venue Staff: the venue's unavailability page. **Who:** Venue Staff and Event Coordinator. **Stage:** A venue needs to be closed for part of the day | [VENUE_UNAVAILABILITY_MANUAL_TESTS.md](VENUE_UNAVAILABILITY_MANUAL_TESTS.md) (TC-VBLOCK-001–013) | [reset + seeds](#spm-457-spm-455-spm-454-4-mark-a-venue-unavailable) |
| Venue tab<br>[SPM-46](https://linear.app/pygmies/issue/SPM-46) [SPM-62](https://linear.app/pygmies/issue/SPM-62) [SPM-45](https://linear.app/pygmies/issue/SPM-45) | The Venue tab holds the whole booking workspace for the event: needs, suitability, booking and flags | The event's **Venue** tab `?tab=venue`. **Who:** Assigned Event Coordinator. **Stage:** The event is Planning and needs a venue | [EVENT_VENUE_TAB_MANUAL_TESTS.md](EVENT_VENUE_TAB_MANUAL_TESTS.md) (TC-VTAB-001–007) | [reset + seeds](#spm-46-spm-62-spm-45-venue-tab) |
| Request a venue<br>[SPM-46](https://linear.app/pygmies/issue/SPM-46) [SPM-104](https://linear.app/pygmies/issue/SPM-104) [SPM-249](https://linear.app/pygmies/issue/SPM-249) [SPM-348](https://linear.app/pygmies/issue/SPM-348) [SPM-349](https://linear.app/pygmies/issue/SPM-349) [SPM-350](https://linear.app/pygmies/issue/SPM-350) [SPM-351](https://linear.app/pygmies/issue/SPM-351) [SPM-347](https://linear.app/pygmies/issue/SPM-347) | The Coordinator requests a venue with a layout and start and end times; the page checks suitability and clashes | The event's **Request a venue** page (Venue tab). **Who:** Assigned Event Coordinator. **Stage:** An event is approved into Planning and needs a venue | [VENUE_BOOKING_MANUAL_TESTS.md](VENUE_BOOKING_MANUAL_TESTS.md) (TC-VENUE-BOOK-001–030) | [reset + seeds](#spm-46-spm-104-spm-249-5-request-a-venue) |
| [SPM-61](https://linear.app/pygmies/issue/SPM-61) Notify venue staff of a new booking request<br>[SPM-351](https://linear.app/pygmies/issue/SPM-351) Show requested times on the review page and new-request notification | Every Venue Staff member is told of a new booking request, with the venue and each date's times | Venue Staff notification bell. **Who:** Assigned Event Coordinator, then Venue Staff. **Stage:** A booking request is submitted | [VENUE_BOOKING_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_NOTIFICATION_MANUAL_TESTS.md) (TC-VENUENOTE-001–005) | [reset only](#spm-61-spm-351-notify-venue-staff-of-a-new-request) |
| [SPM-22](https://linear.app/pygmies/issue/SPM-22) Review and Decide on Venue Booking Requests | Venue Staff approve (Confirmed) or reject a booking request, with a reason and an optional suggestion | `/staff/venue`, `/staff/venue/decided`, `/staff/venue/archive`, `/staff/venue/<id>`. **Who:** Venue Staff. **Stage:** A Coordinator's booking request is waiting | [VENUE_BOOKING_DECISION_MANUAL_TESTS.md](VENUE_BOOKING_DECISION_MANUAL_TESTS.md) (TC-VBDECIDE-001–008) | [reset + seeds](#spm-22-review-and-decide-on-venue-booking-requests) |
| [SPM-62](https://linear.app/pygmies/issue/SPM-62) Notify the coordinator of the venue booking outcome | The Coordinator is told when Venue Staff approve or reject, naming the venue and the reason | The Coordinator's notification bell. **Who:** Venue Staff, then the assigned Event Coordinator. **Stage:** A booking request is decided | [VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md) (TC-VBDECIDENOTE-001–009) | [reset + seeds](#spm-62-notify-the-coordinator-of-the-venue-booking-outcome) |
| Tentative holds<br>[SPM-218](https://linear.app/pygmies/issue/SPM-218) [SPM-219](https://linear.app/pygmies/issue/SPM-219) [SPM-253](https://linear.app/pygmies/issue/SPM-253) [SPM-254](https://linear.app/pygmies/issue/SPM-254) [SPM-358](https://linear.app/pygmies/issue/SPM-358) | Venue Staff hold a booking for 72 hours, confirm or release it, it expires on time, and the Coordinator is warned | Venue Staff: `/staff/venue`. Coordinator: the event's Venue tab and notifications. **Who:** Venue Staff and assigned Event Coordinator. **Stage:** A booking request is waiting and the Coordinator is finalising | [VENUE_HOLD_MANUAL_TESTS.md](VENUE_HOLD_MANUAL_TESTS.md) (TC-VHOLD-001–014) | [reset + seeds](#spm-218-spm-219-spm-253-2-tentative-holds) |
| Padded approval<br>[SPM-471](https://linear.app/pygmies/issue/SPM-471) [SPM-470](https://linear.app/pygmies/issue/SPM-470) [SPM-472](https://linear.app/pygmies/issue/SPM-472) [SPM-475](https://linear.app/pygmies/issue/SPM-475) | Approving or holding a booking is refused when its setup and turnaround window overlaps a live booking | `/staff/venue/<booking id>` (approve / hold). **Who:** Venue Staff. **Stage:** Two bookings at one venue, close in time | [VENUE_PADDING_MANUAL_TESTS.md](VENUE_PADDING_MANUAL_TESTS.md) (TC-VPAD-001–009) | [reset + seeds](#spm-471-spm-470-spm-472-1-padded-approval) |
| [SPM-20](https://linear.app/pygmies/issue/SPM-20) Cancel Venue Booking and Free Up Availability | The Coordinator cancels one booking; its slots are free at once | **Request a venue** and the venue calendar. **Who:** Assigned Event Coordinator. **Stage:** An event has a Confirmed booking | [VENUE_BOOKING_CANCEL_MANUAL_TESTS.md](VENUE_BOOKING_CANCEL_MANUAL_TESTS.md) (TC-VCANCEL-001–005) | [reset + seeds](#spm-20-cancel-venue-booking-and-free-up-availability) |
| [SPM-63](https://linear.app/pygmies/issue/SPM-63) Notify venue staff of a cancelled booking | Venue Staff are told which venue, dates and times a cancelled Confirmed booking released | Venue Staff notification bell; the venue calendar. **Who:** Assigned Event Coordinator, then Venue Staff. **Stage:** A Confirmed booking is cancelled | [VENUE_BOOKING_CANCEL_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_CANCEL_NOTIFICATION_MANUAL_TESTS.md) (TC-VCANCELNOTE-001–004) | [reset + seeds](#spm-63-notify-venue-staff-of-a-cancelled-booking) |
| [SPM-313](https://linear.app/pygmies/issue/SPM-313) Flag bookings when a venue is marked unavailable<br>[SPM-453](https://linear.app/pygmies/issue/SPM-453) Record, list and lift functions on 15-minute slots, with a closed-time backstop | A venue block flags every Confirmed booking or live hold it overlaps | Venue Staff: the venue's unavailability page. Coordinator: the event's Venue tab. **Who:** Venue Staff, then the assigned Event Coordinator. **Stage:** Bookings exist where a block is recorded | [VENUE_FLAG_MANUAL_TESTS.md](VENUE_FLAG_MANUAL_TESTS.md) (TC-VFLAG-001–011) | [reset + seeds](#spm-313-spm-453-flag-bookings-when-a-venue-is-blocked) |
| [SPM-105](https://linear.app/pygmies/issue/SPM-105) Flag bookings when venue attributes change | Venue Staff's edit to a venue flags the bookings it no longer fits | Venue Staff: the venue's edit page. Coordinator: the event's **Venue** tab. **Who:** Venue Staff, then the assigned Event Coordinator. **Stage:** Confirmed bookings or live holds exist at the venue | [VENUE_CHANGE_FLAG_MANUAL_TESTS.md](VENUE_CHANGE_FLAG_MANUAL_TESTS.md) (TC-VCHG-001–006) | [reset + seeds](#spm-105-flag-bookings-when-venue-attributes-change) |
| [SPM-71](https://linear.app/pygmies/issue/SPM-71) Notify the coordinator of a flagged venue booking | The Coordinator is told when a venue change or block flags their booking | The Coordinator's notification bell. **Who:** Venue Staff, then the assigned Event Coordinator. **Stage:** A venue change or block flags a booking | [VENUE_FLAG_NOTIFICATION_MANUAL_TESTS.md](VENUE_FLAG_NOTIFICATION_MANUAL_TESTS.md) (TC-FLAGNOTE-001–005) | [reset + seeds](#spm-71-notify-the-coordinator-of-a-flagged-venue-booking) |
| [SPM-310](https://linear.app/pygmies/issue/SPM-310) Clear a flag when the booking still fits | The Coordinator clears every reason on a flagged booking that still suits | **Request a venue** (Flagged badge → **Clear flag**). **Who:** Assigned Event Coordinator. **Stage:** A booking is flagged by a venue block | [VENUE_FLAG_CLEAR_MANUAL_TESTS.md](VENUE_FLAG_CLEAR_MANUAL_TESTS.md) (TC-VFCLR-001–005) | [reset + seeds](#spm-310-clear-a-flag-when-the-booking-still-fits) |
| [SPM-361](https://linear.app/pygmies/issue/SPM-361) Write the contract migration that removes the AM/PM/Night slot codes | The contract migration deletes the AM, PM and Night slot rows and narrows slot codes to 0–95, on a fresh and an existing database | The database only (`supabase db query`); no app needed. **Who:** Developer (no signed-in role). **Stage:** Before and after `20261029000000_retire_am_pm_night_slots.sql` is applied | [SLOT_CODES_MANUAL_TESTS.md](SLOT_CODES_MANUAL_TESTS.md) (TC-SLOTCODE-001) | [reset only](#spm-361-write-the-contract-migration-that-removes-the-ampmnight-slot-codes) |
| **Equipment** | | | | |
| [SPM-40](https://linear.app/pygmies/issue/SPM-40) Maintain the equipment catalogue | Technical Support adds equipment and updates the number owned and its location | `/staff/technical/equipment`. **Who:** Technical Support Staff. **Stage:** Maintaining the catalogue | [2026-09-30-equipment-catalogue-manual-tests.md](2026-09-30-equipment-catalogue-manual-tests.md) (TC-EQCAT-001–016) | [reset only](#spm-40-maintain-the-equipment-catalogue) |
| Equipment requirements<br>[SPM-186](https://linear.app/pygmies/issue/SPM-186) [SPM-187](https://linear.app/pygmies/issue/SPM-187) [SPM-185](https://linear.app/pygmies/issue/SPM-185) [SPM-232](https://linear.app/pygmies/issue/SPM-232) | The Coordinator specifies equipment lines; a change to a reserved line reaches Technical Support as "Needs re-check" | Coordinator: the event's **Equipment** tab. Technical Support: `/staff/technical`. **Who:** Assigned Event Coordinator, then Technical Support Staff. **Stage:** The event has equipment lines, some already reserved | [EQUIPMENT_MANUAL_TESTS.md](EQUIPMENT_MANUAL_TESTS.md) (TC-EQUIP-001–017) | [reset + seeds](#spm-186-spm-187-spm-185-1-equipment-requirements) |
| [SPM-109](https://linear.app/pygmies/issue/SPM-109) Mark an equipment line as essential | The Coordinator switches an equipment line to Essential once agreed with Technical Support | The event's **Equipment** tab (**Essential** switch). **Who:** Assigned Event Coordinator (Technical Support agrees outside the system). **Stage:** Equipment lines exist and the event can still change | [EQUIPMENT_ESSENTIAL_MANUAL_TESTS.md](EQUIPMENT_ESSENTIAL_MANUAL_TESTS.md) (TC-ESSENTIAL-001–003) | [reset + seeds](#spm-109-mark-an-equipment-line-as-essential) |
| [SPM-273](https://linear.app/pygmies/issue/SPM-273) See equipment needing attention | Technical Support sees every active event with a new, changed or removal-requested line | `/staff/technical` (Needs review) and each event's page. **Who:** Technical Support Staff. **Stage:** Planning, Blocked or Confirmed events have lines needing attention | [EQUIPMENT_REVIEW_MANUAL_TESTS.md](EQUIPMENT_REVIEW_MANUAL_TESTS.md) (TC-EQUIPREVIEW-001–009) | [reset + seeds](#spm-273-see-equipment-needing-attention) |
| [SPM-274](https://linear.app/pygmies/issue/SPM-274) Reserve equipment for events | Technical Support reserves a line in full or marks it unfulfilled with a comment | `/staff/technical/<event>` (Decision column). **Who:** Technical Support Staff. **Stage:** A line is awaiting a decision | [EQUIPMENT_RESERVE_MANUAL_TESTS.md](EQUIPMENT_RESERVE_MANUAL_TESTS.md) (TC-RESERVE-001–007) | [reset + seeds](#spm-274-reserve-equipment-for-events) |
| [SPM-316](https://linear.app/pygmies/issue/SPM-316) Re-reserve a changed equipment line | Technical Support re-reserves a line the Coordinator changed after it was reserved, or marks it unfulfilled | `/staff/technical/<event>` (Decision column on a Changed line). **Who:** Technical Support Staff (the Coordinator changed the line). **Stage:** A reserved line is Changed and awaiting a decision | [EQUIPMENT_RERESERVE_MANUAL_TESTS.md](EQUIPMENT_RERESERVE_MANUAL_TESTS.md) (TC-RERESERVE-001–003) | [reset + seeds](#spm-316-re-reserve-a-changed-equipment-line) |
| [SPM-108](https://linear.app/pygmies/issue/SPM-108) Release equipment on a removal request | Technical Support releases the units held by a line the Coordinator asked to remove | `/staff/technical/<event>` (**Release N** in the Decision column). **Who:** Assigned Event Coordinator, then Technical Support Staff. **Stage:** A reserved line has Removal requested | [EQUIPMENT_RELEASE_MANUAL_TESTS.md](EQUIPMENT_RELEASE_MANUAL_TESTS.md) (TC-RELEASE-001–005) | [reset + seeds](#spm-108-release-equipment-on-a-removal-request) |
| [SPM-17](https://linear.app/pygmies/issue/SPM-17) Mark equipment out of service | Technical Support records how many units of a type are out of service; availability drops accordingly | `/staff/technical/equipment` cards; availability on Needs review event pages. **Who:** Technical Support Staff. **Stage:** Equipment exists and events are waiting for review | [EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md](EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md) (TC-OOS-001–007) | [reset + seeds](#spm-17-mark-equipment-out-of-service) |
| [SPM-64](https://linear.app/pygmies/issue/SPM-64) Notify technical support of an equipment requirement<br>[SPM-65](https://linear.app/pygmies/issue/SPM-65) Notify the coordinator of the equipment outcome | Technical Support is told of each equipment change; the Coordinator is told of the outcome | The notification inbox of each role. **Who:** Assigned Event Coordinator and Technical Support Staff. **Stage:** Lines are added, changed, reserved or marked unfulfilled | [EQUIPMENT_NOTIFICATION_MANUAL_TESTS.md](EQUIPMENT_NOTIFICATION_MANUAL_TESTS.md) (TC-EQUIPNOTE-001–006) | [reset + seeds](#spm-64-spm-65-equipment-notifications) |
| **Safety checks** | | | | |
| [SPM-258](https://linear.app/pygmies/issue/SPM-258) Safety Officer role | A Safety Officer signs in to their own workspace and other roles' areas stay apart | `/staff/safety` and the access-denied screen. **Who:** Safety Officer, and every other staff role. **Stage:** Signing in | [SAFETY_OFFICER_MANUAL_TESTS.md](SAFETY_OFFICER_MANUAL_TESTS.md) (TC-SAFETY-001–006) | [reset only](#spm-258-safety-officer-role) |
| [SPM-259](https://linear.app/pygmies/issue/SPM-259) See events awaiting a safety check | The Safety Officer sees Planning events with all bookings Confirmed and essential lines reserved | `/staff/safety`. **Who:** Safety Officer. **Stage:** Events are ready for a check | [SAFETY_CHECK_LIST_MANUAL_TESTS.md](SAFETY_CHECK_LIST_MANUAL_TESTS.md) (TC-SAFETYLIST-001–004) | [reset + SQL in doc](#spm-259-see-events-awaiting-a-safety-check) |
| [SPM-319](https://linear.app/pygmies/issue/SPM-319) Admit events with only non-essential gaps to the safety check | An event reaches Awaiting check once every essential line is reserved; non-essential gaps never hold it back | `/staff/safety` (Awaiting check). **Who:** Safety Officer. **Stage:** The event is Planning with its bookings Confirmed | [SAFETY_CHECK_ESSENTIAL_MANUAL_TESTS.md](SAFETY_CHECK_ESSENTIAL_MANUAL_TESTS.md) (TC-SAFEESS-001–004) | [reset + seeds](#spm-319-admit-events-with-only-non-essential-gaps-to-the-safety-check) |
| [SPM-260](https://linear.app/pygmies/issue/SPM-260) Conduct an operational safety check | The Safety Officer reviews an event and records Approved or Rejected; a rejection needs what to change | `/staff/safety/<event>`. **Who:** Safety Officer. **Stage:** An event is awaiting a check | [SAFETY_CHECK_MANUAL_TESTS.md](SAFETY_CHECK_MANUAL_TESTS.md) (TC-SAFETYCHECK-001–007) | [reset + SQL in doc](#spm-260-conduct-an-operational-safety-check) |
| [SPM-262](https://linear.app/pygmies/issue/SPM-262) Notify the Safety Officer of an event ready for check | Safety Officers are told when a change puts an event on the Awaiting check list | The Safety Officer's notification bell. **Who:** Venue Staff, Event Coordinator, Safety Officers. **Stage:** The last blocker for an event is cleared | [SAFETY_CHECK_NOTIFICATION_MANUAL_TESTS.md](SAFETY_CHECK_NOTIFICATION_MANUAL_TESTS.md) (TC-SAFETYNOTE-001–004) | [reset + SQL in doc](#spm-262-notify-the-safety-officer-of-an-event-ready-for-check) |
| [SPM-263](https://linear.app/pygmies/issue/SPM-263) Notify the coordinator of the safety outcome | The assigned Coordinator is told when a Safety Officer records Approved or Rejected | The Coordinator's notification bell. **Who:** Safety Officer, then the assigned Event Coordinator. **Stage:** An outcome is recorded | [SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md](SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md) (TC-SAFETYOUTCOME-001–007) | [reset + SQL in doc](#spm-263-notify-the-coordinator-of-the-safety-outcome) |
| [SPM-261](https://linear.app/pygmies/issue/SPM-261) Return an event after a safety outcome | After a rejection the Coordinator reworks the event and resubmits it for a fresh check | The event's **Safety** tab and `/staff/safety`. **Who:** Safety Officer and assigned Event Coordinator (and Venue Staff for bookings). **Stage:** An event was rejected | [SAFETY_RETURN_MANUAL_TESTS.md](SAFETY_RETURN_MANUAL_TESTS.md) (TC-SAFETYRETURN-001–008) | [reset + SQL in doc](#spm-261-return-an-event-after-a-safety-outcome) |
| **Sign-in and access** | | | | |
| [SPM-13](https://linear.app/pygmies/issue/SPM-13) Log in to the system<br>[SPM-14](https://linear.app/pygmies/issue/SPM-14) Log out of the system | Staff sign in with valid credentials and are refused with bad ones; signing out ends the session | `/auth/login` and the sign-out control. **Who:** Any seeded staff account. **Stage:** At the start and end of any session | [AUTH_MANUAL_TESTS.md](AUTH_MANUAL_TESTS.md) (TC-LOGIN-001–TC-LOGOUT-005) | [reset + seeds](#spm-13-spm-14-login-and-logout) |
| No ticket (PRs #48–#50)<br>Staff role guards | Workspaces open for their roles, `/staff/*` is closed signed out, and the account menu shows who is signed in | `/staff/*` and the public `/events`. **Who:** Every staff role, and signed-out visitors. **Stage:** Any time a page is opened | [STAFF_ROLE_GUARDS_MANUAL_TESTS.md](STAFF_ROLE_GUARDS_MANUAL_TESTS.md) (TC-GUARD-001–005) | [reset + seeds](#no-ticket-staff-role-guards) |
| Access-denied screen<br>[SPM-16](https://linear.app/pygmies/issue/SPM-16) [SPM-188](https://linear.app/pygmies/issue/SPM-188) [SPM-192](https://linear.app/pygmies/issue/SPM-192) | A signed-in user opening another role's page sees the access-denied screen with a 403, naming nothing about the record | Any `/staff/*` page, signed in as the wrong role. **Who:** Any staff role opening another role's page (Organiser, Event Coordinator, Event Coordinator Lead, Venue Staff, Technical Support Staff). **Stage:** Any time, when a role opens an address that is not theirs | [ACCESS_DENIED_MANUAL_TESTS.md](ACCESS_DENIED_MANUAL_TESTS.md) (TC-DENY-001–010) | [reset + seeds](#spm-16-spm-188-spm-192-access-denied-screen) |

## Setup by ticket

### Event requests and the Coordinator

#### SPM-38: Event Request Draft

**Scenario in one line**

An Organiser saves a draft, reloads, and sees the date and time window again.

**Who, where, when**

- **Who:** Event Organiser.
- **Where:** The Organiser's event request form.
- **Flow stage:** Part-way through filling in a new request.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, password `TestPass123!`.

**Cases:** [EVENT_REQUEST_DRAFT_MANUAL_TESTS.md](EVENT_REQUEST_DRAFT_MANUAL_TESTS.md) (TC-DRAFT-001)

#### SPM-31, SPM-38: Submit and draft an event request

**Scenario in one line**

An Organiser fills the form with one date and the slots wanted; mandatory fields and the future-date rule are enforced.

**Who, where, when**

- **Who:** Event Organiser.
- **Where:** **My event requests** → **New request**.
- **Flow stage:** Raising a new request.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, password `TestPass123!`.

**Cases:** [EVENT_REQUEST_MANUAL_TESTS.md](EVENT_REQUEST_MANUAL_TESTS.md) (TC-EVREQ-001–007)

#### SPM-31: Submit an event request

**Scenario in one line**

An Organiser submits a request; the typed start and end time show as typed; the request appears in the list.

**Who, where, when**

- **Who:** Event Organiser.
- **Where:** The request form and **My event requests**.
- **Flow stage:** Raising a new request.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, password `TestPass123!`.

**Cases:** [EVENT_REQUEST_SUBMIT_MANUAL_TESTS.md](EVENT_REQUEST_SUBMIT_MANUAL_TESTS.md) (TC-SUBMIT-001–003)

#### SPM-327: Request an event with a preferred start and end time

**Scenario in one line**

An Organiser enters a start and end time; the request stores the 15-minute span and shows it back.

**Who, where, when**

- **Who:** Event Organiser, then Coordinator and Lead reading it.
- **Where:** The request form and request detail.
- **Flow stage:** Raising or reading a request.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, password `TestPass123!`.

**Cases:** [REQUEST_TIMES_MANUAL_TESTS.md](REQUEST_TIMES_MANUAL_TESTS.md) (TC-REQTIME-001–006)

#### SPM-39: View my organisation's events

**Scenario in one line**

An Organiser opens Organisation events and sees colleagues' requests but never another organisation's.

**Who, where, when**

- **Who:** Event Organiser.
- **Where:** `/staff/requester/organisation`.
- **Flow stage:** Several requests exist, some from colleagues.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- One SQL block in the doc's Setup adds the extra requests.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, `organiser2@test.com`, password `TestPass123!`.

**Cases:** [ORGANISATION_EVENTS_MANUAL_TESTS.md](ORGANISATION_EVENTS_MANUAL_TESTS.md) (TC-ORGEV-001–004)

#### SPM-101: Record the withdrawal of a submitted event request

**Scenario in one line**

A Coordinator records the withdrawal; the Organiser sees a grey Withdrawn badge and Operations files it under assigned.

**Who, where, when**

- **Who:** Assigned Event Coordinator (Organiser and Lead set it up).
- **Where:** The request's detail page `/staff/coordinator/<id>`.
- **Flow stage:** A request is Under Review and the Organiser asks to withdraw.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- As `organiser@test.com` submit a complete request, then as `lead@test.com` assign it to Test Coordinator.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, `lead@test.com`, then `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_REQUEST_WITHDRAWAL_MANUAL_TESTS.md](EVENT_REQUEST_WITHDRAWAL_MANUAL_TESTS.md) (TC-WITHDRAW-001–003)

#### SPM-29, SPM-130: Coordinator assignment

**Scenario in one line**

The Lead opens a submitted request and assigns a coordinator. Submitted moves to Under Review; a reassignment keeps the status.

**Who, where, when**

- **Who:** Event Coordinator Lead.
- **Where:** `/staff/lead`, `/staff/lead/assigned`, `/staff/lead/<id>`.
- **Flow stage:** A request is Submitted and waiting for a coordinator, or already assigned.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- As `organiser@test.com`, submit a complete request named *QA Assign Workshop* (steps in the doc's Setup).

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `lead@test.com`, password `TestPass123!`.

**Cases:** [ASSIGNMENT_MANUAL_TESTS.md](ASSIGNMENT_MANUAL_TESTS.md) (TC-ASSIGN-001–008)

#### SPM-255, SPM-256, SPM-257: Event Coordinator Lead

**Scenario in one line**

The Lead reads who has what, opens an unassigned request read-only, and hands an active event to another coordinator; access and notices follow.

**Who, where, when**

- **Who:** Event Coordinator Lead.
- **Where:** `/staff/lead` (Unassigned, Coordinators) and a request or event's detail.
- **Flow stage:** Requests are waiting, or an active event needs a new coordinator.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `lead@test.com`, password `TestPass123!`.

**Cases:** [COORDINATOR_LEAD_MANUAL_TESTS.md](COORDINATOR_LEAD_MANUAL_TESTS.md) (TC-LEAD-001–006)

#### SPM-121, SPM-32: Coordinator queue and request detail

**Scenario in one line**

A Coordinator opens their queue; another coordinator's request, or any non-coordinator, sees nothing.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** `/staff/coordinator` and `/staff/coordinator/<id>`.
- **Flow stage:** A request is assigned and awaiting a decision.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [COORDINATOR_QUEUE_MANUAL_TESTS.md](COORDINATOR_QUEUE_MANUAL_TESTS.md) (TC-COORDQ-001–005)

#### SPM-33: Request clarification on an event request

**Scenario in one line**

A Coordinator returns an Under Review request with a question. The Organiser replies; once the last question is resolved the request is back Under Review.

**Who, where, when**

- **Who:** Event Coordinator and Event Organiser.
- **Where:** Coordinator: `/staff/coordinator/<id>`. Organiser: `/staff/requester/<id>`.
- **Flow stage:** A request is Under Review and the Coordinator needs more information.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, then `organiser@test.com`, password `TestPass123!`.

**Cases:** [CLARIFICATION_MANUAL_TESTS.md](CLARIFICATION_MANUAL_TESTS.md) (TC-CLARIFY-001–008)

#### SPM-34: Approve or reject an event request

**Scenario in one line**

A Coordinator opens an Under Review request and approves it (event opens in Planning) or rejects it with a required reason.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** `/staff/coordinator/<id>`.
- **Flow stage:** A request is Under Review.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [REQUEST_DECISION_MANUAL_TESTS.md](REQUEST_DECISION_MANUAL_TESTS.md) (TC-DECIDE-001–004)

#### SPM-58, SPM-59, SPM-60 +1: Organiser notifications

**Scenario in one line**

An Organiser submits a request; the Lead assigns it; the Coordinator asks or decides; the Organiser gets a notice each time.

**Who, where, when**

- **Who:** Event Organiser, Event Coordinator Lead, Event Coordinator.
- **Where:** The Organiser's notification bell.
- **Flow stage:** A request moves through assignment, clarification and decision.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- Start the app with Novu (`pnpm dev:local`, see the root README → Notifications). As `organiser@test.com` submit a complete request first.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, `lead@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [ORGANISER_NOTIFICATIONS_MANUAL_TESTS.md](ORGANISER_NOTIFICATIONS_MANUAL_TESTS.md) (TC-ORGNOTIFY-001–008)

#### SPM-174, SPM-172, SPM-179 +2: Staff notification inbox

**Scenario in one line**

A coordinator is assigned a request and sees the notice; they open it, mark it read, archive it and set channel preferences.

**Who, where, when**

- **Who:** Event Coordinator, Event Coordinator Lead, Event Organiser.
- **Where:** The notification bell and inbox in the staff header.
- **Flow stage:** A request is assigned or the Organiser posts on it.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
pnpm novu:clear
```

- Start the app with `NOVU_BRIDGE_URL` set (root README → Notifications).

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `lead@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [NOTIFICATIONS_MANUAL_TESTS.md](NOTIFICATIONS_MANUAL_TESTS.md) (TC-NOTIFY-001–013)

### The event after approval

#### SPM-285: Split the coordinator event page into tabs

**Scenario in one line**

A Coordinator opens an event and switches tabs; the Confirmation card stays beside each; a link with `?tab=` opens that tab.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** `/staff/coordinator/events/<id>` and `?tab=`.
- **Flow stage:** An event exists in Planning.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_PAGE_TABS_MANUAL_TESTS.md](EVENT_PAGE_TABS_MANUAL_TESTS.md) (TC-EVTABS-001–002)

#### SPM-326: Run events on start and end times

**Scenario in one line**

A viewer opens an event and reads the exact times, shown in their timezone.

**Who, where, when**

- **Who:** Coordinator, Organiser or Attendee.
- **Where:** Every event page (coordinator, organiser, public).
- **Flow stage:** Any event with times set.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- One SQL block in the doc's Setup sets up the event times.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_TIMES_MANUAL_TESTS.md](EVENT_TIMES_MANUAL_TESTS.md) (TC-EVTIME-001–007)

#### SPM-49: Update event planning information

**Scenario in one line**

A Coordinator edits name, description and notes directly; date, times and attendance are locked with a pointer to change requests.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The event's **Event** tab.
- **Flow stage:** The event is Planning or Confirmed.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [UPDATE_EVENT_DETAILS_MANUAL_TESTS.md](UPDATE_EVENT_DETAILS_MANUAL_TESTS.md) (TC-EVDETAILS-001–004)

#### SPM-52, SPM-100: Change requests

**Scenario in one line**

An Organiser submits one request covering times, attendance and equipment. The Coordinator accepts some fields and declines one with a reason; only accepted fields change the event.

**Who, where, when**

- **Who:** Event Organiser (owner), then the assigned Event Coordinator.
- **Where:** Organiser: the event's **Request a change** form. Coordinator: the event's **Change requests** page.
- **Flow stage:** The event is Planning or Confirmed and has no change request open.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- Approve *Operations Roadmap Conference* into an event: run the SQL in the doc's Setup (one `coordinator_decide_event_request` call).

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser2@test.com`, then `coordinator@test.com`, password `TestPass123!`.

**Cases:** [CHANGE_REQUEST_MANUAL_TESTS.md](CHANGE_REQUEST_MANUAL_TESTS.md) (TC-CHANGE-001–009)

#### SPM-309: Flag venue bookings after an accepted change

**Scenario in one line**

An Event Coordinator accepts a change on the decision page. The event's live venue bookings then show "Flagged for review" on the Venue tab.

**Who, where, when**

- **Who:** Event Coordinator (`coordinator@test.com`, assigned to all four fixture events).
- **Where:** The event's **Change requests** page, then its **Venue** tab.
- **Flow stage:** An event is in Planning, it has bookings, and the Organiser's change request is waiting.

> **Note:** Pending: this doc and its scripts arrive with PR #190 (SPM-309); the links below work once it merges.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-event-change-flags/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Run again without a reset:** re-run the last command; it replaces its own events.

**Look at the data:** `supabase db query --file scripts/seed-event-change-flags/show.sql --local`

**Clean up:** `supabase db query --file scripts/seed-event-change-flags/teardown.sql --local`

**Cases:** [EVENT_CHANGE_FLAG_MANUAL_TESTS.md](EVENT_CHANGE_FLAG_MANUAL_TESTS.md) (TC-EVCHG-001–004)

#### SPM-68: Notify the organiser of a reschedule or cancellation

**Scenario in one line**

A Coordinator accepts new times on a change request, or cancels the event; the Organiser gets one notice that opens the request and can be read. A declined change sends none.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then the owning Event Organiser.
- **Where:** The Organiser's notification bell; the request page.
- **Flow stage:** A change request is decided, or an event is cancelled.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
pnpm novu:clear
```

- Load the fixture: `awk '/^```sql/{f=1;next} /^```/{if(f){exit}} f' docs/testing/EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md | docker exec -i supabase_db_connectsphere psql -U postgres -d postgres` (it approves *Operations Roadmap Conference* into an event and clears earlier notices).
- The Inbox cases (TC-EVCHANGE-002 and 006) need Novu: start with `pnpm dev:local`; the others only need `pnpm dev`.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, then `organiser2@test.com`, password `TestPass123!`.

**Cases:** [EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md](EVENT_CHANGE_NOTIFICATION_MANUAL_TESTS.md) (TC-EVCHANGE-001–007)

#### SPM-50, SPM-264: Confirm an event

**Scenario in one line**

A Coordinator opens an event. The card names which arrangement or safety check blocks it; once all are met, Confirm event works.

**Who, where, when**

- **Who:** Assigned Event Coordinator; Safety Officer for the safety check.
- **Where:** The **Confirmation** card of `/staff/coordinator/events/<id>`.
- **Flow stage:** The event is Planning and the Coordinator is about to confirm.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
```

- Add the venue, programme and registration arrangements and the safety check, and load the *Riverside Safety Gate Fair* fixture: run the SQL blocks in the doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [CONFIRM_EVENT_MANUAL_TESTS.md](CONFIRM_EVENT_MANUAL_TESTS.md) (TC-CONFIRM-001–008)

#### SPM-318: Block confirmation on an unfulfilled essential line

**Scenario in one line**

A Coordinator marks a line Essential. While it is short, the card says "Cannot confirm" and lists it; non-essential lines never block.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The **Confirmation** card on the event's page.
- **Flow stage:** The event is Planning, equipment lines exist, and the Coordinator is about to confirm.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md](CONFIRM_EVENT_EQUIPMENT_MANUAL_TESTS.md) (TC-CONFIRM-EQUIP-001–003)

#### SPM-312: Block confirmation while an arrangement is flagged

**Scenario in one line**

Venue blocks flag the Founders' Gala Dinner's bookings. The card lists them; clearing or releasing the flags lets other gates apply.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The **Confirmation** card on the event's page.
- **Flow stage:** Bookings are flagged after a venue block.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Run again without a reset:** remove the blocks and flags, then run the last command again.

**Clean up:** `supabase db query --file scripts/seed-booking-flag-clear/teardown.sql --local`

**Cases:** [CONFIRM_EVENT_FLAG_MANUAL_TESTS.md](CONFIRM_EVENT_FLAG_MANUAL_TESTS.md) (TC-CONFIRM-FLAG-001–003)

#### SPM-51: Mark an event as completed

**Scenario in one line**

A Coordinator opens a Confirmed event whose end time has passed and completes it with operational notes. Before the end time, or if not Confirmed, the button is off.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The **Confirmation** card of `/staff/coordinator/events/<id>`.
- **Flow stage:** The event is Confirmed and its last end time is in the past.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- Approve *Operations Roadmap Conference*, make it Confirmed and give it past slots: run the SQL in the doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [COMPLETE_EVENT_MANUAL_TESTS.md](COMPLETE_EVENT_MANUAL_TESTS.md) (TC-COMPLETE-001–005)

#### SPM-55: Cancel an event

**Scenario in one line**

A Coordinator cancels an event. Confirmed bookings and live holds become Released, pending requests Cancelled, lapsed holds Expired.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The event page's **Cancel event** control.
- **Flow stage:** The event has venue bookings, confirmed, held or pending.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-event-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/verify.sql --local
supabase db query --file scripts/seed-event-cancel/verify.sql --local
```

- `bcv` should return 7 rows and `ecv` 2 rows, all `ok = true`.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_CANCEL_MANUAL_TESTS.md](EVENT_CANCEL_MANUAL_TESTS.md) (TC-ECANCEL-001–006)

#### SPM-25: Enable registration for an event

**Scenario in one line**

A Coordinator enables registration with an opening and closing date. Attendees can register only while the event is Confirmed and the window is open.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then an Attendee.
- **Where:** The event's **Registration** tab; public `/events`.
- **Flow stage:** The event is Planning or Confirmed.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
```

- Create the test event the cases use: run the SQL block in the doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_REGISTRATION_SETTINGS_MANUAL_TESTS.md](EVENT_REGISTRATION_SETTINGS_MANUAL_TESTS.md) (TC-REGSET-001–004)

#### SPM-24, SPM-28, SPM-86 +1: Attendee registration and withdrawal

**Scenario in one line**

An attendee with no account registers for a Confirmed event open for registration, then withdraws from their link.

**Who, where, when**

- **Who:** Attendee (signed out).
- **Where:** Public `/events` and `/registrations/*`, signed out.
- **Flow stage:** The event is Confirmed and its registration window is open.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-venues/seed.sql --local
```

- Create the *TC-REG test event*: run the SQL block in the doc's [Setup](EVENT_REGISTRATION_MANUAL_TESTS.md#a-confirmed-event-that-is-open-for-registration).

**Run the app:** `pnpm dev:local`, then open the public pages signed out, in a private window.

**Cases:** [EVENT_REGISTRATION_MANUAL_TESTS.md](EVENT_REGISTRATION_MANUAL_TESTS.md) (TC-REG-001–TC-REGWD-003)

#### SPM-305, SPM-306, SPM-304: Registration email

**Scenario in one line**

An attendee registers; the panel says the link was emailed, and the email carries name, date, time and venue.

**Who, where, when**

- **Who:** Attendee (signed out).
- **Where:** Public registration page and the attendee's inbox.
- **Flow stage:** Right after registering for an open event.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-venues/seed.sql --local
```

- Create the *TC-REG test event* as in [EVENT_REGISTRATION_MANUAL_TESTS.md](EVENT_REGISTRATION_MANUAL_TESTS.md#a-confirmed-event-that-is-open-for-registration). Start with Novu set and have an inbox you can read.

**Run the app:** `pnpm dev:local`, then open the public pages signed out, in a private window.

**Cases:** [REGISTRATION_EMAIL_MANUAL_TESTS.md](REGISTRATION_EMAIL_MANUAL_TESTS.md) (TC-REGEMAIL-001–004)

### Venues

#### SPM-42: Maintain the venue catalogue

**Scenario in one line**

Venue Staff add a venue with capacity, facilities and an opening-hours window, then edit it.

**Who, where, when**

- **Who:** Venue Staff.
- **Where:** `/staff/venue/catalogue`.
- **Flow stage:** Maintaining the catalogue.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, password `TestPass123!`.

**Cases:** [VENUE_CATALOGUE_MANUAL_TESTS.md](VENUE_CATALOGUE_MANUAL_TESTS.md) (TC-REQ-001–TC-VENUE-007)

#### SPM-333, SPM-332, SPM-334 +2: Venue opening hours

**Scenario in one line**

Venue Staff set an opening window; a Coordinator requesting time outside it is refused.

**Who, where, when**

- **Who:** Venue Staff and Event Coordinator.
- **Where:** The venue form; the Coordinator's booking request.
- **Flow stage:** Creating a venue or requesting a booking.

> **Note:** The conversion cases (SPM-331) need a database reset to the last version that still has AM/PM/Night: `supabase db reset --version 20261028010000`.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

- Run TC-VCAT-002 and 004 first, so *UAT-42 Lecture Hall* exists open 13:00–24:00.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_OPENING_HOURS_MANUAL_TESTS.md](VENUE_OPENING_HOURS_MANUAL_TESTS.md) (TC-VHOURS-001–008)

#### SPM-466, SPM-462, SPM-464 +2: Venue setup and turnaround

**Scenario in one line**

Venue Staff set setup and turnaround minutes and save; afterwards the fields are read-only.

**Who, where, when**

- **Who:** Venue Staff.
- **Where:** The venue create/edit form.
- **Flow stage:** Creating or first editing a venue.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BUFFERS_MANUAL_TESTS.md](VENUE_BUFFERS_MANUAL_TESTS.md) (TC-VBUFFER-001–006)

#### SPM-44, SPM-322, SPM-250: Find a venue

**Scenario in one line**

A Coordinator enters a date and a time range and filters; venues closed or overlapped are not listed, with a summary of why.

**Who, where, when**

- **Who:** Event Coordinator.
- **Where:** `/staff/coordinator/venues`.
- **Flow stage:** Looking for a venue for an event.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Clean up:** `supabase db query --file scripts/seed-venue-search-uat/teardown.sql --local`

**Cases:** [VENUE_SEARCH_MANUAL_TESTS.md](VENUE_SEARCH_MANUAL_TESTS.md) (TC-VSEARCH-001–020)

#### SPM-323: View a venue's availability on the 15-minute grid

**Scenario in one line**

A Coordinator or Venue Staff open a venue's week and read each bar in the right place.

**Who, where, when**

- **Who:** Event Coordinator and Venue Staff.
- **Where:** The venue's calendar page.
- **Flow stage:** Bookings, holds and blocks exist.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-venue-unavailability/seed.sql --local
supabase db query --file scripts/seed-booking-holds/seed.sql --local
supabase db query --file scripts/seed-venue-calendar/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, `venue@test.com`, password `TestPass123!`.

**Cases:** [VENUE_CALENDAR_MANUAL_TESTS.md](VENUE_CALENDAR_MANUAL_TESTS.md) (TC-VCAL-001–010)

#### SPM-457, SPM-455, SPM-454 +4: Mark a venue unavailable

**Scenario in one line**

Venue Staff record a block; a Coordinator is refused that time and venue search leaves it out; lifting it frees the time.

**Who, where, when**

- **Who:** Venue Staff and Event Coordinator.
- **Where:** Venue Staff: the venue's unavailability page.
- **Flow stage:** A venue needs to be closed for part of the day.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_UNAVAILABILITY_MANUAL_TESTS.md](VENUE_UNAVAILABILITY_MANUAL_TESTS.md) (TC-VBLOCK-001–013)

#### SPM-46, SPM-62, SPM-45: Venue tab

**Scenario in one line**

A Coordinator picks a venue, sees the suitability checklist and sends a booking request from the tab; the old Request a venue address redirects here.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The event's **Venue** tab `?tab=venue`.
- **Flow stage:** The event is Planning and needs a venue.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-flags/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EVENT_VENUE_TAB_MANUAL_TESTS.md](EVENT_VENUE_TAB_MANUAL_TESTS.md) (TC-VTAB-001–007)

#### SPM-46, SPM-104, SPM-249 +5: Request a venue

**Scenario in one line**

A Coordinator picks a venue, a layout and times for each date, sees the suitability checklist, and sends the request.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** The event's **Request a venue** page (Venue tab).
- **Flow stage:** An event is approved into Planning and needs a venue.

> **Note:** The slot-conversion case (SPM-347) needs a database reset to the last version that still has AM/PM/Night: `supabase db reset --version 20261028010000`, then the three seeds.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
```

- Approve an Under Review request first (steps in the doc's Setup). For TC-VENUE-BOOK-010 to 018 also run `supabase db query --file scripts/seed-equipment/seed.sql --local` and the SQL reset block in the doc.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_MANUAL_TESTS.md](VENUE_BOOKING_MANUAL_TESTS.md) (TC-VENUE-BOOK-001–030)

#### SPM-61, SPM-351: Notify Venue Staff of a new request

**Scenario in one line**

A Coordinator sends a booking request; both Venue Staff get a notice that opens the request.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then Venue Staff.
- **Where:** Venue Staff notification bell.
- **Flow stage:** A booking request is submitted.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- Use the seeded *Operations Roadmap Conference* (event request 6). Start the app with `NOVU_BRIDGE_URL` set.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, `venue@test.com`, `venue2@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_NOTIFICATION_MANUAL_TESTS.md) (TC-VENUENOTE-001–005)

#### SPM-22: Review and Decide on Venue Booking Requests

**Scenario in one line**

Venue Staff open a Requested booking and approve it (slots held) or reject it with a reason.

**Who, where, when**

- **Who:** Venue Staff.
- **Where:** `/staff/venue`, `/staff/venue/decided`, `/staff/venue/archive`, `/staff/venue/<id>`.
- **Flow stage:** A Coordinator's booking request is waiting.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
```

- One SQL block in the doc's Setup creates the requests the cases decide on.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_DECISION_MANUAL_TESTS.md](VENUE_BOOKING_DECISION_MANUAL_TESTS.md) (TC-VBDECIDE-001–008)

#### SPM-62: Notify the coordinator of the venue booking outcome

**Scenario in one line**

Venue Staff reject a booking with a suggestion; the Coordinator gets a notice naming the venue, reason and suggestion.

**Who, where, when**

- **Who:** Venue Staff, then the assigned Event Coordinator.
- **Where:** The Coordinator's notification bell.
- **Flow stage:** A booking request is decided.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
pnpm novu:clear
```

- Start the app with `NOVU_BRIDGE_URL` set. One SQL block in the doc's Setup creates the requests.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_DECISION_NOTIFICATION_MANUAL_TESTS.md) (TC-VBDECIDENOTE-001–009)

#### SPM-218, SPM-219, SPM-253 +2: Tentative holds

**Scenario in one line**

Venue Staff place a hold on a request; it blocks others, expires or is confirmed; the Coordinator is warned before it lapses.

**Who, where, when**

- **Who:** Venue Staff and assigned Event Coordinator.
- **Where:** Venue Staff: `/staff/venue`. Coordinator: the event's Venue tab and notifications.
- **Flow stage:** A booking request is waiting and the Coordinator is finalising.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-holds/seed.sql --local
supabase db query --file scripts/seed-booking-holds/fixture.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_HOLD_MANUAL_TESTS.md](VENUE_HOLD_MANUAL_TESTS.md) (TC-VHOLD-001–014)

#### SPM-471, SPM-470, SPM-472 +1: Padded approval

**Scenario in one line**

Venue Staff approve a booking whose padded window touches another; the refusal names the date, the overlap and the event.

**Who, where, when**

- **Who:** Venue Staff.
- **Where:** `/staff/venue/<booking id>` (approve / hold).
- **Flow stage:** Two bookings at one venue, close in time.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-venue-padding/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, password `TestPass123!`.

**Cases:** [VENUE_PADDING_MANUAL_TESTS.md](VENUE_PADDING_MANUAL_TESTS.md) (TC-VPAD-001–009)

#### SPM-20: Cancel Venue Booking and Free Up Availability

**Scenario in one line**

A Coordinator cancels a Confirmed booking. It becomes Released, the calendar shows its slots Available, and another booking can take them.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** **Request a venue** and the venue calendar.
- **Flow stage:** An event has a Confirmed booking.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/verify.sql --local
```

- `bcv` should read `ok = true` on every row.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_CANCEL_MANUAL_TESTS.md](VENUE_BOOKING_CANCEL_MANUAL_TESTS.md) (TC-VCANCEL-001–005)

#### SPM-63: Notify venue staff of a cancelled booking

**Scenario in one line**

A Coordinator cancels a Confirmed booking; both Venue Staff get a notice that opens the calendar on the freed week.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then Venue Staff.
- **Where:** Venue Staff notification bell; the venue calendar.
- **Flow stage:** A Confirmed booking is cancelled.

> **Note:** These cases use the same bookings as the SPM-20 cancel cases and **replace** TC-VCANCEL-001 and 003. Run one file's cases or the other's on a fresh seed.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/verify.sql --local
pnpm novu:clear
```

- Start the app with `NOVU_BRIDGE_URL` set.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, `venue@test.com`, `venue2@test.com`, password `TestPass123!`.

**Cases:** [VENUE_BOOKING_CANCEL_NOTIFICATION_MANUAL_TESTS.md](VENUE_BOOKING_CANCEL_NOTIFICATION_MANUAL_TESTS.md) (TC-VCANCELNOTE-001–004)

#### SPM-313, SPM-453: Flag bookings when a venue is blocked

**Scenario in one line**

Venue Staff block a venue over booked times; affected bookings show Flagged with the reason; Requested ones do not.

**Who, where, when**

- **Who:** Venue Staff, then the assigned Event Coordinator.
- **Where:** Venue Staff: the venue's unavailability page. Coordinator: the event's Venue tab.
- **Flow stage:** Bookings exist where a block is recorded.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-booking-flags/seed.sql --local
supabase db query --file scripts/seed-booking-flags/show.sql --local
```

- The blocks the cases record are in `scripts/seed-booking-flags/blocks.sql`; some cases also use the venue, equipment and cancel seeds (see the doc).

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, then `coordinator@test.com`, password `TestPass123!`.

**Clean up:** `supabase db query --file scripts/seed-booking-flags/teardown.sql --local`

**Cases:** [VENUE_FLAG_MANUAL_TESTS.md](VENUE_FLAG_MANUAL_TESTS.md) (TC-VFLAG-001–011)

#### SPM-105: Flag bookings when venue attributes change

**Scenario in one line**

Venue Staff cut a capacity or change facilities and save. Only the bookings that no longer suit are flagged, with a reason.

**Who, where, when**

- **Who:** Venue Staff, then the assigned Event Coordinator.
- **Where:** Venue Staff: the venue's edit page. Coordinator: the event's **Venue** tab.
- **Flow stage:** Confirmed bookings or live holds exist at the venue.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-change-flags/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, then `coordinator@test.com`, password `TestPass123!`.

**Run again without a reset:** re-run the seed command; it puts the hall back.

**Look at the data:** `supabase db query --file scripts/seed-venue-change-flags/show.sql --local`

**Clean up:** `supabase db query --file scripts/seed-venue-change-flags/teardown.sql --local`

**Cases:** [VENUE_CHANGE_FLAG_MANUAL_TESTS.md](VENUE_CHANGE_FLAG_MANUAL_TESTS.md) (TC-VCHG-001–006)

#### SPM-71: Notify the coordinator of a flagged venue booking

**Scenario in one line**

Venue Staff change a venue; the Coordinator gets a "Booking flagged" notice naming the venue and each reason.

**Who, where, when**

- **Who:** Venue Staff, then the assigned Event Coordinator.
- **Where:** The Coordinator's notification bell.
- **Flow stage:** A venue change or block flags a booking.

> **Note:** These cases edit the same Change Test Hall as the SPM-105 cases. Run one file's cases or the other's on a fresh seed.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-change-flags/seed.sql --local
supabase db query --file scripts/seed-venue-change-flags/show.sql --local
pnpm novu:clear
```

- Start the app with `NOVU_BRIDGE_URL` set; `show.sql` should list 7 bookings and no flags.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [VENUE_FLAG_NOTIFICATION_MANUAL_TESTS.md](VENUE_FLAG_NOTIFICATION_MANUAL_TESTS.md) (TC-FLAGNOTE-001–005)

#### SPM-310: Clear a flag when the booking still fits

**Scenario in one line**

A Coordinator opens a flagged booking, confirms, and the reasons clear; the booking stays Confirmed.

**Who, where, when**

- **Who:** Assigned Event Coordinator.
- **Where:** **Request a venue** (Flagged badge → **Clear flag**).
- **Flow stage:** A booking is flagged by a venue block.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
supabase db query --file scripts/seed-booking-cancel/seed.sql --local
supabase db query --file scripts/seed-booking-flag-clear/blocks.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Run again without a reset:** remove the blocks and flags, then run the last command again.

**Clean up:** `supabase db query --file scripts/seed-booking-flag-clear/teardown.sql --local`

**Cases:** [VENUE_FLAG_CLEAR_MANUAL_TESTS.md](VENUE_FLAG_CLEAR_MANUAL_TESTS.md) (TC-VFCLR-001–005)

#### SPM-361: Write the contract migration that removes the AM/PM/Night slot codes

**Scenario in one line**

A developer applies the migration to a fresh database and to one with old-style slot data, and checks the rows and the constraint.

**Who, where, when**

- **Who:** Developer (no signed-in role).
- **Where:** The database only (`supabase db query`); no app needed.
- **Flow stage:** Before and after `20261029000000_retire_am_pm_night_slots.sql` is applied.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- Run the queries in the doc with `supabase db query --local "<sql>"`. Cases on pre-migration data start from `supabase db reset --version 20261028010000`.

**Run the app:** not needed; these are database checks.

**Cases:** [SLOT_CODES_MANUAL_TESTS.md](SLOT_CODES_MANUAL_TESTS.md) (TC-SLOTCODE-001)

### Equipment

#### SPM-40: Maintain the equipment catalogue

**Scenario in one line**

Technical Support adds a type and edits the number owned and the location on its card.

**Who, where, when**

- **Who:** Technical Support Staff.
- **Where:** `/staff/technical/equipment`.
- **Flow stage:** Maintaining the catalogue.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `support@test.com`, password `TestPass123!`.

**Cases:** [2026-09-30-equipment-catalogue-manual-tests.md](2026-09-30-equipment-catalogue-manual-tests.md) (TC-EQCAT-001–016)

#### SPM-186, SPM-187, SPM-185 +1: Equipment requirements

**Scenario in one line**

A Coordinator adds, edits or removes lines. Editing a reserved line warns first, then marks it for Technical Support to re-check.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then Technical Support Staff.
- **Where:** Coordinator: the event's **Equipment** tab. Technical Support: `/staff/technical`.
- **Flow stage:** The event has equipment lines, some already reserved.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, then `support@test.com`, password `TestPass123!`.

**Run again without a reset:** run `teardown.sql` first.

**Clean up:** `supabase db query --file scripts/seed-equipment/teardown.sql --local`

**Cases:** [EQUIPMENT_MANUAL_TESTS.md](EQUIPMENT_MANUAL_TESTS.md) (TC-EQUIP-001–017)

#### SPM-109: Mark an equipment line as essential

**Scenario in one line**

A Coordinator switches Essential on for a line; it saves at once and is locked once the event can no longer change.

**Who, where, when**

- **Who:** Assigned Event Coordinator (Technical Support agrees outside the system).
- **Where:** The event's **Equipment** tab (**Essential** switch).
- **Flow stage:** Equipment lines exist and the event can still change.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
supabase db query --file scripts/seed-equipment/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_ESSENTIAL_MANUAL_TESTS.md](EQUIPMENT_ESSENTIAL_MANUAL_TESTS.md) (TC-ESSENTIAL-001–003)

#### SPM-273: See equipment needing attention

**Scenario in one line**

Technical Support opens Needs review; each event shows its marked lines and how many units are free on its dates.

**Who, where, when**

- **Who:** Technical Support Staff.
- **Where:** `/staff/technical` (Needs review) and each event's page.
- **Flow stage:** Planning, Blocked or Confirmed events have lines needing attention.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-review/seed.sql --local
supabase db query --file scripts/seed-equipment-review/verify.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `support@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_REVIEW_MANUAL_TESTS.md](EQUIPMENT_REVIEW_MANUAL_TESTS.md) (TC-EQUIPREVIEW-001–009)

#### SPM-274: Reserve equipment for events

**Scenario in one line**

Technical Support opens an event under Needs review and clicks Reserve when enough is free, or marks the line Unfulfilled with a comment when not.

**Who, where, when**

- **Who:** Technical Support Staff.
- **Where:** `/staff/technical/<event>` (Decision column).
- **Flow stage:** A line is awaiting a decision.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-reserve/seed.sql --local
supabase db query --file scripts/seed-equipment-reserve/verify.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `support@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_RESERVE_MANUAL_TESTS.md](EQUIPMENT_RESERVE_MANUAL_TESTS.md) (TC-RESERVE-001–007)

#### SPM-316: Re-reserve a changed equipment line

**Scenario in one line**

A Coordinator raised a reserved line's quantity. Technical Support clicks Reserve N when enough are free (units already held count), or marks it Unfulfilled when one short.

**Who, where, when**

- **Who:** Technical Support Staff (the Coordinator changed the line).
- **Where:** `/staff/technical/<event>` (Decision column on a Changed line).
- **Flow stage:** A reserved line is Changed and awaiting a decision.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-review/seed.sql --local
supabase db query --file scripts/seed-equipment-review/verify.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `support@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_RERESERVE_MANUAL_TESTS.md](EQUIPMENT_RERESERVE_MANUAL_TESTS.md) (TC-RERESERVE-001–003)

#### SPM-108: Release equipment on a removal request

**Scenario in one line**

A Coordinator requests a line's removal. Technical Support clicks Release; the line goes and its units are free again.

**Who, where, when**

- **Who:** Assigned Event Coordinator, then Technical Support Staff.
- **Where:** `/staff/technical/<event>` (**Release N** in the Decision column).
- **Flow stage:** A reserved line has Removal requested.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-review/seed.sql --local
supabase db query --file scripts/seed-equipment-review/verify.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, then `support@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_RELEASE_MANUAL_TESTS.md](EQUIPMENT_RELEASE_MANUAL_TESTS.md) (TC-RELEASE-001–005)

#### SPM-17: Mark equipment out of service

**Scenario in one line**

Technical Support sets units out of service; the card shows Owned, Out of service and in service, and Needs review counts only the rest.

**Who, where, when**

- **Who:** Technical Support Staff.
- **Where:** `/staff/technical/equipment` cards; availability on Needs review event pages.
- **Flow stage:** Equipment exists and events are waiting for review.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-review/seed.sql --local
supabase db query --file scripts/seed-equipment-review/verify.sql --local
```

- Some cases also use the coordinator seeds: the doc's Setup lists them.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `support@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md](EQUIPMENT_OUT_OF_SERVICE_MANUAL_TESTS.md) (TC-OOS-001–007)

#### SPM-64, SPM-65: Equipment notifications

**Scenario in one line**

A Coordinator changes a line; every Technical Support member gets a notice. When Technical Support decides, the Coordinator gets one.

**Who, where, when**

- **Who:** Assigned Event Coordinator and Technical Support Staff.
- **Where:** The notification inbox of each role.
- **Flow stage:** Lines are added, changed, reserved or marked unfulfilled.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-equipment-reserve/seed.sql --local
supabase db query --file scripts/seed-equipment-reserve/verify.sql --local
```

- Notices need Novu running: see the doc's Setup and the root README → Notifications.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `coordinator@test.com`, `support@test.com`, `support2@test.com`, password `TestPass123!`.

**Cases:** [EQUIPMENT_NOTIFICATION_MANUAL_TESTS.md](EQUIPMENT_NOTIFICATION_MANUAL_TESTS.md) (TC-EQUIPNOTE-001–006)

### Safety checks

#### SPM-258: Safety Officer role

**Scenario in one line**

A Safety Officer signs in and lands in `/staff/safety`; other roles are refused there, and they are refused elsewhere.

**Who, where, when**

- **Who:** Safety Officer, and every other staff role.
- **Where:** `/staff/safety` and the access-denied screen.
- **Flow stage:** Signing in.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_OFFICER_MANUAL_TESTS.md](SAFETY_OFFICER_MANUAL_TESTS.md) (TC-SAFETY-001–006)

#### SPM-259: See events awaiting a safety check

**Scenario in one line**

A Safety Officer opens the workspace and sees each qualifying event with its date, attendance and venues.

**Who, where, when**

- **Who:** Safety Officer.
- **Where:** `/staff/safety`.
- **Flow stage:** Events are ready for a check.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- Load the seven-event fixture: run the SQL block in the doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_CHECK_LIST_MANUAL_TESTS.md](SAFETY_CHECK_LIST_MANUAL_TESTS.md) (TC-SAFETYLIST-001–004)

#### SPM-319: Admit events with only non-essential gaps to the safety check

**Scenario in one line**

A Safety Officer opens Awaiting check. Events whose essential lines are fully reserved are listed.

**Who, where, when**

- **Who:** Safety Officer.
- **Where:** `/staff/safety` (Awaiting check).
- **Flow stage:** The event is Planning with its bookings Confirmed.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-venues/seed.sql --local
supabase db query --file scripts/seed-safety-check/seed.sql --local
supabase db query --file scripts/seed-safety-check/verify.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_CHECK_ESSENTIAL_MANUAL_TESTS.md](SAFETY_CHECK_ESSENTIAL_MANUAL_TESTS.md) (TC-SAFEESS-001–004)

#### SPM-260: Conduct an operational safety check

**Scenario in one line**

A Safety Officer opens an event from Awaiting check and records the outcome; the event leaves the list.

**Who, where, when**

- **Who:** Safety Officer.
- **Where:** `/staff/safety/<event>`.
- **Flow stage:** An event is awaiting a check.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

- Load the four-event fixture: run the SQL block in the doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_CHECK_MANUAL_TESTS.md](SAFETY_CHECK_MANUAL_TESTS.md) (TC-SAFETYCHECK-001–007)

#### SPM-262: Notify the Safety Officer of an event ready for check

**Scenario in one line**

Venue Staff approve the last waiting booking; every Safety Officer gets a notice naming the event, which opens the list.

**Who, where, when**

- **Who:** Venue Staff, Event Coordinator, Safety Officers.
- **Where:** The Safety Officer's notification bell.
- **Flow stage:** The last blocker for an event is cleared.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
pnpm novu:clear
```

- Load the three-event fixture: run the SQL block in the doc's Setup. Start the app with `NOVU_BRIDGE_URL` set.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `venue@test.com`, `coordinator@test.com`, `safety@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_CHECK_NOTIFICATION_MANUAL_TESTS.md](SAFETY_CHECK_NOTIFICATION_MANUAL_TESTS.md) (TC-SAFETYNOTE-001–004)

#### SPM-263: Notify the coordinator of the safety outcome

**Scenario in one line**

A Safety Officer rejects an event with comments; the Coordinator gets a notice with the comments in full, which opens the event.

**Who, where, when**

- **Who:** Safety Officer, then the assigned Event Coordinator.
- **Where:** The Coordinator's notification bell.
- **Flow stage:** An outcome is recorded.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
pnpm novu:clear
```

- Load the events fixture: run the SQL block in the doc's Setup. Start the app with `NOVU_BRIDGE_URL` set (the last case needs it).

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md](SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md) (TC-SAFETYOUTCOME-001–007)

#### SPM-261: Return an event after a safety outcome

**Scenario in one line**

A Safety Officer rejects an event. The Coordinator sees what must change, reworks it and resubmits; it is back on Awaiting check.

**Who, where, when**

- **Who:** Safety Officer and assigned Event Coordinator (and Venue Staff for bookings).
- **Where:** The event's **Safety** tab and `/staff/safety`.
- **Flow stage:** An event was rejected.

> **Note:** To run the cases again, reset and reload.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
pnpm novu:clear
```

- Load the same events as [SAFETY_OUTCOME_NOTIFICATION](SAFETY_OUTCOME_NOTIFICATION_MANUAL_TESTS.md): run the SQL block in that doc's Setup.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `safety@test.com`, `coordinator@test.com`, password `TestPass123!`.

**Cases:** [SAFETY_RETURN_MANUAL_TESTS.md](SAFETY_RETURN_MANUAL_TESTS.md) (TC-SAFETYRETURN-001–008)

### Sign-in and access

#### SPM-13, SPM-14: Login and logout

**Scenario in one line**

A user signs in, is sent to their own workspace, and signs out. Wrong passwords and unknown emails get a refusal.

**Who, where, when**

- **Who:** Any seeded staff account.
- **Where:** `/auth/login` and the sign-out control.
- **Flow stage:** At the start and end of any session.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `organiser@test.com`, password `TestPass123!`.

**Cases:** [AUTH_MANUAL_TESTS.md](AUTH_MANUAL_TESTS.md) (TC-LOGIN-001–TC-LOGOUT-005)

#### No ticket: Staff role guards

**Scenario in one line**

A user opens each workspace; signed out they are sent to login; public attendee pages stay open.

**Who, where, when**

- **Who:** Every staff role, and signed-out visitors.
- **Where:** `/staff/*` and the public `/events`.
- **Flow stage:** Any time a page is opened.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as `lead@test.com`, `venue@test.com`, password `TestPass123!`.

**Cases:** [STAFF_ROLE_GUARDS_MANUAL_TESTS.md](STAFF_ROLE_GUARDS_MANUAL_TESTS.md) (TC-GUARD-001–005)

#### SPM-16, SPM-188, SPM-192: Access-denied screen

**Scenario in one line**

A signed-in user opens a staff page their role does not own. They get the shared access-denied screen (HTTP 403) with a link home, and it works at phone width.

**Who, where, when**

- **Who:** Any staff role opening another role's page (Organiser, Event Coordinator, Event Coordinator Lead, Venue Staff, Technical Support Staff).
- **Where:** Any `/staff/*` page, signed in as the wrong role.
- **Flow stage:** Any time, when a role opens an address that is not theirs.

**Start from a clean database** (this drops all local data):

```bash
supabase db reset
supabase db query --file scripts/seed-coordinator-view/seed.sql --local
```

- Two lookups in the doc's Setup (an unassigned request and an event of another coordinator) give the ids the cases use.

**Run the app:** `pnpm dev:local`, sign in at <http://localhost:3000/auth/login> as any staff account (see the doc's account table), password `TestPass123!`.

**Cases:** [ACCESS_DENIED_MANUAL_TESTS.md](ACCESS_DENIED_MANUAL_TESTS.md) (TC-DENY-001–010)
