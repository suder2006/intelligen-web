export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
            Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: August 2026</p>
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
• Log data and error reports
• GPS location data (drivers only, during active trips)
• Camera images (when explicitly captured by teachers)`
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
• Google Maps (transport route and location tracking)
• QR code generation services (no personal data transmitted)

Legal Requirements
• When required by law, regulation, or legal process
• To protect the safety of students, staff, or the public
• In connection with a merger, acquisition, or sale of assets (with prior notice)

We ensure all third-party service providers maintain appropriate data protection standards.`
          },
          {
            title: '5. Location Data',
            content: `IntelliGen collects and uses location data for the following purposes:

Transport Tracking
• School bus drivers share their real-time GPS location during active school trips
• Parents can view live bus location to track their child's transport for safety
• Location data is collected only during active school trips

Background Location
• The driver app collects location in the background while an active school trip is in progress
• Background location is required to continuously update bus position for parent tracking
• Location collection stops automatically when the trip ends

How We Use Location Data
• Location is used exclusively for school transport safety and monitoring
• Location data is displayed to parents of students assigned to that transport route
• Location data is never shared with unauthorized third parties
• Location data is never used for advertising purposes

Data Retention
• Real-time location data is updated continuously during trips
• Historical location data is automatically deleted after each trip ends
• No permanent location history is maintained

Driver Consent
• Drivers are informed about location collection before starting a trip
• Drivers must explicitly start a trip to enable location sharing
• Location sharing stops when trip is ended by the driver`
          },
          {
            title: '6. Camera',
            content: `IntelliGen uses camera access for the following purposes:

• Teachers can take photos directly within the app to share classroom moments with parents
• QR code scanning for student check-in and check-out at school entrance

Camera access is:
• Only activated when teacher explicitly taps the camera button
• Never used for background recording or surveillance
• Never used for facial recognition or biometric data collection
• Photos taken are shared only with authorized parents of students in that class`
          },
          {
            title: '7. Push Notifications',
            content: `IntelliGen sends push notifications for the following purposes:

• Attendance alerts when child is marked present or absent
• Transport updates when child boards or exits school bus
• Diary entries from teachers
• Fee payment reminders
• School announcements and events
• Birthday wishes
• Feedback responses from school management

You can control notifications:
• Through your device notification settings
• By contacting your school administrator

We do not send promotional or advertising notifications.`
          },
          {
            title: '8. Payment Data',
            content: `IntelliGen processes payments through GetePay payment gateway.

• We do not store credit card or debit card numbers
• We do not store UPI IDs or bank account details
• Payment data is processed directly by GetePay
• We only store payment status and transaction reference numbers
• Please refer to GetePay's privacy policy for details on payment data handling

Payment records including amount, date and status are retained for 7 years as required by financial regulations in India.`
          },
          {
            title: '9. Biometric Data',
            content: `IntelliGen does not collect or store any biometric data including:

• Facial recognition data
• Fingerprints
• Voice recordings
• Any other biometric identifiers

The app does not use any biometric authentication or identification features.`
          },
          {
            title: '10. Children\'s Privacy',
            content: `IntelliGen handles student data with the highest level of care. We acknowledge that our platform processes data relating to children under 13 years of age on behalf of educational institutions.

• Schools and parents are responsible for obtaining appropriate consents for student data
• We do not use student data for advertising or marketing purposes
• Student data is only used to provide educational management services
• We do not share student data with unauthorized third parties
• Schools retain ownership of all student data entered into the platform
• Parents may request access to or deletion of their child's data through their school administrator

We comply with applicable children's data protection laws in India including provisions under the Information Technology Act, 2000, its rules, and the Digital Personal Data Protection Act 2023.`
          },
          {
            title: '11. Data Security',
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
            title: '12. Data Breach Notification',
            content: `In the event of a data security breach that affects your personal information:

• We will notify affected school administrators within 72 hours of becoming aware
• Notification will be sent via email and in-app notification
• We will provide details of:
  - What data was affected
  - When the breach occurred
  - Steps we are taking to address it
  - Steps you can take to protect yourself
• We will report to relevant authorities as required by applicable Indian law
• We maintain an incident response plan to handle security breaches promptly`
          },
          {
            title: '13. Data Ownership',
            content: `Schools retain full ownership of all data entered into the intelliGen platform:

• Student records belong to the school
• Parent information belongs to the school
• Attendance and academic data belongs to the school
• intelliGen acts as a data processor only
• We process data on behalf of schools as per their instructions
• Schools can export all their data at any time through admin portal
• Upon termination we provide 30 days to export data before deletion
• We do not claim ownership of any school or student data`
          },
          {
            title: '14. Data Retention',
            content: `We retain personal data for as long as necessary to provide our services and comply with legal obligations:

• Active account data: Retained for the duration of your subscription
• Student records: Retained for the academic year plus 3 years after last activity
• Payment records: Retained for 7 years as required by financial regulations
• Communication logs: Retained for 2 years
• GPS location data: Deleted after each trip ends
• Deleted account data: Purged within 90 days of account termination

Schools may export their data at any time through the platform's reporting features. Upon subscription termination, we provide a 30-day window to export all data before deletion.`
          },
          {
            title: '15. Anonymous and Aggregate Data',
            content: `We may collect and use anonymized, non-identifiable data for:

• Improving platform performance
• Developing new features
• Statistical analysis
• Quality testing

This data:
• Cannot identify individual users
• Cannot identify individual schools
• Is never sold to third parties
• Is used only to improve intelliGen`
          },
          {
            title: '16. Your Rights',
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
            title: '17. Account Deletion',
            content: `You have the right to request deletion of your account and associated data:

Parents:
• Contact your school administrator to request data deletion
• School admin can remove parent account through admin portal

Schools:
• Contact us at getintelligen@gmail.com
• We will process deletion within 30 days
• You will have 30 days to export data first
• After deletion all data is permanently removed

Note: Some data may be retained for legal compliance purposes such as financial records as required by Indian tax laws.`
          },
          {
            title: '18. Opt-Out Rights',
            content: `You have the right to opt out of:

Communications:
• Marketing emails: Unsubscribe link in every email
• Push notifications: Manage through device notification settings
• In-app notifications: Contact school admin

Note: You cannot opt out of:
• Essential service notifications (attendance, fees, transport safety)
• These are core to the service

To opt out contact:
getintelligen@gmail.com`
          },
          {
            title: '19. Data Localisation',
            content: `IntelliGen stores all data on secure cloud servers.

• Database hosted on Supabase infrastructure
• Application hosted on Vercel cloud platform
• Data may be processed on servers located outside India
• We ensure appropriate safeguards are in place for cross-border data transfers
• We comply with applicable Indian data protection laws including the Digital Personal Data Protection Act 2023`
          },
          {
            title: '20. Cookies and Tracking',
            content: `We use minimal cookies and tracking technologies:

• Authentication cookies: Essential for maintaining your logged-in session
• Preference cookies: Remembering your language and display settings
• Analytics: Anonymous usage statistics to improve the platform

We do not use advertising cookies or track users across third-party websites. You can control cookie settings through your browser, though disabling essential cookies may affect platform functionality.`
          },
          {
            title: '21. Third-Party Links',
            content: `Our platform may contain links to third-party websites or services (such as payment gateways). We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party services you access through our platform.`
          },
          {
            title: '22. Changes to This Policy',
            content: `We may update this Privacy Policy periodically to reflect changes in our practices or applicable laws. We will notify users of significant changes via:

• Email notification to registered administrators
• In-app notification on next login
• Updated "Last modified" date on this page

Continued use of IntelliGen after notification of changes constitutes acceptance of the updated policy.`
          },
          {
            title: '23. Contact Us',
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
            © 2026 IntelliGen Technologies. All rights reserved.
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