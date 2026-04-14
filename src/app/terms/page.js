export default function TermsOfService() {
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
        .highlight { background: #fff7ed; border-left: 3px solid #ea7211; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
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
        <h1>Terms of Service</h1>
        <p className="updated">Last updated: April 2026</p>

        <div className="highlight">
          <p style={{ margin: 0 }}>Please read these Terms of Service carefully before using the <strong>intelliGen</strong> platform. By accessing or using our service, you agree to be bound by these terms.</p>
        </div>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using intelliGen ("the Platform") at intelligenapp.com, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Platform.</p>

        <h2>2. Description of Service</h2>
        <p>intelliGen is a preschool management platform that provides:</p>
        <ul>
          <li>Student attendance tracking and management</li>
          <li>Fee management and invoicing</li>
          <li>Parent-teacher communication tools</li>
          <li>Daily diary and progress reporting</li>
          <li>Transport tracking and notifications</li>
          <li>Classroom moments sharing</li>
          <li>Staff management and payroll</li>
          <li>Android mobile application</li>
        </ul>

        <h2>3. User Accounts</h2>
        <p>To use intelliGen, you must:</p>
        <ul>
          <li>Be authorised by your school administrator to access the platform</li>
          <li>Provide accurate and complete information when creating your account</li>
          <li>Maintain the security of your password and account credentials</li>
          <li>Notify us immediately of any unauthorised use of your account</li>
          <li>Be responsible for all activities that occur under your account</li>
        </ul>

        <h2>4. Acceptable Use</h2>
        <p>You agree to use intelliGen only for lawful purposes. You must not:</p>
        <ul>
          <li>Share your login credentials with unauthorised persons</li>
          <li>Upload harmful, offensive, or inappropriate content</li>
          <li>Attempt to access other users' data without authorisation</li>
          <li>Use the platform to harass, abuse, or harm others</li>
          <li>Attempt to reverse engineer or copy the platform</li>
          <li>Use automated tools to scrape or extract data</li>
        </ul>

        <h2>5. School Administrator Responsibilities</h2>
        <p>School administrators are responsible for:</p>
        <ul>
          <li>Managing user access and permissions within their school</li>
          <li>Ensuring staff use the platform appropriately</li>
          <li>Maintaining accurate student and parent records</li>
          <li>Obtaining necessary consent from parents for data collection</li>
          <li>Complying with applicable data protection laws</li>
        </ul>

        <h2>6. Data and Privacy</h2>
        <p>Your use of intelliGen is also governed by our <a href="/privacy-policy" style={{ color: '#1e3a8a' }}>Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and use of data as described in our Privacy Policy.</p>

        <h2>7. Intellectual Property</h2>
        <p>intelliGen and all its content, features, and functionality are owned by intelliGen and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>

        <h2>8. Payment Terms</h2>
        <div className="highlight">
          <p style={{ margin: 0 }}>Subscription fees are agreed upon between intelliGen and the school. Fees are billed as per the agreed schedule. intelliGen reserves the right to suspend access for non-payment after reasonable notice.</p>
        </div>

        <h2>9. Service Availability</h2>
        <p>We strive to maintain high availability of the Platform. However, we do not guarantee uninterrupted access. We may perform maintenance that temporarily affects availability. We will provide advance notice where possible.</p>

        <h2>10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, intelliGen shall not be liable for:</p>
        <ul>
          <li>Any indirect, incidental, or consequential damages</li>
          <li>Loss of data due to circumstances beyond our control</li>
          <li>Service interruptions due to third-party infrastructure</li>
          <li>Actions taken by school staff using the platform</li>
        </ul>

        <h2>11. Termination</h2>
        <p>Either party may terminate the service agreement with 30 days written notice. Upon termination:</p>
        <ul>
          <li>Access to the platform will be disabled</li>
          <li>Data will be retained for 90 days before deletion</li>
          <li>School can request a data export before termination</li>
        </ul>

        <h2>12. Changes to Terms</h2>
        <p>We may update these Terms from time to time. We will notify users of significant changes by email or through the platform. Continued use after changes constitutes acceptance of the new terms.</p>

        <h2>13. Governing Law</h2>
        <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Chennai, Tamil Nadu, India.</p>

        <h2>14. Contact Us</h2>
        <p>For questions about these Terms of Service:</p>
        <ul>
          <li>Email: <a href="mailto:legal@intelligenapp.com" style={{ color: '#1e3a8a' }}>legal@intelligenapp.com</a></li>
          <li>Website: <a href="https://intelligenapp.com" style={{ color: '#1e3a8a' }}>intelligenapp.com</a></li>
        </ul>
      </div>

      <footer className="footer">
        <div style={{ marginBottom: '12px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '700' }}>
          <span style={{ color: '#93c5fd' }}>intelli</span><span style={{ color: '#fb923c' }}>Gen</span>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="mailto:hello@intelligenapp.com">Contact Us</a>
        </div>
        <div>© 2026 intelliGen. All rights reserved.</div>
      </footer>
    </div>
  )
}