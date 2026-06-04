import { NextResponse } from 'next/server'

export async function middleware(request) {
  if (request.nextUrl.pathname === '/payment/success' && 
      request.method === 'POST') {
    try {
      const formData = await request.formData()
      const params = {}
      for (const [key, value] of formData.entries()) {
        params[key] = value
      }

      const status = params.status || ''
      const encryptedResponse = params.response || ''
      const mid = params.mid || ''
      const terminalId = params.terminalId || ''

      // Call our API to decrypt and process
      let decryptedData = {}
      if (encryptedResponse && status === 'SUCCESS') {
        try {
          const decryptRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/process`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ response: encryptedResponse })
            }
          )
          const result = await decryptRes.json()
          if (result.data) decryptedData = result.data
        } catch (e) {
          console.error('Decrypt API error:', e)
        }
      }

      const txnId = decryptedData.transactionId || decryptedData.txnId || ''
      const txnAmount = decryptedData.txnAmount || decryptedData.amount || ''
      const merchantName = decryptedData.merchantName || ''
      const customerName = decryptedData.customerName || decryptedData.udf2 || ''
      const paymentMode = decryptedData.paymentMode || ''
      const custRefNo = decryptedData.custRefNo || decryptedData.bankRefNo || ''

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Receipt</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; color: #fff; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; max-width: 460px; width: 100%; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; margin-bottom: 20px; }
    .logo span { color: #38bdf8; }
    .icon { font-size: 56px; margin-bottom: 12px; }
    .title { color: #34d399; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 20px; }
    .receipt { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: left; }
    .receipt-title { color: #34d399; font-weight: 700; font-size: 14px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: rgba(255,255,255,0.4); }
    .value { color: #fff; font-weight: 600; text-align: right; }
    .amount { color: #34d399; font-size: 18px; font-weight: 700; }
    .status-badge { background: rgba(16,185,129,0.15); color: #34d399; padding: 3px 10px; border-radius: 20px; font-size: 13px; font-weight: 700; }
    .screenshot { color: rgba(255,255,255,0.4); font-size: 12px; margin: 12px 0; }
    .countdown-box { background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 12px; margin-bottom: 16px; }
    .countdown-text { color: #38bdf8; font-size: 14px; margin-bottom: 6px; }
    .bar { background: rgba(255,255,255,0.06); border-radius: 4px; height: 6px; overflow: hidden; }
    .fill { background: #38bdf8; height: 6px; border-radius: 4px; animation: countdown 30s linear forwards; }
    @keyframes countdown { from { width: 100%; } to { width: 0%; } }
    .btn { display: block; margin-top: 12px; padding: 14px; background: linear-gradient(135deg, #0ea5e9, #38bdf8); border-radius: 10px; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Intelli<span>Gen</span></div>
    <div class="icon">🎉</div>
    <div class="title">Payment Successful!</div>
    <div class="subtitle">Your fee payment has been recorded.</div>
    <div class="receipt">
      <div class="receipt-title">📋 Payment Receipt</div>
      ${merchantName ? `<div class="row"><span class="label">Merchant Name</span><span class="value">${merchantName}</span></div>` : ''}
      ${txnId ? `<div class="row"><span class="label">Transaction ID</span><span class="value">${txnId}</span></div>` : ''}
      ${txnAmount ? `<div class="row"><span class="label">Amount Paid</span><span class="value amount">₹${txnAmount}</span></div>` : ''}
      ${customerName ? `<div class="row"><span class="label">Customer Name</span><span class="value">${customerName}</span></div>` : ''}
      ${paymentMode ? `<div class="row"><span class="label">Payment Mode</span><span class="value">${paymentMode}</span></div>` : ''}
      ${custRefNo ? `<div class="row"><span class="label">Ref No</span><span class="value">${custRefNo}</span></div>` : ''}
      <div class="row"><span class="label">Status</span><span class="status-badge">✅ SUCCESS</span></div>
    </div>
    <div class="screenshot">📸 Take a screenshot of this receipt for your records</div>
    <div class="countdown-box">
      <div class="countdown-text">Redirecting to portal in <strong id="timer">30</strong> seconds...</div>
      <div class="bar"><div class="fill"></div></div>
    </div>
    <a href="/parent" class="btn">Go to Portal Now →</a>
  </div>
  <script>
    let t = 30;
    const timer = setInterval(() => {
      t--;
      document.getElementById('timer').textContent = t;
      if (t <= 0) { clearInterval(timer); window.location.href = '/parent'; }
    }, 1000);
  </script>
</body>
</html>`

      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    } catch (e) {
      console.error('Middleware error:', e)
      return new NextResponse(null, {
        status: 303,
        headers: { Location: '/parent' }
      })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/payment/success'
}