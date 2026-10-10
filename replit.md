# ScullBook

ScullBook lets rowing club members reserve a specific scull seat and lets administrators configure boats, schedule rowing dates, and view crew rosters.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/scullbook run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/scullbook/src/` — React pages, authentication dialogs, graphical seat picker, and styles
- `artifacts/api-server/src/routes/` — account, boat, launch, and reservation endpoints
- `artifacts/api-server/src/lib/` — secure authentication, rowing rules, and initial example data
- `lib/db/src/schema/` — PostgreSQL schema
- `lib/api-spec/openapi.yaml` — API contract; regenerate clients after changes

## Architecture decisions

- Local email/password accounts are intentional: the requested administrator must sign in using the literal ID `admin`, and the spec requires locally registered rower accounts.
- Passwords are hashed with salted scrypt despite the source spec allowing plaintext. Never return password hashes or readable passwords through the API.
- Calendar dates remain `YYYY-MM-DD` strings throughout the system. Upcoming-date boundaries use America/Los_Angeles until the club requests a configurable timezone.
- Unique reservation constraints and transaction locks prevent conflicting seat bookings.
- Initial data is added only when the administrator account does not exist. Restarting must never reset an existing password or reseed deleted fleet data.

## Product

- Splash page, registration/login dialogs, rower dashboard, boat seat selection and confirmation, and reservation cancellation.
- Administrator overview, fleet configuration, date/boat scheduling, upcoming crew rosters, and password changes.
- Boats can be offered in either or both four-hour shifts: 8am–12pm and 1pm–5pm. A rower can reserve one boat per date/shift, including both shifts on the same day.
- Admin Overview has a weekly booked/available seat chart, summing all boats and both shifts by date. Selecting a day filters Next on the water; reset restores all upcoming outings.
- Admins can open an Overview outing's graphical crew map, cancel one occupied seat, or swap two occupied seats within that same outing. Both changes require confirmation and preserve unrelated bookings.
- Seat occupants' names are visible to every signed-in user, including the rower's own name and crew on full boats. Never expose account emails or authentication data in crew views.
- Both roles can log out; 15-minute idle expiry runs in the browser and on the server, with input-driven session renewal.
- Four boat types: Single (1), Double (2), Quadruple (4), and Octuple (9 occupants including a coxswain).
- Octuple position 1 is the stern Coxswain facing forward. Position 2 is Stroke (the source spec also calls it Stoke/Stoker); the other rowers face backward.

## User preferences

Follow the supplied ScullBook specification. Include sample boats and registered rowers. Initial administrator ID is `admin`; administrators must be able to change their password. Do not expand the product beyond the requested reservation workflows without approval.

## Gotchas

- Seeded accounts and the initial administrator password are for setup/demo use; change the administrator password before real club use.
- Scheduled boats cannot change type until their sessions are removed. Booked sessions cannot be removed until their rowers cancel.
- Before starting the shift-aware API against an older database, apply `lib/db/migrations/20261009_launch_shifts.sql` (or push the matching schema). It preserves old outings/bookings as 8am; existing overlaps are flagged, never silently cancelled.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
