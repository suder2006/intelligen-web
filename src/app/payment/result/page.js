'use client'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function PaymentResultContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(30)

  useEffect(() => { verifyPayment() }, [])

  useEffect(() => {
    if (status === 'success') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            window.location.href = '/parent'
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [status])

  const verifyPayment = async () => {
    try {
      // Log all params for debugging
      const allParams = Object.fromEntries(searchParams.entries())
      console.log('GetePay response params:', allParams)

      const txnStatus = searchParams.get('status')
      const udf1 = searchParams.get('udf1')

      if (txnStatus === 'SUCCESS') {
        if (udf1) {
          const { data: invoice } = await supabase
            .from('fee_invoices')
            .select('total_amount')
            .eq('id', udf1)
            .single()

          await supabase.from('fee_invoices').update({
            status: 'paid',
            paid_amount: invoice?.total_amount,
            payment_mode: 'GetePay',
            payment_date: new Date().toISOString().split('T')[0],
            payment_status: 'success'
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
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px', textAlign: 'center' }}>
        
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
            <div style={{ fontWeight: '700', fontSize: '20px', color: '#fff', marginBottom: '8px' }}>Verifying Payment...</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Please wait.</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontWeight: '700', fontSize: '20px', color: '#34d399', marginBottom: '4px' }}>Payment Successful!</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>{message}</div>

            {/* Transaction Details */}
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'left' }}>
              <div style={{ color: '#34d399', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>📋 Payment Receipt</div>
              {searchParams.get('merchantTransactionId') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Transaction ID</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{searchParams.get('merchantTransactionId')}</span>
                </div>
              )}
              {searchParams.get('amount') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Amount Paid</span>
                  <span style={{ color: '#34d399', fontSize: '16px', fontWeight: '700' }}>₹{searchParams.get('amount')}</span>
                </div>
              )}
              {searchParams.get('paymentMode') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Payment Mode</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{searchParams.get('paymentMode')}</span>
                </div>
              )}
              {searchParams.get('mid') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Merchant ID</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{searchParams.get('mid')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Status</span>
                <span style={{ color: '#34d399', fontSize: '13px', fontWeight: '700' }}>✅ SUCCESS</span>
              </div>
            </div>

            {/* Screenshot reminder */}
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '16px' }}>
              📸 Take a screenshot of this receipt for your records
            </div>

            {/* Countdown */}
            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ color: '#38bdf8', fontSize: '14px', marginBottom: '8px' }}>
                Redirecting to portal in <strong style={{ fontSize: '22px' }}>{countdown}</strong> seconds...
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '4px' }}>
                <div style={{ background: '#38bdf8', borderRadius: '4px', height: '4px', width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }} />
              </div>
            </div>

            <a href='/parent' style={{ display: 'block', padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', textDecoration: 'none' }}>
              Go to Portal Now →
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

export default function PaymentResult() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
      </div>
    }>
      <PaymentResultContent />
    </Suspense>
  )
}