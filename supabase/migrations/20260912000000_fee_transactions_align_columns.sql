-- Align fee_transactions with the columns the payment routes actually read and write.
--
-- The table in production was created by hand before
-- 20260910000001_fee_transactions.sql landed, with a different shape: one
-- getepay_transaction_id column and an updated_at, and no merchant_transaction_id.
-- Because that earlier migration is `create table if not exists`, re-running it
-- was a no-op against the hand-made table, so the columns never appeared and:
--
--   * /api/getepay/initiate failed its insert with 42703 (column
--     merchant_transaction_id does not exist) and answered every installment
--     payment with "Could not start installment payment";
--   * /api/payment/process would have failed the same way on getepay_txn_id /
--     completed_at, silently abandoning settlement of an installment payment.
--
-- The two ids are deliberately separate: merchant_transaction_id is ours (sent as
-- udf4 and echoed back in the callback to find this row), getepay_txn_id is the
-- gateway's. The legacy getepay_transaction_id column is left in place -- it is
-- unused by the code but dropping it would discard any hand-recorded history.

alter table public.fee_transactions
  add column if not exists merchant_transaction_id text,
  add column if not exists getepay_txn_id text,
  add column if not exists completed_at timestamptz,
  add column if not exists installment_ids uuid[];

-- Any row written against the old shape kept our reference in getepay_transaction_id.
update public.fee_transactions
   set merchant_transaction_id = getepay_transaction_id
 where merchant_transaction_id is null
   and getepay_transaction_id is not null;

-- The callback looks this row up by merchant_transaction_id, so it has to be unique.
create unique index if not exists fee_transactions_merchant_transaction_id_key
  on public.fee_transactions (merchant_transaction_id);

-- Only enforce NOT NULL once nothing violates it, so a legacy row without a
-- reference can't make this migration unrunnable.
do $$
begin
  if not exists (
    select 1 from public.fee_transactions where merchant_transaction_id is null
  ) then
    alter table public.fee_transactions
      alter column merchant_transaction_id set not null;
  end if;
end
$$;

create index if not exists fee_transactions_invoice_id_idx
  on public.fee_transactions (invoice_id);

-- Only the service-role payment routes touch this table.
alter table public.fee_transactions enable row level security;
