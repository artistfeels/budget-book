create table transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  time time not null,
  type text not null check (type in ('수입','지출','이체')),
  category text not null,
  subcategory text not null,
  content text not null,
  amount integer not null,
  currency text not null default 'KRW',
  payment_method text not null,
  memo text,
  flow_type text not null check (flow_type in ('income','saving','spending','neutral')),
  flow_type_override text check (flow_type_override in ('saving','spending')),
  transfer_pair_id text,
  is_paired_transfer boolean not null default false,
  is_unmatched_transfer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on transactions (user_id, date);
alter table transactions enable row level security;
create policy "own rows" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table classification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  match_type text not null check (match_type in ('content','payment_method')),
  match_value text not null,
  flow_type text not null check (flow_type in ('saving','spending')),
  created_at timestamptz not null default now()
);
alter table classification_rules enable row level security;
create policy "own rows" on classification_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();
