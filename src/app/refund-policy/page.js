export default function RefundPolicy() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#fafaf8', color: '#1a1a1a', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Cormorant+Garamond:wght@600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .nav { background: #fff; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 700; text-decoration: none; }
        .logo .intelli { color: #1e3a8a; }
        .logo .gen { color: #ea7211; }
        .container { max-width: 800px; margin: 0 auto; padding: 60px 40px; }
        h1 { font-family: 'Cormorant Garamond', serif; font-size: 42px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px; }
        .updated { color: #888; font-size: 14px; margin-bottom: 48px; }
        h2 { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 36px 0 12px; }
        p { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 16px; }
        ul { padding-left: 24px; margin-bottom: 16px; }
        li { font-size: 15px; line-height: 1.8; color: #444; margin-bottom: 6px; }
        .highlight { background: #f0f4ff; border-left: 3px solid #1e3a8a; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .warning { background: #fff7ed; border-left: 3px solid #ea7211; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .footer { background: #0f172a; color: rgba(255,255,255,0.5); padding: 32px 40px; text-align: center; font-size: 13px; margin-top: 80px; }
        .footer a { color: rgba(255,255,255,0.5); text-decoration: none; margin: 0 12px; }
        .footer a:hover { color: #fff; }
        @media (max-width: 768px) { .container { padding: 40px 20px; } .nav { padding: 14px 20px; } }
      `}</style>

      <nav className="nav">
        <a href="/" className="logo">
          <span className="intelli">intelli</span><span className="gen">Gen</span>
        </a>
        <a href="/" style={{ color: '#1e3a8a', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>← Back to Home</a>
      </nav>

      <div className="container">
        <h1>Refund Policy</h1>
        <p className="updated">Last updated: April 2026</p>

        <div className="highlight">
          <p style={{ margin: 0 }}>This Refund Policy applies to all payments made through the <strong>intelliGen</strong> platform at <strong>intelligenapp.com</strong>. Please read this policy carefully before making any payments.</p>
        </div>

        <h2>1. School Fee Payments</h2>
        <p>intelliGen is a technology platform that facilitates fee collection between preschools and parents. Fee payments made through intelliGen are collected by the respective schools directly.</p>

        <div className="warning">
          <p style={{ margin: 0 }}><strong>Important:</strong> intelliGen does not hold, process, or control school fee payments. All fee-related refund requests must be directed to your child's school directly.</p>
        </div>

        <h2>2. Refund Eligibility for School Fees</h2>
        <p>Refund eligibility for school fees depends on the individual school's fee policy. Generally:</p>
        <ul>
          <li>Refund requests must be submitted within <strong>7 days</strong> of payment</li>
          <li>Duplicate payments are eligible for full refund</li>
          <li>Payments made in error are eligible for refund subject to school approval</li>
          <li>Admission fees and registration fees are generally non-refundable</li>
          <li>Term fees refunds are subject to the school's withdrawal policy</li>
        </ul>

        <h2>3. How to Request a Refund</h2>
        <p>To request a refund for a school fee payment:</p>
        <ul>
          <li><strong>Step 1:</strong> Contact your child's school administrator directly</li>
          <li><strong>Step 2:</strong> Provide your payment reference number</li>
          <li><strong>Step 3:</strong> Submit a written refund request to the school</li>
          <li><strong>Step 4:</strong> School will process the refund as per their policy</li>
        </ul>

        <h2>4. Refund Timeline</h2>
        <p>Once a refund is approved by the school:</p>
        <ul>
          <li><strong>UPI payments:</strong> Refunded within 3-5 business days</li>
          <li><strong>Credit/Debit card:</strong> Refunded within 5-7 business days</li>
          <li><strong>Net Banking:</strong> Refunded within 3-5 business days</li>
        </ul>

        <h2>5. Duplicate Payments</h2>
        <p>In case of duplicate payments made through intelliGen:</p>
        <ul>
          <li>Contact us immediately at <a href="mailto:support@intelligenapp.com" style={{ color: '#1e3a8a' }}>support@intelligenapp.com</a></li>
          <li>Provide transaction details and proof of duplicate payment</li>
          <li>Duplicate payments will be refunded within <strong>5-7 business days</strong></li>
        </ul>

        <h2>6. Failed Transactions</h2>
        <p>If a payment fails but your account was debited:</p>
        <ul>
          <li>The amount will be automatically reversed within <strong>3-5 business days</strong></li>
          <li>If not reversed, contact your bank with the transaction reference</li>
          <li>You can also write to us at <a href="mailto:support@intelligenapp.com" style={{ color: '#1e3a8a' }}>support@intelligenapp.com</a></li>
        </ul>

        <h2>7. intelliGen Platform Subscription</h2>
        <p>For schools subscribing to intelliGen platform services:</p>
        <ul>
          <li>Monthly subscriptions can be cancelled anytime</li>
          <li>No refund for the current billing month upon cancellation</li>
          <li>Annual subscriptions: Pro-rata refund for unused months if cancelled within 30 days of payment</li>
          <li>No refund for annual subscriptions cancelled after 30 days</li>
        </ul>

        <h2>8. Non-Refundable Items</h2>
        <p>The following are non-refundable:</p>
        <ul>
          <li>One-time setup fees</li>
          <li>Customisation and integration charges</li>
          <li>Training and onboarding fees</li>
          <li>Completed service charges</li>
        </ul>

        <h2>9. Dispute Resolution</h2>
        <p>If you have a dispute regarding a refund:</p>
        <ul>
          <li>Email us at <a href="mailto:support@intelligenapp.com" style={{ color: '#1e3a8a' }}>support@intelligenapp.com</a></li>
          <li>Include your transaction ID, amount, and reason for dispute</li>
          <li>We will respond within <strong>2 business days</strong></li>
          <li>Disputes will be resolved within <strong>14 business days</strong></li>
        </ul>

        <h2>10. Contact Us</h2>
        <p>For any refund related queries:</p>
        <ul>
          <li>Email: <a href="mailto:support@intelligenapp.com" style={{ color: '#1e3a8a' }}>support@intelligenapp.com</a></li>
          <li>Website: <a href="https://intelligenapp.com" style={{ color: '#1e3a8a' }}>intelligenapp.com</a></li>
          <li>Response time: Within 2 business days</li>
        </ul>
      </div>

      <footer className="footer">
        <div style={{ marginBottom: '12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '700' }}>
          <span style={{ color: '#93c5fd' }}>intelli</span><span style={{ color: '#fb923c' }}>Gen</span>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/refund-policy">Refund Policy</a>
          <a href="mailto:hello@intelligenapp.com">Contact Us</a>
        </div>
        <div>© 2026 intelliGen. All rights reserved.</div>
      </footer>
    </div>
  )
}