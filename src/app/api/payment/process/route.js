export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Settles an installment payment: marks only the paid installments, adds their
// amount to the invoice, and marks the invoice paid only once every installment is.
async function settleInstallments(supabase, schoolId, invoiceId, txn, getepayTxnId) {
  // Claim the transaction first. The receipt page re-POSTs this callback on refresh,
  // and a second run must not add the same payment to paid_amount again.
  const { data: claimed } = await supabase
    .from('fee_transactions')
    .update({ status: 'success', getepay_txn_id: getepayTxnId, completed_at: new Date().toISOString() })
    .eq('id', txn.id)
    .eq('status', 'initiated')
    .select('id')
  if (!claimed?.length) return

  const { data: invoice } = await supabase
    .from('fee_invoices')
    .select('paid_amount')
    .eq('id', invoiceId)
    .eq('school_id', schoolId)
    .single()
  if (!invoice) return

  const { data: installments } = await supabase
    .from('fee_installments')
    .select('id, amount, status')
    .eq('invoice_id', invoiceId)
  const allInstallments = installments || []

  // Skip any the school already marked paid by hand since the payment started,
  // so they aren't counted into paid_amount twice.
  const selected = new Set(txn.installment_ids)
  const toSettle = allInstallments.filter(i => selected.has(i.id) && i.status !== 'paid')
  const today = new Date().toISOString().split('T')[0]

  for (const inst of toSettle) {
    const { error } = await supabase
      .from('fee_installments')
      .update({ status: 'paid', paid_amount: inst.amount, payment_mode: 'GetePay', payment_date: today })
      .eq('id', inst.id)
    if (error) console.error('Installment update failed:', inst.id, error)
    else inst.status = 'paid'
  }

  const added = toSettle
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const allPaid = allInstallments.length > 0 && allInstallments.every(i => i.status === 'paid')

  const { error: invoiceError } = await supabase
    .from('fee_invoices')
    .update({
      status: allPaid ? 'paid' : 'partial',
      paid_amount: Number(invoice.paid_amount || 0) + added,
      payment_mode: 'GetePay',
      payment_date: today,
      payment_status: 'success',
      getepay_transaction_id: getepayTxnId
    })
    .eq('id', invoiceId)
    .eq('school_id', schoolId)
  if (invoiceError) console.error('Invoice update failed:', invoiceId, invoiceError)
}

export async function POST(request) {
  try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      )
    const { response, mid, terminalId } = await request.json()

    // Resolve the paying school from the MID GetePay posted back. Never fall back to
    // "first school with credentials" — that decrypts with another tenant's key.
    if (!mid) {
      return NextResponse.json({ error: 'Missing mid in callback' })
    }

    let query = supabase
      .from('schools')
      .select('id, getepay_key, getepay_iv')
      .eq('getepay_mid', mid)
      .not('getepay_key', 'is', null)

    if (terminalId) {
      query = query.eq('getepay_terminal_id', terminalId)
    }

    const { data: schools } = await query.limit(1)

    const school = schools?.[0]
    if (!school) {
      return NextResponse.json({ error: 'No credentials found' })
    }

    const decryptEas = (await import('@/lib/getepay/decryptEas')).default
    const decrypted = decryptEas(response, school.getepay_key, school.getepay_iv)

    let data = decrypted
      if (typeof data === 'string') {
        data = JSON.parse(data)
      }
      if (typeof data === 'string') {
        data = JSON.parse(data)  // double parse if needed
      }
      
    

    // Extract invoice_id directly from udf1
const invoiceId = (data.udf1 || '').trim()

// udf4 carries our merchant transaction id (set by /api/getepay/initiate)
const merchantTxnId = (data.udf4 || data.merchantTransactionId || '').trim()
let txn = null
if (merchantTxnId) {
  const { data: txnRow } = await supabase
    .from('fee_transactions')
    .select('id, invoice_id, installment_ids, status')
    .eq('merchant_transaction_id', merchantTxnId)
    .eq('school_id', school.id)
    .maybeSingle()
  txn = txnRow
}
// If the id didn't come back, fall back to this invoice's latest unsettled attempt
// rather than risk treating an installment payment as a full one.
if (!txn && invoiceId) {
  const { data: txnRow } = await supabase
    .from('fee_transactions')
    .select('id, invoice_id, installment_ids, status')
    .eq('invoice_id', invoiceId)
    .eq('school_id', school.id)
    .eq('status', 'initiated')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  txn = txnRow
}

if (invoiceId && txn?.installment_ids?.length > 0 && txn.invoice_id === invoiceId) {
  await settleInstallments(supabase, school.id, invoiceId, txn, data.getepayTxnId || '')
} else if (invoiceId) {
  if (txn) {
    await supabase
      .from('fee_transactions')
      .update({ status: 'success', getepay_txn_id: data.getepayTxnId || '', completed_at: new Date().toISOString() })
      .eq('id', txn.id)
  }
  // Scope to the paying school so a callback for one tenant can never settle
  // another tenant's invoice.
  const { data: invoice, error: fetchError } = await supabase
    .from('fee_invoices')
    .select('total_amount')
    .eq('id', invoiceId)
    .eq('school_id', school.id)
    .single()

  

  if (invoice) {
    const { data: updateResult, error: updateError } = await supabase
      .from('fee_invoices')
      .update({
        status: 'paid',
        paid_amount: invoice.total_amount,
        payment_mode: 'GetePay',
        payment_date: new Date().toISOString().split('T')[0],
        payment_status: 'success',
        getepay_transaction_id: data.getepayTxnId || ''
      })
      .eq('id', invoiceId)
      .eq('school_id', school.id)
      .select()

    
  } else {
    
  }
}

    return NextResponse.json({ data: typeof data === 'string' ? JSON.parse(data) : data })
  } catch (e) {
    
    return NextResponse.json({ error: e.message })
  }
}