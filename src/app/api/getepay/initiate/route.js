export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function POST(request) {
  try {
    const supabase = getSupabase()
    const { invoice_id, school_id, student_name, amount } = await request.json()

    // Get school GetePay credentials
    const { data: school } = await supabase
      .from('schools')
      .select('getepay_mid, getepay_terminal_id, getepay_key, getepay_iv, getepay_url, name')
      .eq('id', school_id)
      .single()

    if (!school?.getepay_mid) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 400 })
    }

    const transactionId = `INV-${invoice_id}-${Date.now()}`
    const transactionDate = new Date().toString()

    const data = {
      mid: parseInt(school.getepay_mid),
      amount: parseFloat(amount).toFixed(2),
      merchantTransactionId: transactionId,
      transactionDate: transactionDate,
      terminalId: school.getepay_terminal_id,
      udf1: invoice_id,
      udf2: student_name,
      udf3: school_id,
      udf4: '',
      udf5: '',
      udf6: '',
      udf7: '',
      udf8: '',
      udf9: '',
      udf10: '',
      ru: 'https://pay1.getepay.in:8443/getepayPortal/pg/pgPaymentResponse',
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
      GetepayUrl: school.getepay_url || 'https://pay1.getepay.in:8443/getepayPortal/pg/generateInvoice',
    }

    // Encrypt and call GetePay
    const encryptEas = (await import('@/lib/getepay/encryptEas')).default
    const decryptEas = (await import('@/lib/getepay/decryptEas')).default

    const JsonData = JSON.stringify(data)
    const ciphertext = encryptEas(JsonData, config.GetepayKey, config.GetepayIV)
    const newCipher = ciphertext.toUpperCase()

    const response = await fetch(config.GetepayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mid: data.mid,
        terminalId: data.terminalId,
        req: newCipher,
      }),
    })
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
    const responseurl = resultobj.response
    const dataitem = JSON.parse(decryptEas(responseurl, config.GetepayKey, config.GetepayIV))

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