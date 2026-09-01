-- Schema the Supabase driven adapters in src/adapters/outbound/supabase expect.
--
-- Note that the domain invariants are asserted here as well as in
-- src/core/domain/connection.ts. That is not duplication to be removed: the
-- domain enforces the rule for this application, the database enforces it for
-- every writer, including a future service and a hand-typed SQL statement.

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists connections (
  id uuid primary key,
  requester_id uuid not null references members (id) on delete cascade,
  addressee_id uuid not null references members (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null,

  -- Mirrors SelfConnectionError.
  constraint no_self_connection check (requester_id <> addressee_id)
);

-- Mirrors blocksNewRequest: at most one live connection per pair, in either
-- direction. Declined rows are excluded so members can try again.
create unique index if not exists connections_unique_live_pair
  on connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted');
