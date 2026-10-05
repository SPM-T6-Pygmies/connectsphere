-- Undoes the equipment seed (seed.sql in this directory): deletes the
-- Founders' Gala Dinner event it opened -- its reservation and lines go with
-- it, by cascade -- and then the seeded catalogue items, unless some other
-- event's line still uses one. The Approved request itself belongs to
-- seed-coordinator-view and is left alone.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment/teardown.sql --local
--
-- A `do` block rather than one CTE, unlike seed-coordinator-view's teardown:
-- equipment_item is `on delete restrict`, so the catalogue can only go once
-- the lines using it are gone, and a CTE's deletes run in no fixed order.

do $$
declare
  v_events bigint;
  v_items  bigint;
begin
  delete from public.event e
  using public.event_request r
  where r.event_request_id = e.event_request_id
    and r.event_name = 'Founders'' Gala Dinner';
  get diagnostics v_events = row_count;

  delete from public.equipment_item i
  where i.type in ('Projector', 'Wireless microphone', 'PA speaker',
                   'Presentation laptop', 'Livestream kit')
    and not exists (
      select 1 from public.equipment_reservation_line x
      where x.equipment_item_id = i.equipment_item_id
    );
  get diagnostics v_items = row_count;

  raise notice 'events removed: %, catalogue items removed: %', v_events, v_items;
end;
$$;
