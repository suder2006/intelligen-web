export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: June 2025</p>
        </div>

        {[
          {
            title: '1. Introduction',
            content: `IntelliGen ("we", "our", "us") is a preschool management platform operated by IntelliGen Technologies. We are committed to protecting the privacy and security of all personal data we collect from schools, teachers, administrators, parents, and children who use our platform.

This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our software-as-a-service (SaaS) platform available at intelligenapp.com. Please read this policy carefully. If you disagree with its terms, please discontinue use of our platform.`
          },
          {
            title: '2. Information We Collect',
            content: `We collect several types of information to provide and improve our services:

School & Administrator Data
• School name, address, contact details, and registration information
• Admin user credentials and profile information
• School settings, branding preferences, and configuration data
• Subscription and billing information

Teacher & Staff Data
• Full name, email address, phone number, and role
• Attendance records, leave requests, and payroll information
• Program assignments and class schedules

Parent & Guardian Data
• Full name, email address, and phone number
• Children linked to the account
• Payment history and fee records
• Communication history with teachers

Student Data
• Full name, date of birth, gender, and enrollment details
• Attendance records and academic progress
• Health notes and special requirements (if provided)
• Transport and check-in/check-out records
• Progress reports and skill assessments

Automatically Collected Data
• Device information, browser type, and IP address
• Usage patterns and feature interactions
• Push notification tokens
• Log data and error reports`
          },
          {
            title: '3. How We Use Your Information',
            content: `We use collected information for the following purposes:

Platform Operations
• Providing and maintaining core platform functionality
• Processing fee payments and generating invoices
• Managing student attendance, transport, and check-in systems
• Sending automated notifications and reminders

Communication
• Sending birthday wishes, diary entries, and announcements to parents
• Delivering push notifications for transport updates and important alerts
• Responding to support requests and inquiries

Improvement & Analytics
• Analyzing usage patterns to improve features
• Identifying and resolving technical issues
• Developing new features based on user behavior

Legal & Compliance
• Complying with applicable laws and regulations
• Enforcing our Terms of Service
• Protecting the rights and safety of users`
          },
          {
            title: '4. Data Sharing and Disclosure',
            content: `We do not sell, trade, or rent your personal information to third parties. We may share information in the following circumstances:

Within Your School
• Student data is shared with authorized teachers, administrators, and parents as necessary for educational purposes
• Parents can view their children's attendance, fees, diary entries, and progress reports

Service Providers
• Supabase (database and authentication infrastructure)
• Vercel (cloud hosting and deployment)
• GetePay (payment processing — see their privacy policy for payment data handling)
• QR code generation services (no personal data transmitted)

Legal Requirements
• When required by law, regulation, or legal process
• To protect the safety of students, staff, or the public
• In connection with a merger, acquisition, or sale of assets (with prior notice)

We ensure all third-party service providers maintain appropriate data protection standards.`
          },
          {
            title: '5. Children\'s Privacy',
            content: `IntelliGen handles student data with the highest level of care. We acknowledge that our platform processes data relating to children under 13 years of age on behalf of educational institutions.

• Schools and parents are responsible for obtaining appropriate consents for student data
• We do not use student data for advertising or marketing purposes
• Student data is only used to provide educational management services
• We do not share student data with unauthorized third parties
• Schools retain ownership of all student data entered into the platform
• Parents may request access to or deletion of their child's data through their school administrator

We comply with applicable children's data protection laws in India including provisions under the Information Technology Act, 2000 and its rules.`
          },
          {
            title: '6. Data Security',
            content: `We implement industry-standard security measures to protect your data:

Technical Safeguards
• Data encryption in transit (HTTPS/TLS) and at rest
• Secure authentication with row-level security policies
• Role-based access controls (RBAC) ensuring users only access appropriate data
• Regular security audits and vulnerability assessments
• Secure payment processing through PCI-compliant payment gateways

Operational Safeguards
• Limited employee access to production data
• Regular data backups with disaster recovery procedures
• Monitoring for unauthorized access attempts
• Incident response procedures for data breaches

While we employ these safeguards, no method of transmission or storage is 100% secure. We encourage users to use strong passwords and report any suspected security incidents to getintelligen@gmail.com.`
          },
          {
            title: '7. Data Retention',
            content: `We retain personal data for as long as necessary to provide our services and comply with legal obligations:

• Active account data: Retained for the duration of your subscription
• Student records: Retained for the academic year plus 3 years after last activity
• Payment records: Retained for 7 years as required by financial regulations
• Communication logs: Retained for 2 years
• Deleted account data: Purged within 90 days of account termination

Schools may export their data at any time through the platform's reporting features. Upon subscription termination, we provide a 30-day window to export all data before deletion.`
          },
          {
            title: '8. Your Rights',
            content: `Depending on your location, you may have the following rights regarding your personal data:

• Access: Request a copy of the personal data we hold about you
• Correction: Request correction of inaccurate or incomplete data
• Deletion: Request deletion of your personal data (subject to legal obligations)
• Portability: Request your data in a machine-readable format
• Objection: Object to processing of your data for certain purposes
• Restriction: Request restriction of processing in certain circumstances

To exercise any of these rights, please contact us at getintelligen@gmail.com. We will respond to all requests within 30 days. School administrators can exercise these rights on behalf of their school data through the admin portal.`
          },
          {
            title: '9. Cookies and Tracking',
            content: `We use minimal cookies and tracking technologies:

• Authentication cookies: Essential for maintaining your logged-in session
• Preference cookies: Remembering your language and display settings
• Analytics: Anonymous usage statistics to improve the platform

We do not use advertising cookies or track users across third-party websites. You can control cookie settings through your browser, though disabling essential cookies may affect platform functionality.`
          },
          {
            title: '10. Third-Party Links',
            content: `Our platform may contain links to third-party websites or services (such as payment gateways). We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access through our platform.`
          },
          {
            title: '11. Changes to This Policy',
            content: `We may update this Privacy Policy periodically to reflect changes in our practices or applicable laws. We will notify users of significant changes via:

• Email notification to registered administrators
• In-app notification on next login
• Updated "Last modified" date on this page

Continued use of IntelliGen after notification of changes constitutes acceptance of the updated policy.`
          },
          {
            title: '12. Contact Us',
            content: `For any privacy-related questions, concerns, or requests, please contact us:

IntelliGen Technologies
Email: getintelligen@gmail.com
Phone: +91 99620 48869
Website: intelligenapp.com

We are committed to resolving privacy concerns promptly and transparently.`
          }
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#38bdf8', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(56,189,248,0.2)' }}>
              {section.title}
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
              {section.content}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            © 2025 IntelliGen Technologies. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
            <a href='/terms' style={{ color: '#38bdf8', fontSize: '13px' }}>Terms of Service</a>
            <a href='/refund-policy' style={{ color: '#38bdf8', fontSize: '13px' }}>Refund Policy</a>
            <a href='/landing' style={{ color: '#38bdf8', fontSize: '13px' }}>Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}