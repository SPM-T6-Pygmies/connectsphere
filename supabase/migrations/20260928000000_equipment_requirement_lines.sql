-- SPM-183 (SPM-41): what an event's assigned Event Coordinator records about
-- its equipment, and what Technical Support Staff then have to re-check.
--
-- No new table. `equipment_reservation` / `equipment_reservation_line` already
-- model "the coordinator records, TSS reviews and reserves" (#19, #90): a line
-- is a catalogue item plus `quantity_requested`. This adds what SPM-41 needs on
-- top of that:
--
--   technical_requirements  Optional notes for Technical Support, at most 500
--                           characters (AC5). Restated here, not only in the
--                           domain, so a hand-made RPC call cannot store what
--                           the application refuses.
--   recheck_required_at     Set when a line Technical Support already reserved
--                           against is changed or its removal is requested
--                           (AC8, AC11). A time rather than a flag, so the
--                           "Needs re-check" list (AC15) can say when.
--   removal_requested_at    Set when the coordinator removes a reserved line
--                           (AC11) and cleared if they undo it (AC17). The line
--                           and its equipment stay until Technical Support
--                           release them (SPM-108).
--
-- Drops equipment_reservation_line_quantity_chk (quantity_reserved <=
-- quantity_requested). AC8 lets a coordinator cut a reserved line below what is
-- reserved: the edit saves and the equipment stays held until Technical Support
-- release the excess (SPM-108), and the check would reject that save. The
-- column checks quantity_requested > 0 and quantity_reserved >= 0 stay.
--
-- No table grants. Every read and write will go through security definer
-- functions (SPM-185), the way coordinator_decide_event_request and
-- coordinator_confirm_event already reach tables whose grants
-- 20260913190551_remote_schema.sql revoked.

begin;

alter table public.equipment_reservation_line
  add column if not exists technical_requirements text,
  add column if not exists recheck_required_at timestamptz,
  add column if not exists removal_requested_at timestamptz;

alter table public.equipment_reservation_line
  drop constraint if exists equipment_reservation_line_technical_requirements_chk,
  add constraint equipment_reservation_line_technical_requirements_chk
    check (technical_requirements is null or char_length(technical_requirements) <= 500);

alter table public.equipment_reservation_line
  drop constraint if exists equipment_reservation_line_quantity_chk;

commit;
