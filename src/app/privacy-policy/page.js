export default function PrivacyPolicy() {
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
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: April 2026</p>

        <div className="highlight">
          <p style={{ margin: 0 }}>This Privacy Policy describes how <strong>intelliGen</strong> ("we", "us", or "our") collects, uses, and protects information when you use our preschool management platform at <strong>intelligenapp.com</strong>.</p>
        </div>

        <h2>1. Information We Collect</h2>
        <p>We collect the following types of information:</p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, phone number, and role (parent, teacher, admin)</li>
          <li><strong>Student Information:</strong> Student name, date of birth, gender, program, and attendance records</li>
          <li><strong>School Information:</strong> School name, address, and administrative details</li>
          <li><strong>Communication Data:</strong> Messages exchanged between parents and teachers through the platform</li>
          <li><strong>Usage Data:</strong> How you interact with our platform, including login times and features used</li>
          <li><strong>Payment Information:</strong> Fee invoices and payment records (we do not store card details)</li>
          <li><strong>Photos:</strong> Classroom moments uploaded by teachers for sharing with parents</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and maintain the intelliGen platform and its features</li>
          <li>Enable communication between parents, teachers, and school administrators</li>
          <li>Send push notifications about attendance, transport, diary notes and messages</li>
          <li>Process fee payments and generate invoices</li>
          <li>Generate attendance and progress reports</li>
          <li>Improve our platform and develop new features</li>
          <li>Respond to your support requests and inquiries</li>
        </ul>

        <h2>3. Data Storage and Security</h2>
        <p>Your data is stored securely using <strong>Supabase</strong>, a trusted cloud database provider. We implement the following security measures:</p>
        <ul>
          <li>All data is encrypted in transit using SSL/TLS</li>
          <li>Row-level security policies to ensure users only access their own data</li>
          <li>Secure authentication using industry-standard protocols</li>
          <li>Regular security reviews and updates</li>
        </ul>

        <h2>4. Data Sharing</h2>
        <p>We do not sell your personal information to third parties. We may share data with:</p>
        <ul>
          <li><strong>School Administrators:</strong> To manage school operations and student records</li>
          <li><strong>Teachers:</strong> To access student information relevant to their classes</li>
          <li><strong>Parents:</strong> To view their child's attendance, progress, and school updates</li>
          <li><strong>Service Providers:</strong> Trusted providers like Supabase and Vercel who help operate our platform</li>
        </ul>

        <h2>5. Children's Privacy</h2>
        <div className="highlight">
          <p style={{ margin: 0 }}>intelliGen is designed for use by preschools and involves data about children. We take children's privacy very seriously. Student data is only accessible to authorised school staff and the child's parents or guardians. We do not use children's data for advertising or share it with unauthorised parties.</p>
        </div>

        <h2>6. Push Notifications</h2>
        <p>With your permission, we send push notifications for:</p>
        <ul>
          <li>Transport updates (when your child boards or is dropped)</li>
          <li>New diary notes from teachers</li>
          <li>Messages from teachers</li>
          <li>Important school announcements</li>
        </ul>
        <p>You can disable push notifications at any time through your device settings.</p>

        <h2>7. Data Retention</h2>
        <p>We retain your data for as long as your school has an active account with intelliGen. Upon account termination, data is retained for 90 days before permanent deletion, unless required by law.</p>

        <h2>8. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Withdraw consent for data processing</li>
          <li>Lodge a complaint with a data protection authority</li>
        </ul>

        <h2>9. Cookies</h2>
        <p>We use essential cookies to maintain your login session. We do not use tracking or advertising cookies. You can control cookies through your browser settings.</p>

        <h2>10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date.</p>

        <h2>11. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or your data, please contact us:</p>
        <ul>
          <li>Email: <a href="mailto:privacy@intelligenapp.com" style={{ color: '#1e3a8a' }}>privacy@intelligenapp.com</a></li>
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