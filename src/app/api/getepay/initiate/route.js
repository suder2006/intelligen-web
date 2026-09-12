export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

export async function POST(request) {
  // Every step logs under this tag: a failure here is only ever visible in the
  // server logs, since the parent just sees "could not start payment".
  const tag = 'getepay-initiate'
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[${tag}] SUPABASE_SERVICE_ROLE_KEY is not set in this environment`)
      return NextResponse.json(
        { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing', stage: 'no-service-key' },
        { status: 500 }
      )
    }
    const supabase = getSupabase()
    // The client still sends `amount`, but it is ignored: the charge is always worked
    // out below from the invoice/installment rows, since the callback settles by those.
    const { invoice_id, school_id, student_name, installment_ids } = await request.json()
    const requestedInstallmentIds = Array.isArray(installment_ids) ? [...new Set(installment_ids.filter(Boolean))] : []
    const isInstallmentPayment = requestedInstallmentIds.length > 0
    console.log(`[${tag}] start invoice=${invoice_id} school=${school_id} installments=${requestedInstallmentIds.length ? requestedInstallmentIds.join(',') : 'none (full payment)'}`)

    // Get school GetePay credentials
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('getepay_mid, getepay_terminal_id, getepay_key, getepay_iv, getepay_url, name')
      .eq('id', school_id)
      .single()
    if (schoolError) console.error(`[${tag}] school lookup failed:`, schoolError)

    if (!school?.getepay_mid || !school?.getepay_terminal_id || !school?.getepay_key || !school?.getepay_iv) {
      console.error(`[${tag}] gateway not configured for school ${school_id}:`, school
        ? `mid=${!!school.getepay_mid} terminal=${!!school.getepay_terminal_id} key=${!!school.getepay_key} iv=${!!school.getepay_iv}`
        : 'NO ROW in schools')
      return NextResponse.json({ error: 'Payment gateway not fully configured', stage: 'gateway-not-configured' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('fee_invoices')
      .select('id, total_amount, paid_amount, status')
      .eq('id', invoice_id)
      .eq('school_id', school_id)
      .single()
    if (!invoice) {
      console.error(`[${tag}] invoice ${invoice_id} not found for school ${school_id}:`, invoiceError)
      return NextResponse.json({ error: 'Invoice not found', stage: 'invoice-not-found' }, { status: 404 })
    }
    console.log(`[${tag}] invoice total=${invoice.total_amount} paid=${invoice.paid_amount} status=${invoice.status}`)
    if (invoice.status === 'paid' || invoice.status === 'refunded') {
      console.error(`[${tag}] invoice ${invoice_id} is already ${invoice.status}`)
      return NextResponse.json({ error: `This invoice is already ${invoice.status}.`, stage: 'invoice-already-settled' }, { status: 400 })
    }

    // Full payment: the pending balance. The callback marks the invoice fully paid,
    // so charging anything else would let the app settle it for less.
    let chargeAmount = Math.round((Number(invoice.total_amount) - Number(invoice.paid_amount || 0)) * 100) / 100
    let installmentIds = null
    if (isInstallmentPayment) {
      const { data: installments, error: installmentsError } = await supabase
        .from('fee_installments')
        .select('id, amount, status')
        .eq('invoice_id', invoice_id)
        .in('id', requestedInstallmentIds)
      if (installmentsError || !installments || installments.length !== requestedInstallmentIds.length) {
        console.error(`[${tag}] installment lookup failed: asked for ${requestedInstallmentIds.length}, got ${installments?.length ?? 0}`, installmentsError)
        return NextResponse.json({ error: 'Some selected installments were not found on this invoice', stage: 'installments-not-found' }, { status: 400 })
      }
      if (installments.some(i => i.status === 'paid')) {
        console.error(`[${tag}] refusing already-paid installments:`, installments.filter(i => i.status === 'paid').map(i => i.id).join(','))
        return NextResponse.json({ error: 'Some selected installments are already paid. Please refresh and try again.', stage: 'installments-already-paid' }, { status: 400 })
      }

      // Installment payment: the sum of the selected installments, which the callback settles
      installmentIds = installments.map(i => i.id)
      chargeAmount = Math.round(installments.reduce((sum, i) => sum + Number(i.amount), 0) * 100) / 100
    }
    console.log(`[${tag}] charging ${chargeAmount} (${isInstallmentPayment ? `installments ${installmentIds.join(',')}` : 'full pending balance'})`)

    if (!(chargeAmount > 0)) {
      console.error(`[${tag}] nothing to charge on invoice ${invoice_id}: computed ${chargeAmount}`)
      return NextResponse.json({ error: 'Nothing is pending on this invoice.', stage: 'nothing-pending' }, { status: 400 })
    }

    const transactionId = `INV-${invoice_id}-${Date.now()}`
    const transactionDate = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const data = {
      mid: school.getepay_mid,
      amount: chargeAmount.toFixed(2),
      merchantTransactionId: transactionId,
      transactionDate: transactionDate,
      terminalId: school.getepay_terminal_id,
      udf1: invoice_id,
      udf2: school_id,
      udf3: student_name,
      // Echoed back in the callback so /api/payment/process can find the fee_transactions row
      udf4: transactionId,
      udf5: '',
      udf6: '',
      udf7: '',
      udf8: '',
      udf9: '',
      udf10: '',
      ru: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
      callbackUrl: '',
      currency: 'INR',
      paymentMode: 'ALL',
      bankId: '',
      txnType: 'single',
      productType: 'IPG',
      txnNote: `Fee Payment - ${student_name}`,
      vpa: school.getepay_terminal_id,
    }

    const config = {
      GetepayKey: school.getepay_key,
      GetepayIV: school.getepay_iv,
      GetepayUrl: school.getepay_url?.trim() || 'https://portal.getepay.in:8443/getepayPortal/pg/generateInvoice',
    }

    // Encrypt and call GetePay
    const encryptEas = (await import('@/lib/getepay/encryptEas')).default
    const decryptEas = (await import('@/lib/getepay/decryptEas')).default

    const JsonData = JSON.stringify(data)
    const ciphertext = encryptEas(JsonData, config.GetepayKey, config.GetepayIV)
    const newCipher = ciphertext.toUpperCase()

    console.log(`[${tag}] sending to GetePay:`, JSON.stringify({
      mid: data.mid,
      terminalId: data.terminalId,
      merchantTransactionId: transactionId,
      amount: data.amount,
      req: newCipher.substring(0, 20) + '...'
    }))
    console.log(`[${tag}] GetePay URL:`, config.GetepayUrl)

    const fixieUrl = process.env.FIXIE_URL
    console.log(`[${tag}] FIXIE_URL present:`, !!fixieUrl)
    let response
    if (fixieUrl) {
      const nodeFetch = (await import('node-fetch')).default
      const { HttpsProxyAgent } = await import('https-proxy-agent')
      const agent = new HttpsProxyAgent(fixieUrl)
      response = await nodeFetch(config.GetepayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid: data.mid,
          terminalId: data.terminalId,
          req: newCipher,
        }),
        agent
      })
    } else {
      response = await fetch(config.GetepayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mid: data.mid,
          terminalId: data.terminalId,
          req: newCipher,
        }),
      })
    }
    const result = await response.text()
    console.log(`[${tag}] GetePay raw response:`, result)
    let resultobj
    try {
      resultobj = JSON.parse(result)
    } catch (e) {
      console.error(`[${tag}] GetePay response was not JSON:`, result.substring(0, 500))
      return NextResponse.json({
        error: `GetePay returned invalid response: ${result.substring(0, 200)}`,
        stage: 'getepay-bad-json'
      }, { status: 500 })
    }
    const responseurl = resultobj.response
    if (!responseurl) {
      console.error(`[${tag}] GetePay returned no response field:`, JSON.stringify(resultobj))
      return NextResponse.json({ error: `GetePay returned no response field. Full response: ${JSON.stringify(resultobj)}`, stage: 'getepay-no-response' }, { status: 500 })
    }
    const dataitem = JSON.parse(decryptEas(responseurl, config.GetepayKey, config.GetepayIV))
    console.log(`[${tag}] GetePay issued a payment URL for ${transactionId}`)

    const { error: txnError } = await supabase.from('fee_transactions').insert({
      merchant_transaction_id: transactionId,
      invoice_id,
      school_id,
      amount: chargeAmount.toFixed(2),
      installment_ids: installmentIds,
    })
    if (txnError) {
      // Log every field Postgres gives back: a bare message like "column ... does
      // not exist" is the difference between a five-minute fix and a blind hunt.
      console.error(`[${tag}] fee_transactions insert failed for ${transactionId}:`, JSON.stringify({
        code: txnError.code,
        message: txnError.message,
        details: txnError.details,
        hint: txnError.hint,
      }))
      // Without this row the callback can't tell an installment payment from a full
      // one and would mark the whole invoice paid, so don't hand out the payment URL.
      if (isInstallmentPayment) {
        return NextResponse.json({
          error: 'Could not start installment payment. Please try again or pay via UPI.',
          stage: 'fee-transactions-insert-failed',
          detail: txnError.message,
        }, { status: 500 })
      }
    } else {
      console.log(`[${tag}] recorded fee_transactions row for ${transactionId}`)
    }

    // Save transaction to database
    const { error: invoiceUpdateError } = await supabase.from('fee_invoices').update({
      getepay_transaction_id: transactionId,
      payment_status: 'initiated'
    }).eq('id', invoice_id)
    if (invoiceUpdateError) console.error(`[${tag}] invoice status update failed:`, invoiceUpdateError)

    console.log(`[${tag}] done, handing payment URL back for ${transactionId}`)
    return NextResponse.json({ paymentUrl: dataitem.paymentUrl, transactionId })
  } catch (error) {
    console.error(`[${tag}] unhandled error:`, error)
    return NextResponse.json({ error: error.message, stage: 'unhandled' }, { status: 500 })
  }
}