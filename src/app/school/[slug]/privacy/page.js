import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

async function getSchool(slug) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data } = await supabase
    .from('schools')
    .select('name, school_address, school_contact_email, school_phone, slug, primary_color')
    .eq('slug', slug)
    .single()
  return data
}

export default async function SchoolPrivacyPolicy({ params }) {
  const school = await getSchool(params.slug)
  if (!school) notFound()

  const color = school.primary_color || '#38bdf8'

  const sections = [
    {
      title: '1. Introduction',
      content: `${school.name} ("School", "we", "our", "us") is committed to protecting the privacy of children, parents, guardians, and staff who interact with our institution.

This Privacy Policy explains how we collect, use, store, and protect personal information when you enrol your child at our school, use our parent communication portal (powered by IntelliGen), or interact with us in any capacity.

By enrolling your child or using our parent portal, you consent to the practices described in this policy.`
    },
    {
      title: '2. Information We Collect',
      content: `We collect the following personal information:

Student Information
• Full name, date of birth, gender, and photograph
• Home address and emergency contact details
• Medical conditions, allergies, and health notes
• Attendance and academic progress records
• Transport and check-in/check-out records

Parent / Guardian Information
• Full name, relationship to child, and contact details
• Email address and mobile number for communication
• Payment and fee transaction records

How We Collect Information
• Enrollment forms and admission applications
• Parent communication portal (IntelliGen)
• Direct communication with school staff
• Payment transactions through our fee portal`
    },
    {
      title: '3. How We Use Your Information',
      content: `We use the information we collect for the following purposes:

Educational Purposes
• Managing student enrollment, attendance, and academic records
• Communicating your child's daily activities, diary entries, and progress
• Sending important school announcements and notices
• Sharing curriculum plans and weekly newsletters

Safety and Welfare
• Monitoring student check-in and check-out at school premises
• Managing transport safety and notifying parents of travel status
• Contacting you in case of emergencies

Administrative Purposes
• Processing fee payments and issuing receipts
• Managing Parent-Teacher Meeting (PTM) bookings
• Maintaining school records as required by law
• Improving our educational programs and services`
    },
    {
      title: '4. Information Sharing',
      content: `We do not sell or rent your personal information to any third party.

We may share information with:
• Teachers and staff: To provide educational services to your child
• School management: For administrative and compliance purposes
• IntelliGen (our school management platform provider): To operate our parent portal and communication tools. IntelliGen processes data on our behalf and is bound by their privacy policy
• Payment processors: GetePay processes fee payments securely
• Government authorities: When required by law or regulation

We ensure all parties handling your data maintain appropriate security standards.`
    },
    {
      title: '5. Children\'s Privacy',
      content: `The privacy and safety of children in our care is our highest priority.

• We only collect information about children that is necessary for educational purposes
• Student photographs shared through our portal are only visible to authorized parents and staff
• We do not share student images or information on public social media without explicit parental consent
• Children's academic and medical records are kept strictly confidential
• Access to student data within our portal is restricted to relevant staff and the child's parents/guardians`
    },
    {
      title: '6. Data Security',
      content: `We take reasonable steps to protect your personal information:

• All data is stored on secure cloud servers with encryption
• Our parent portal uses HTTPS encryption for all data transmission
• Access to student records is protected by password and role-based permissions
• Only authorized school staff can access student and parent data
• Payment transactions are processed through PCI-compliant payment gateways

While we implement these safeguards, no system is completely secure. Please contact us immediately if you suspect any unauthorized access to your information.`
    },
    {
      title: '7. Data Retention',
      content: `We retain personal data for as long as necessary:

• Student records: Retained for the duration of enrollment plus 5 years
• Payment records: Retained for 7 years as required by law
• Communication records: Retained for 2 years
• Records of former students: Retained as required by educational regulations

You may request deletion of your personal data subject to our legal obligations.`
    },
    {
      title: '8. Your Rights',
      content: `As a parent or guardian, you have the right to:

• Access the personal information we hold about your child and yourself
• Request correction of any inaccurate information
• Request deletion of information we no longer need (subject to legal obligations)
• Withdraw consent for optional communications (e.g. marketing)
• Receive a copy of your data in a portable format

To exercise any of these rights, please contact us at ${school.school_contact_email || 'the school office'}.`
    },
    {
      title: '9. Photographs and Media',
      content: `We may take photographs and videos of students for:
• Classroom moments shared with parents through the parent portal
• School events and activities documentation
• Progress and portfolio documentation

Photographs shared through our parent portal are only accessible to the child's registered parents/guardians. We will seek separate consent before using any images for marketing, website, or promotional purposes.`
    },
    {
      title: '10. Changes to This Policy',
      content: `We may update this Privacy Policy from time to time. We will notify parents of significant changes through:
• SMS or email notification
• Notice in the parent portal
• Notice at the school premises

Continued use of our services after changes indicates your acceptance of the updated policy.`
    },
    {
      title: '11. Contact Us',
      content: `For any privacy-related questions or requests, please contact:

${school.name}
${school.school_address || ''}
Email: ${school.school_contact_email || ''}
${school.school_phone ? `Phone: ${school.school_phone}` : ''}

We are committed to addressing your concerns promptly.`
    }
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", padding: '48px 24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', color: color }}>
            {school.name}
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: June 2025</p>
          <div style={{ marginTop: '12px', padding: '10px 16px', background: `${color}15`, border: `1px solid ${color}30`, borderRadius: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            This policy applies to {school.name}. For the IntelliGen platform privacy policy, visit <a href='/privacy-policy' style={{ color: color }}>intelligenapp.com/privacy-policy</a>
          </div>
        </div>

        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: color, marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${color}30` }}>
              {section.title}
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
              {section.content}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px', background: `${color}10`, border: `1px solid ${color}20`, borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '8px' }}>
            © 2025 {school.name}. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`/school/${school.slug}/terms`} style={{ color: color, fontSize: '13px' }}>Terms & Conditions</a>
            <a href={`/school/${school.slug}/refund`} style={{ color: color, fontSize: '13px' }}>Refund Policy</a>
            <a href='/landing' style={{ color: color, fontSize: '13px' }}>IntelliGen Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}