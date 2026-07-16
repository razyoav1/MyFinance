-- MyFinance Cloud Sync schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- One row per user holding the full app snapshot; RLS ensures each user can
-- only ever see and write their own row.

create table if not exists cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table cloud_snapshots enable row level security;

drop policy if exists "users_own_snapshot" on cloud_snapshots;
create policy "users_own_snapshot" on cloud_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
