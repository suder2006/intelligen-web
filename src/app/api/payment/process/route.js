export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

if (invoiceId) {
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