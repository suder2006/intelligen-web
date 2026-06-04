export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
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
    console.log('Decrypted raw:', decrypted)
    const data = JSON.parse(decrypted)
    console.log('Decrypted data:', data)

    // Extract invoice_id and mark fee as paid
    const txnId = data.merchantTransactionId || ''
    if (txnId.startsWith('INV-')) {
      const parts = txnId.split('-')
      const invoiceId = parts.slice(1, parts.length - 1).join('-')
      if (invoiceId) {
        const { data: invoice } = await supabase
          .from('fee_invoices')
          .select('total_amount')
          .eq('id', invoiceId)
          .single()

        if (invoice) {
          await supabase.from('fee_invoices').update({
            status: 'paid',
            paid_amount: invoice.total_amount,
            payment_mode: 'GetePay',
            payment_date: new Date().toISOString().split('T')[0],
            payment_status: 'success',
            getepay_transaction_id: data.transactionId || txnId
          }).eq('id', invoiceId)
          console.log('Fee marked as paid for invoice:', invoiceId)
        }
      }
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error('Process error:', e)
    return NextResponse.json({ error: e.message })
  }
}