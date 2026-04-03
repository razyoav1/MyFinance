-- categories
create table categories (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text not null default '',
  color text not null default '#6366f1',
  type text not null default 'expense',
  is_system boolean default false,
  created_at timestamptz default now()
);
alter table categories enable row level security;
create policy "users_own_categories" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- transactions
create table transactions (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  type text not null,
  amount numeric not null,
  currency text not null default 'ILS',
  category_id bigint references categories(id) on delete set null,
  description text default '',
  notes text default '',
  tags text[] default '{}',
  is_recurring boolean default false,
  recurring_interval text,
  created_at text,
  updated_at text
);
alter table transactions enable row level security;
create policy "users_own_transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- investment_holdings
create table investment_holdings (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  name text not null,
  asset_type text not null,
  quantity numeric not null,
  purchase_price numeric not null,
  current_price numeric not null,
  currency text not null default 'USD',
  purchase_date text,
  notes text,
  created_at text,
  updated_at text
);
alter table investment_holdings enable row level security;
create policy "users_own_investment_holdings" on investment_holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- investment_price_history
create table investment_price_history (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  holding_id bigint references investment_holdings(id) on delete cascade not null,
  date text not null,
  price numeric not null,
  currency text not null default 'USD'
);
alter table investment_price_history enable row level security;
create policy "users_own_investment_price_history" on investment_price_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mortgages
create table mortgages (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  property_name text,
  original_amount numeric not null,
  annual_rate numeric not null,
  term_months integer not null,
  start_date text not null,
  extra_payment numeric default 0,
  is_active boolean default true,
  currency text not null default 'ILS',
  notes text,
  created_at text,
  updated_at text
);
alter table mortgages enable row level security;
create policy "users_own_mortgages" on mortgages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mortgage_payments
create table mortgage_payments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  mortgage_id bigint references mortgages(id) on delete cascade not null,
  payment_date text not null,
  amount numeric not null,
  principal_portion numeric,
  interest_portion numeric,
  notes text,
  created_at text
);
alter table mortgage_payments enable row level security;
create policy "users_own_mortgage_payments" on mortgage_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- savings_goals
create table savings_goals (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  currency text not null default 'ILS',
  deadline text,
  icon text,
  color text,
  is_completed boolean default false,
  notes text,
  created_at text,
  updated_at text
);
alter table savings_goals enable row level security;
create policy "users_own_savings_goals" on savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- goal_contributions
create table goal_contributions (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id bigint references savings_goals(id) on delete cascade not null,
  date text not null,
  amount numeric not null,
  notes text,
  created_at text
);
alter table goal_contributions enable row level security;
create policy "users_own_goal_contributions" on goal_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- net_worth_snapshots
create table net_worth_snapshots (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  snapshot_date text not null,
  net_worth numeric not null,
  total_assets numeric,
  total_liabilities numeric,
  notes text,
  created_at text
);
alter table net_worth_snapshots enable row level security;
create policy "users_own_net_worth_snapshots" on net_worth_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bank_accounts
create table bank_accounts (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null,
  balance numeric not null default 0,
  currency text not null default 'ILS',
  institution text,
  notes text,
  created_at text,
  updated_at text
);
alter table bank_accounts enable row level security;
create policy "users_own_bank_accounts" on bank_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
