create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_name text not null,
  abn text not null default '',
  address text not null default '',
  bank_name text not null default '',
  bsb text not null default '',
  account_number text not null default '',
  client_name text not null default '',
  client_address text not null default '',
  standard_hourly_rate numeric(10,2) not null default 35,
  daily_regular_limit_hours numeric(10,2) not null default 9,
  overtime_multiplier numeric(10,2) not null default 1.5,
  declared_weekly_limit_hours numeric(10,2) not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  location text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_entries_user_date_idx
  on public.work_entries (user_id, date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

drop trigger if exists work_entries_set_updated_at on public.work_entries;
create trigger work_entries_set_updated_at
before update on public.work_entries
for each row
execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.work_entries enable row level security;

drop policy if exists "Users can read own settings" on public.app_settings;
create policy "Users can read own settings"
on public.app_settings
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.app_settings;
create policy "Users can insert own settings"
on public.app_settings
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.app_settings;
create policy "Users can update own settings"
on public.app_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own entries" on public.work_entries;
create policy "Users can read own entries"
on public.work_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own entries" on public.work_entries;
create policy "Users can insert own entries"
on public.work_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own entries" on public.work_entries;
create policy "Users can update own entries"
on public.work_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own entries" on public.work_entries;
create policy "Users can delete own entries"
on public.work_entries
for delete
using (auth.uid() = user_id);
