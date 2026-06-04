'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PaymentSuccess() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    verifyPayment()
  }, [])

  const verifyPayment = async () => {
    try {
      // GetePay sends response params in URL
      const txnId = searchParams.get('merchantTransactionId') || searchParams.get('txnId')
      const txnStatus = searchParams.get('txnStatus') || searchParams.get('status')
      const amount = searchParams.get('amount')
      const udf1 = searchParams.get('udf1') // invoice_id

      if (txnStatus === 'SUCCESS' || txnStatus === 'success') {
        // Update invoice as paid
        if (udf1) {
          const { data: invoice } = await supabase
            .from('fee_invoices')
            .select('total_amount')
            .eq('id', udf1)
            .single()

          await supabase.from('fee_invoices').update({
            status: 'paid',
            paid_amount: invoice?.total_amount || parseFloat(amount),
            payment_mode: 'GetePay',
            payment_date: new Date().toISOString().split('T')[0],
            payment_status: 'success',
            getepay_transaction_id: txnId
          }).eq('id', udf1)
        }
        setStatus('success')
        setMessage('Payment successful! Your fee has been recorded.')
      } else {
        setStatus('failed')
        setMessage('Payment was not successful. Please try again.')
      }
    } catch (e) {
      setStatus('error')
      setMessage('Error verifying payment. Please contact school admin.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '20px' }}>
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontWeight: '700', fontSize: '20px', color: '#fff', marginBottom: '8px' }}>Verifying Payment...</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Please wait while we confirm your payment.</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontWeight: '700', fontSize: '20px', color: '#34d399', marginBottom: '8px' }}>Payment Successful!</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '28px' }}>{message}</div>
            <a href='/parent' style={{ display: 'block', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', textDecoration: 'none' }}>
              Back to Portal
            </a>
          </>
        )}
        {(status === 'failed' || status === 'error') && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
            <div style={{ fontWeight: '700', fontSize: '20px', color: '#f87171', marginBottom: '8px' }}>Payment Failed</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '28px' }}>{message}</div>
            <a href='/parent' style={{ display: 'block', padding: '14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontWeight: '700', fontSize: '15px', textDecoration: 'none' }}>
              Back to Portal
            </a>
          </>
        )}
      </div>
    </div>
  )
}