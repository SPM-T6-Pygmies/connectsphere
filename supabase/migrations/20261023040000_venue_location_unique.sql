-- Two venues cannot share a location, compared without regard to case or extra spaces
-- ("Main Hall", " main  hall " and "MAIN HALL" are the same place). Creating a venue, or renaming
-- one onto another's location, is refused by this index; the app maps it to a message on the
-- Location field.
--
-- Fails if the catalogue already holds two venues with the same location: rename or remove one
-- first.

create unique index venue_location_unique_idx
  on public.venue (lower(regexp_replace(btrim(location), '\s+', ' ', 'g')));
