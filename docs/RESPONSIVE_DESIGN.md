# Responsive Design

How ConnectSphere's screens behave below `md`, and the rules to follow when
adding new ones.

## Why

The customer brief requires the system to be **desktop- and mobile-friendly**:
external Event Organisers work from personal devices, and internal staff use it
*while preparing event spaces or equipment* (brief §7). Every user group must
manage without training (§8c). Offline access was asked for and declined, so
the mobile experience assumes connectivity.

Both are Release 1 requirements. Mobile is not a later pass.

## The breakpoint

One breakpoint: Tailwind's stock `md` (768px), which is also
`MOBILE_BREAKPOINT` in `src/hooks/use-mobile.ts`. Below it, phone. At or above
it, the desktop two-pane layout. No custom breakpoints; `sm:` and `lg:` remain
free for content-level reflow inside a screen.

## The staff shell

Desktop is a three-zone layout: a 3rem icon rail, a 20rem list pane of whatever
the role is working through, and the detail beside it. Below `md` each zone
takes a different form, modelled on Linear's mobile app.

| Desktop zone | Below `md` | Where |
|---|---|---|
| Icon rail | Floating bottom bar — the role's queue destinations, notifications dot, and a button that opens the drawer | `src/components/staff-bottom-nav.tsx` |
| Rail, in full | The drawer: the *same* rail at full sheet width, labels showing | `src/components/app-sidebar.tsx` |
| List pane | The page body | `src/components/mobile-queue.tsx` |
| Detail area | Full screen; the header's pane toggle becomes a back arrow | `src/app/staff/staff-shell.tsx` |

One rail definition feeds all three surfaces: `src/components/staff-nav.ts`
(`RAIL`, `railItems`, `currentSection`, `isRailDestination`, `resolveQueue`).
Add a destination there and it appears on the rail, in the drawer and on the
bottom bar at once.

One row markup feeds both list surfaces: `src/components/queue-list.tsx`, over
the `ListPaneItem` shape every role's queue already produces.

### Rules

- **Gate visibility with CSS, not `useIsMobile()`.** Use `md:hidden` /
  `hidden md:block`. `useIsMobile` is a `useSyncExternalStore` whose server
  snapshot is `false`, so anything gated on it is missing from the SSR HTML and
  pops in after hydration. `usePathname()` *is* stable during SSR and is fine
  to branch on — that is how `MobileQueue` decides whether a route has a list.
- **`QueueEmptyState` is desktop-only.** "Items are in the pane, nothing open
  yet" is a two-pane idea. On one screen the queue *is* the page, so the
  component hides itself below `md`; it needs no per-page handling.
- **A queue screen shows its queue once.** If a page renders its own table of
  the same records the pane shows, wrap that table in `hidden md:block` — the
  five queue/inbox screens already do.
- **`StaffBottomNav` must stay outside `AppSidebar`.** Below `md` that
  component's root *is* the drawer sheet, so a bar rendered inside it would
  only exist while the drawer was open. It does have to stay inside
  `SidebarProvider`, which owns `setOpenMobile`.
- **The bar is fixed, so content pads past it.** `--staff-bottom-nav-height`
  (`src/app/globals.css`, in `:root` — a layout constant, not a design token,
  so not in `@theme inline`) plus `env(safe-area-inset-bottom)`, which only
  resolves because `src/app/layout.tsx` exports
  `viewport: { viewportFit: "cover" }`.
- **Back links beat `router.back()`.** Detail screens arrive from notification
  emails and refreshed tabs, where there is no history entry. `StaffShell`
  derives the target from `crumbs` — `detailCrumbs()` puts an `href` on the
  first of two crumbs — so a record opened from the inbox returns to the inbox.

## Tables

Wide tables are the main content-level hazard: several screens carry 4–6
columns, and `src/components/ui/table.tsx` defaults cells to `whitespace-nowrap`
inside an `overflow-x-auto` wrapper, so the fallback is sideways scrolling.

**The direction is card-per-row below `md`**, matching `QueueList`, rather than
column hiding or horizontal scroll — a phone user should not have to scroll
sideways to read a status (§8c).

For a queue this is free: render `QueueList` and hide the table. For the
remaining tables it is per-screen work, because each needs its own per-column
labels and its own idea of which fields matter:

- `src/app/staff/coordinator/[id]/tabs.tsx` — candidate venues (6 cols),
  equipment reservations (5), arrangements (4), registrations (4)
- `src/app/staff/technical/reservation-detail.tsx` — equipment lines (6), with
  a per-row `<Input className="h-7 w-20">`
- `src/app/staff/requester/organisation/page.tsx` — organisation events (5),
  with a per-row `<form>` and `<select className="w-40">`

A shared `ResponsiveTable` wrapper is **not** the answer for these: the
per-column metadata it would need means editing every call site anyway, so it
would add an abstraction without removing the work (CLAUDE.md §2).

`SidebarInset` carries `min-w-0` so that a table that does scroll scrolls
inside its own container rather than widening the document. Keep it.

## Known gaps

- **Detail-screen action ordering.** Detail screens are
  `grid gap-6 lg:grid-cols-3` with the action rail second, so below `lg` the
  Decision / Assign-coordinator card sits beneath a long field list. The fix is
  `order-first lg:order-none` on the rail, applied only where it holds an
  action. Note that `order-*` moves the *visual* order only — DOM and tab order
  still follow source, so a JSX move is the fuller fix if it ever matters.
- **Search.** The list pane's `SidebarInput` is not wired to anything, so the
  mobile queue deliberately omits it rather than shipping a dead control to a
  new surface.
- **The requester's mobile queue shows Drafts only**, since `/staff/requester`
  resolves to the `drafts` section while the desktop page has Drafts/Submitted/
  All tabs. Submitted is its own bottom-bar destination, so nothing is
  unreachable.
- **No automated coverage.** `vitest.config.mts` is `environment: "node"` with
  `include: ["src/**/*.test.ts"]` — no DOM, no component tests, no Playwright
  and no visual-regression baseline. Responsive changes are verified by eye at
  390×844 and 768px; `pnpm build` is what catches a server/client boundary
  mistake.
