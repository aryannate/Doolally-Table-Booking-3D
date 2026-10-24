-- ════════════════════════════════════════════════════════════════════════════
-- Doolally Taproom · table booking schema (Supabase / Postgres 15+)
--
-- Double bookings are impossible at the database level: an exclusion constraint
-- forbids two active rows (held or confirmed) for the same table whose time
-- ranges overlap. All guest-facing writes go through SECURITY DEFINER functions;
-- the tables themselves are closed to anon by RLS.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;

-- ── tables ──────────────────────────────────────────────────────────────────
create table if not exists public.restaurant_tables (
  id          text primary key,
  zone        text not null,
  capacity    int  not null check (capacity > 0),
  min_guests  int  not null default 1,
  plan_x      numeric not null,   -- floor-plan pixel coordinates (see src/data/layout.ts)
  plan_y      numeric not null,
  rotation    numeric not null default 0,
  bookable    boolean not null default true
);

create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique,
  table_id     text not null references public.restaurant_tables(id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  guests       int not null check (guests > 0),
  status       text not null check (status in ('held','confirmed','cancelled')),
  session_id   text,
  expires_at   timestamptz,
  guest_name   text,
  guest_phone  text,
  guest_email  text,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  -- ★ the double-booking guard
  constraint no_overlap exclude using gist (
    table_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('held','confirmed'))
);
create index if not exists reservations_day_idx on public.reservations (starts_at);

create table if not exists public.table_blocks (
  table_id   text references public.restaurant_tables(id) on delete cascade,
  block_date date not null,
  primary key (table_id, block_date)
);

create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

alter table public.restaurant_tables enable row level security;
alter table public.reservations      enable row level security;
alter table public.table_blocks      enable row level security;
alter table public.admins            enable row level security;
create policy "tables are public" on public.restaurant_tables for select using (true);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ── settings ────────────────────────────────────────────────────────────────
-- Keep in sync with src/config/venue.ts
create or replace function public.venue_tz()       returns text     language sql immutable as $$ select 'Asia/Kolkata' $$;
create or replace function public.booking_length() returns interval language sql immutable as $$ select interval '120 minutes' $$;
create or replace function public.hold_length()    returns interval language sql immutable as $$ select interval '5 minutes' $$;

-- ── guest-facing functions ──────────────────────────────────────────────────
-- Active rows for one venue-local day. No contact details; other guests' session ids are hidden.
create or replace function public.day_availability(p_date date, p_session text default null)
returns table (id uuid, ref text, table_id text, starts_at timestamptz, ends_at timestamptz, guests int,
               status text, session_id text, expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, null::text, r.table_id, r.starts_at, r.ends_at, r.guests, r.status,
         case when r.session_id = p_session then r.session_id end, r.expires_at, r.created_at
  from reservations r
  where r.starts_at <  ((p_date + 1)::timestamp at time zone venue_tz())
    and r.ends_at   >  (p_date::timestamp at time zone venue_tz())
    and (r.status = 'confirmed' or (r.status = 'held' and r.expires_at > now()));
$$;

create or replace function public.day_blocks(p_date date)
returns table (table_id text, block_date date)
language sql stable security definer set search_path = public as $$
  select table_id, block_date from table_blocks where block_date = p_date;
$$;

create or replace function public.hold_table(p_table text, p_date date, p_time time, p_guests int, p_session text)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  t  restaurant_tables;
  s  timestamptz := (p_date + p_time) at time zone venue_tz();
  r  reservations;
begin
  select * into t from restaurant_tables where id = p_table and bookable;
  if not found then raise exception 'Unknown table' using errcode = '22023'; end if;
  if p_guests < t.min_guests or p_guests > t.capacity then
    raise exception 'This table seats % to %', t.min_guests, t.capacity using errcode = '22023';
  end if;
  if s < now() then raise exception 'That time has already passed' using errcode = '22023'; end if;
  if exists (select 1 from table_blocks where table_id = p_table and block_date = p_date) then
    raise exception 'Table taken: unavailable that day' using errcode = '23P01';
  end if;

  -- clear stale holds so they never block anyone, and drop this guest's previous hold
  delete from reservations where status = 'held' and (expires_at <= now() or session_id = p_session);

  -- the exclusion constraint makes this insert the atomic check: overlapping → SQLSTATE 23P01
  insert into reservations (table_id, starts_at, ends_at, guests, status, session_id, expires_at)
  values (p_table, s, s + booking_length(), p_guests, 'held', p_session, now() + hold_length())
  returning * into r;
  return r;
end $$;

create or replace function public.release_hold(p_hold uuid, p_session text)
returns void language sql security definer set search_path = public as $$
  delete from reservations where id = p_hold and session_id = p_session and status = 'held';
$$;

create or replace function public.confirm_reservation(p_hold uuid, p_session text, p_name text, p_phone text, p_email text default null)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare r reservations;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
    raise exception 'Name and phone are required' using errcode = '22023';
  end if;
  update reservations
     set status = 'confirmed', expires_at = null,
         ref = 'DLY-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)),
         guest_name = trim(p_name), guest_phone = trim(p_phone), guest_email = nullif(trim(p_email), '')
   where id = p_hold and session_id = p_session and status = 'held' and expires_at > now()
  returning * into r;
  if not found then raise exception 'Your hold expired or was released' using errcode = 'P0001'; end if;
  return r;
end $$;

-- ── admin functions (require a row in public.admins for the signed-in user) ──
create or replace function public.admin_day_reservations(p_date date)
returns setof public.reservations
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  return query select * from reservations
   where starts_at < ((p_date + 1)::timestamp at time zone venue_tz())
     and ends_at   > (p_date::timestamp at time zone venue_tz())
     and status <> 'cancelled'
   order by starts_at, table_id;
end $$;

create or replace function public.admin_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  update reservations set status = 'cancelled' where id = p_id;
end $$;

create or replace function public.admin_set_block(p_table text, p_date date, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_blocked then insert into table_blocks values (p_table, p_date) on conflict do nothing;
  else delete from table_blocks where table_id = p_table and block_date = p_date; end if;
end $$;

grant execute on function public.day_availability, public.day_blocks, public.hold_table,
  public.release_hold, public.confirm_reservation to anon, authenticated;
grant execute on function public.admin_day_reservations, public.admin_cancel, public.admin_set_block to authenticated;

-- Optional housekeeping with pg_cron:
-- select cron.schedule('purge-expired-holds', '*/10 * * * *',
--   $$delete from public.reservations where status = 'held' and expires_at < now() - interval '1 hour'$$);
