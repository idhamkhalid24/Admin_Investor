-- ============================================================
-- INVESTOR TRACKER ROCKY HIJAB - SQL SCHEMA
-- Jalankan di project Supabase yang SAMA dengan aplikasi_admin_only
-- (project: ismjupxoiywttkrekmfg) supaya bisa baca tabel `produk`
-- dan `transactions` yang sudah ada.
-- ============================================================

-- 1) Tambah kolom investor ke tabel produk yang SUDAH ADA
--    (aman, tidak mengganggu kasir yang cuma select nama_produk)
alter table produk add column if not exists is_investor boolean not null default false;
alter table produk add column if not exists investor_batch_id uuid;
alter table produk add column if not exists modal numeric;
alter table produk add column if not exists harga_jual numeric;
alter table produk add column if not exists persentase_keuntungan_investor numeric not null default 30;

-- 2) Tabel investor
create table if not exists investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  pin text not null,               -- PIN login sederhana untuk panel investor
  created_at timestamptz not null default now()
);

-- 3) Tabel batch investasi
create table if not exists investment_batches (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references investors(id) on delete cascade,
  batch_name text not null,
  amount_invested numeric not null default 0,
  status text not null default 'active', -- 'active' | 'closed'
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

-- fk dari produk.investor_batch_id -> investment_batches.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'produk_investor_batch_fk'
    ) THEN
        ALTER TABLE produk
        ADD CONSTRAINT produk_investor_batch_fk
        FOREIGN KEY (investor_batch_id) REFERENCES investment_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4) Histori pencairan bagi hasil
create table if not exists profit_distributions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references investment_batches(id) on delete cascade,
  period text not null,             -- misal '2026-08'
  gross_revenue numeric not null default 0,
  total_modal numeric not null default 0,
  net_profit numeric not null default 0,
  owner_share_amount numeric not null default 0,
  investor_share_amount numeric not null default 0,
  paid_to_investor boolean not null default false,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  created_by text
);

-- 5) Row Level Security
alter table investors enable row level security;
alter table investment_batches enable row level security;
alter table profit_distributions enable row level security;

-- Kebijakan sederhana: akses via anon key tapi dibatasi lewat app logic (PIN admin/investor).
-- Kalau mau lebih ketat, bisa disesuaikan pakai Supabase Auth per investor nanti.
drop policy if exists "allow all anon" on investors;
create policy "allow all anon" on investors for all using (true) with check (true);

drop policy if exists "allow all anon" on investment_batches;
create policy "allow all anon" on investment_batches for all using (true) with check (true);

drop policy if exists "allow all anon" on profit_distributions;
create policy "allow all anon" on profit_distributions for all using (true) with check (true);

-- index bantu
create index if not exists idx_produk_investor on produk(is_investor);
create index if not exists idx_batch_investor on investment_batches(investor_id);
create index if not exists idx_dist_batch on profit_distributions(batch_id);
