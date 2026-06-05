export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      )
    const { response } = await request.json()

    // Get school credentials
    const { data: schools } = await supabase
      .from('schools')
      .select('getepay_key, getepay_iv')
      .not('getepay_key', 'is', null)
      .limit(1)

    if (!schools?.[0]) {
      return NextResponse.json({ error: 'No credentials found' })
    }

    const decryptEas = (await import('@/lib/getepay/decryptEas')).default
    const decrypted = decryptEas(response, schools[0].getepay_key, schools[0].getepay_iv)
    
    let data = decrypted
      if (typeof data === 'string') {
        data = JSON.parse(data)
      }
      if (typeof data === 'string') {
        data = JSON.parse(data)  // double parse if needed
      }
      
    

    // Extract invoice_id directly from udf1
const invoiceId = (data.udf1 || '').trim()

if (invoiceId) {
  const { data: invoice, error: fetchError } = await supabase
    .from('fee_invoices')
    .select('total_amount')
    .eq('id', invoiceId)
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
      .select()

    
  } else {
    
  }
}

    return NextResponse.json({ data: typeof data === 'string' ? JSON.parse(data) : data })
  } catch (e) {
    
    return NextResponse.json({ error: e.message })
  }
}