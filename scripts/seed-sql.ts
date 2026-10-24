// Prints INSERTs for public.restaurant_tables straight from the floor-plan data.
// Run: npm run seed:sql > supabase/seed.sql
import { TABLES } from '../src/data/layout'
const rows = TABLES.map((t) => `  ('${t.id}', '${t.zone}', ${t.capacity}, ${t.minGuests}, ${t.plan.x}, ${t.plan.y}, ${t.rotation.toFixed(4)}, true)`)
console.log(`-- generated from src/data/layout.ts\ninsert into public.restaurant_tables (id, zone, capacity, min_guests, plan_x, plan_y, rotation, bookable) values\n${rows.join(',\n')}\non conflict (id) do update set zone = excluded.zone, capacity = excluded.capacity, min_guests = excluded.min_guests,\n  plan_x = excluded.plan_x, plan_y = excluded.plan_y, rotation = excluded.rotation;`)
