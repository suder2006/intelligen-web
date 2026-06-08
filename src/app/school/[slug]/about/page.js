{/* Payment Flow - Required for GetePay */}
<div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '28px' }}>
  <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px' }}>💳 Fee Payment Process</h2>
  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '28px' }}>
    Parents can pay school fees securely online through our parent portal. Here's how it works:
  </p>

  {/* Flow Steps */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
    {[
      { step: '1', icon: '👤', title: 'Parent Login', desc: 'Parent logs into the IntelliGen parent portal at intelligenapp.com using their registered email and password.' },
      { step: '2', icon: '💳', title: 'View Fee Invoice', desc: 'Parent navigates to the Fees tab where all pending fee invoices are displayed — including fee type, amount due, and due date.' },
      { step: '3', icon: '🖱️', title: 'Click Pay Online', desc: 'Parent clicks the "Pay Online" button on the invoice they wish to pay.' },
      { step: '4', icon: '🔒', title: 'Secure Payment Gateway', desc: 'Parent is redirected to the GetePay secure payment page. Payment can be made via UPI (GPay, PhonePe, Paytm), Debit Card, Credit Card, or Net Banking.' },
      { step: '5', icon: '✅', title: 'Payment Confirmation', desc: 'On successful payment, parent receives a confirmation receipt with transaction ID, amount paid, and payment date.' },
      { step: '6', icon: '📊', title: 'Fee Status Updated', desc: 'The fee invoice is automatically marked as paid in the school portal. Admin and parent both see the updated status instantly.' },
      { step: '7', icon: '🏦', title: 'Settlement', desc: 'The payment amount is settled directly into Time Kids Preschool Anna Nagar\'s bank account by GetePay as per settlement schedule.' },
    ].map((item, idx, arr) => (
      <div key={item.step} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left connector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            {item.icon}
          </div>
          {idx < arr.length - 1 && (
            <div style={{ width: '2px', height: '40px', background: 'rgba(56,189,248,0.3)', margin: '4px 0' }} />
          )}
        </div>
        {/* Content */}
        <div style={{ paddingBottom: idx < arr.length - 1 ? '8px' : '0', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ background: '#38bdf8', color: '#0f172a', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Step {item.step}</span>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{item.title}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.7' }}>{item.desc}</p>
        </div>
      </div>
    ))}
  </div>

  {/* Payment Methods */}
  <div style={{ marginTop: '28px', padding: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '14px' }}>Accepted Payment Methods</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
      {[
        { icon: '📱', label: 'UPI', desc: 'GPay, PhonePe, Paytm & all UPI apps' },
        { icon: '💳', label: 'Debit Card', desc: 'Visa, Mastercard, RuPay' },
        { icon: '💳', label: 'Credit Card', desc: 'Visa, Mastercard' },
        { icon: '🏦', label: 'Net Banking', desc: 'All major Indian banks' },
      ].map(m => (
        <div key={m.label} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>{m.icon}</div>
          <div style={{ fontWeight: '600', fontSize: '13px', color: '#38bdf8', marginBottom: '4px' }}>{m.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{m.desc}</div>
        </div>
      ))}
    </div>
  </div>

  {/* Policy links */}
  <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
    <a href={`/school/${school.slug}/refund`} style={{ padding: '8px 16px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>💰 Refund Policy</a>
    <a href={`/school/${school.slug}/terms`} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>📄 Terms & Conditions</a>
    <a href={`/school/${school.slug}/privacy`} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>🔒 Privacy Policy</a>
  </div>
</div>