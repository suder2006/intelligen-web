-- One row per GetePay payment attempt, so the payment callback knows exactly
-- what a transaction was for.
--
-- fee_invoices only holds the latest getepay_transaction_id, which can't say
-- which installments a payment covered. Without that, /api/payment/process
-- marked the whole invoice paid on any successful payment -- including a
-- parent paying just one installment from the app.
--
-- installment_ids is set when the parent paid selected installments; it is
-- null for a full-invoice payment. The callback settles only those installments.
--
-- NOTE: the table did not exist in production before this migration. Re-running
-- this file is safe; the ADD COLUMN covers a table created by hand without it.

create table if not exists public.fee_transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_transaction_id text not null unique,
  -- set null rather than cascade: deleting an invoice shouldn't erase the
  -- record that money was taken for it
  invoice_id uuid references public.fee_invoices(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  amount numeric not null,
  installment_ids uuid[],
  status text not null default 'initiated',
  getepay_txn_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.fee_transactions
  add column if not exists installment_ids uuid[];

create index if not exists fee_transactions_invoice_id_idx
  on public.fee_transactions (invoice_id);

-- RLS on with no policies: only the service-role payment routes
-- (/api/getepay/initiate and /api/payment/process) read or write this table.
alter table public.fee_transactions enable row level security;
