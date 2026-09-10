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
  try {
    const supabase = getSupabase()
    const { invoice_id, school_id, student_name, amount, installment_ids } = await request.json()
    const requestedInstallmentIds = Array.isArray(installment_ids) ? [...new Set(installment_ids.filter(Boolean))] : []
    const isInstallmentPayment = requestedInstallmentIds.length > 0

    // Get school GetePay credentials
    const { data: school } = await supabase
      .from('schools')
      .select('getepay_mid, getepay_terminal_id, getepay_key, getepay_iv, getepay_url, name')
      .eq('id', school_id)
      .single()

    if (!school?.getepay_mid || !school?.getepay_terminal_id || !school?.getepay_key || !school?.getepay_iv) {
      return NextResponse.json({ error: 'Payment gateway not fully configured' }, { status: 400 })
    }

    // For an installment payment the amount comes from the installment rows, not the
    // client: the callback settles exactly these installments, so the charge must match.
    let chargeAmount = parseFloat(amount)
    let installmentIds = null
    if (isInstallmentPayment) {
      const { data: invoice } = await supabase
        .from('fee_invoices')
        .select('id')
        .eq('id', invoice_id)
        .eq('school_id', school_id)
        .single()
      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      const { data: installments, error: installmentsError } = await supabase
        .from('fee_installments')
        .select('id, amount, status')
        .eq('invoice_id', invoice_id)
        .in('id', requestedInstallmentIds)
      if (installmentsError || !installments || installments.length !== requestedInstallmentIds.length) {
        return NextResponse.json({ error: 'Some selected installments were not found on this invoice' }, { status: 400 })
      }
      if (installments.some(i => i.status === 'paid')) {
        return NextResponse.json({ error: 'Some selected installments are already paid. Please refresh and try again.' }, { status: 400 })
      }

      installmentIds = installments.map(i => i.id)
      chargeAmount = installments.reduce((sum, i) => sum + Number(i.amount), 0)
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

    console.log('Sending to GetePay:', JSON.stringify({
      mid: data.mid,
      terminalId: data.terminalId,
      req: newCipher.substring(0, 20) + '...'
    }))
    console.log('GetePay URL:', config.GetepayUrl)
    
    const fixieUrl = process.env.FIXIE_URL
    console.log('FIXIE_URL present:', !!fixieUrl)
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
    console.log('GetePay raw response:', result)
    let resultobj
    try {
      resultobj = JSON.parse(result)
    } catch (e) {
      return NextResponse.json({ 
        error: `GetePay returned invalid response: ${result.substring(0, 200)}` 
      }, { status: 500 })
    }
    console.log('GetePay resultobj:', JSON.stringify(resultobj))
    const responseurl = resultobj.response
    console.log('GetePay responseurl:', responseurl)
    if (!responseurl) {
      return NextResponse.json({ error: `GetePay returned no response field. Full response: ${JSON.stringify(resultobj)}` }, { status: 500 })
    }
    const dataitem = JSON.parse(decryptEas(responseurl, config.GetepayKey, config.GetepayIV))

    const { error: txnError } = await supabase.from('fee_transactions').insert({
      merchant_transaction_id: transactionId,
      invoice_id,
      school_id,
      amount: chargeAmount.toFixed(2),
      installment_ids: installmentIds,
    })
    if (txnError) {
      console.error('fee_transactions insert failed:', txnError)
      // Without this row the callback can't tell an installment payment from a full
      // one and would mark the whole invoice paid, so don't hand out the payment URL.
      if (isInstallmentPayment) {
        return NextResponse.json({ error: 'Could not start installment payment. Please try again or pay via UPI.' }, { status: 500 })
      }
    }

    // Save transaction to database
    await supabase.from('fee_invoices').update({
      getepay_transaction_id: transactionId,
      payment_status: 'initiated'
    }).eq('id', invoice_id)

    return NextResponse.json({ paymentUrl: dataitem.paymentUrl, transactionId })
  } catch (error) {
    console.error('GetePay error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}