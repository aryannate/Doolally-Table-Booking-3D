# Doolally Taproom — 3D table booking

A miniature, open-roof 3D model of the taproom where guests pick an exact table and reserve it.
React + TypeScript + React Three Fiber + Tailwind, with a swappable reservation backend
(in-browser demo data by default, Supabase for live availability).

```bash
npm install
npm run dev            # http://localhost:5173  (staff view: /#/admin, demo PIN 2580)
npm run build          # production build in dist/ (3D scene is code-split and lazy-loaded)
npm run build:single   # one self-contained HTML file in dist-single/
```

Useful URL flags: `?mode=2d` forces the 2D floor-plan fallback, `?lowq` forces low-quality rendering.

## How it's put together

| Path | What it does |
|---|---|
| `src/data/layout.ts` | The floor plan. Every table, chair, wall and fitting is placed in **pixel coordinates of the supplied plan** (`Floorplan.jpeg`) and converted to metres, so it can be checked against the drawing. Table IDs, zones, capacities and minimum party sizes live here. |
| `src/scene/Furniture.tsx` | All furniture as ~10 instanced meshes. Per-instance colours carry the wood tones plus selection (blue), booked (red), held (amber) and faded states, animated on change. Invisible padded hit-boxes give generous touch targets. |
| `src/scene/CameraRig.tsx` | Overview framing, ~560 ms ease-in-out pan/zoom to a table, rotate/zoom/pan/top-view/reset, keyboard control. `setViewOffset` re-centres the projection into whatever the UI leaves uncovered, so a selected table is never under the card or bottom sheet. Portrait screens auto-rotate the model to fill the height. |
| `src/scene/Architecture.tsx` | Floors, walls (exterior walls drop to a stub when they face the camera), the whitewashed brick tap wall with the backlit logo, chalkboards, street. Textures are generated on a canvas at load — nothing to download. |
| `src/lib/availability.ts` | Pure status logic: blocked → past → booked → held → doesn't fit party → available. |
| `src/lib/time.ts` | All times in **Asia/Kolkata** regardless of the guest's device timezone. |
| `src/config/venue.ts` | Opening slots, 2-hour sittings, 5-minute holds, booking window, max party size. |
| `src/state/store.ts` | Zustand store: query, selection, hold → confirm flow, camera commands. |
| `src/services/` | `ReservationRepo` interface + `MockRepo` (demo) + `SupabaseRepo` (live, plain REST, no SDK). |
| `src/admin/Admin.tsx` | Staff page at `#/admin`: day list with cancel, and per-date on/off for every table. |
| `supabase/schema.sql` | Tables, RLS, guest/admin RPCs, and the exclusion constraint that makes overlapping bookings impossible. |

## Booking flow and double-booking protection

1. Guest taps **Reserve Table** → `hold_table` inserts a `held` row that expires in 5 minutes.
2. Guest enters name + phone (email optional) → `confirm_reservation` flips the hold to `confirmed` and issues a `DLY-XXXXXX` reference.
3. In Postgres an `EXCLUDE USING gist (table_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE status IN ('held','confirmed')` constraint rejects any overlapping row, so two guests can never both get the same table — even under concurrent requests. The mock backend mirrors this check and shares state across browser tabs, so you can try it with two tabs.

## Going live with Supabase

1. Run `supabase/schema.sql`, then `npm run seed:sql > supabase/seed.sql` and run that (it writes `restaurant_tables` from the floor-plan data).
2. Create staff users in Supabase Auth and add their ids to `public.admins`.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Nothing else in the app changes; the admin page switches from the demo PIN to Supabase sign-in.

## Performance notes

- `frameloop="demand"`: no rendering while idle; animations invalidate only while moving.
- Shared box/cylinder/sphere geometry, instanced per material class (~10 draw calls for ~2,500 parts).
- One directional shadow rendered once (furniture is static), pixel ratio capped at 1.6 on touch devices, shadows off on low-end phones.
- Initial JS ~66 kB gzipped; the 3D chunk (~233 kB gzipped) loads lazily. Without WebGL the same data renders as an interactive SVG plan.

## Adapting the layout

Edit the coordinates in `src/data/layout.ts` (plan pixels). If tables change, re-run `npm run seed:sql` and update the database rows.
