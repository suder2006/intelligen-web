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

export default async function SchoolTerms({ params }) {
  const school = await getSchool(params.slug)
  if (!school) notFound()

  const color = school.primary_color || '#38bdf8'

  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: `By enrolling your child at ${school.name} or using our parent portal, you agree to these Terms and Conditions. These terms form a binding agreement between you (parent/guardian) and ${school.name}.

If you do not agree with any part of these terms, please contact the school office before completing enrollment.`
    },
    {
      title: '2. Enrollment and Admission',
      content: `Admission Process
• Admission to ${school.name} is subject to availability of seats and fulfillment of admission criteria
• The school reserves the right to accept or decline any admission application
• All information provided during enrollment must be accurate and complete
• Submission of false information may result in immediate cancellation of enrollment

Required Documents
• Birth certificate of the child
• Proof of address
• Passport-size photographs
• Previous school records (if applicable)
• Medical/immunization records as required

Enrollment Confirmation
• Enrollment is confirmed only upon receipt of the admission fee and required documents
• Seat reservation is not guaranteed until the admission fee is paid`
    },
    {
      title: '3. Fees and Payments',
      content: `Fee Structure
• Fee structure is communicated at the time of admission and is subject to annual revision
• Fees must be paid by the due dates specified in the fee schedule
• Late payments may attract a late fee as communicated by the school

Payment Methods
• Online payment through our parent portal (powered by IntelliGen/GetePay)
• Cash or bank transfer at the school office

Fee Revisions
• The school reserves the right to revise fees with reasonable notice
• Fee revision notices will be communicated at least 30 days in advance
• Continued enrollment after notice constitutes acceptance of revised fees

Outstanding Fees
• Students with outstanding fees may be denied certain services
• Persistent non-payment may result in withdrawal from enrollment
• The school is not responsible for any disruption to education due to unpaid fees`
    },
    {
      title: '4. Refund and Cancellation',
      content: `Please refer to our Refund and Cancellation Policy for complete details. Key points:

• Admission fees are strictly non-refundable once enrollment is confirmed
• Fees paid for a term are non-refundable after the term has commenced
• In case of withdrawal before the term begins, a processing fee will be deducted
• Medical emergencies or relocation cases will be reviewed individually by school management
• No refund is applicable after the child has attended classes for more than 7 days in a term`
    },
    {
      title: '5. Attendance and Punctuality',
      content: `Attendance Requirements
• Regular attendance is essential for your child's development
• Parents must notify the school of absences through the parent portal or by phone
• Absence notifications should be submitted before 9:00 AM on the day of absence
• Prolonged absence without notice may affect enrollment status

Timings
• School timings are communicated at enrollment and may be revised with notice
• Children should be dropped off and picked up on time
• The school is not responsible for children left beyond school hours without prior arrangement

Late Arrival
• Consistent late arrivals may affect your child's learning experience
• Parents will be informed if late arrival becomes a concern`
    },
    {
      title: '6. Parent Responsibilities',
      content: `As a parent or guardian, you agree to:

• Provide accurate and up-to-date contact and medical information
• Notify the school immediately of any changes to contact details
• Inform the school of any medical conditions, allergies, or special needs
• Ensure your child attends school regularly and punctually
• Treat school staff with respect and courtesy
• Participate in Parent-Teacher Meetings (PTM) when requested
• Support the school's policies and code of conduct
• Not share your parent portal credentials with unauthorized persons`
    },
    {
      title: '7. Student Conduct and Discipline',
      content: `Code of Conduct
${school.name} expects all students to:
• Treat teachers, staff, and fellow students with respect
• Take care of school property and materials
• Follow instructions from teachers and school staff
• Behave safely and responsibly on school premises and during transport

Disciplinary Actions
• Minor misconduct will be addressed through counseling and communication with parents
• Serious or repeated misconduct may result in suspension or withdrawal from enrollment
• The school's decision on disciplinary matters is final

Bullying and Harassment
We have a zero-tolerance policy for bullying, harassment, or any form of discrimination. Incidents will be investigated and appropriate action will be taken.`
    },
    {
      title: '8. Transport Services',
      content: `If your child uses our school transport service:

• Parents will receive real-time notifications when their child boards or alights the vehicle
• Parents must confirm receipt of their child via the parent portal
• Any changes to transport arrangements must be communicated to the school in advance
• The school is not responsible for delays due to traffic or unforeseen circumstances
• Transport fees are separate from tuition fees and are non-refundable once the term begins`
    },
    {
      title: '9. Communication and Media',
      content: `Parent Portal
• Our parent portal (IntelliGen) is provided for communication and information sharing
• Parents should regularly check the portal for announcements and messages
• The school is not responsible for missed communications if the portal is not monitored

Photography and Media
• The school may photograph students for educational documentation and classroom moments
• Photos shared through the parent portal are for personal use only
• Parents must not share photos of other students on social media without consent
• Separate written consent will be sought for any public or promotional use of photographs`
    },
    {
      title: '10. Health and Safety',
      content: `Medical Information
• Parents must disclose all relevant medical conditions, allergies, and special needs
• The school must be notified of any changes in a child's health conditions
• Prescribed medications must be accompanied by a written request from parents

Illness Policy
• Children who are unwell should not be sent to school
• Children showing signs of illness at school may be isolated and parents will be contacted
• The school follows applicable health guidelines for communicable diseases

Emergency Procedures
• In case of a medical emergency, the school will contact parents immediately
• If parents are unreachable, we will contact the emergency contact provided
• The school may seek emergency medical assistance if required`
    },
    {
      title: '11. Withdrawal from School',
      content: `Voluntary Withdrawal
• Parents wishing to withdraw their child must provide written notice at least 30 days in advance
• A withdrawal form must be completed at the school office
• Fees for the notice period are payable regardless of whether the child attends
• Transfer certificates and records will be issued after clearance of all dues

School-Initiated Withdrawal
The school reserves the right to withdraw a student's enrollment for:
• Persistent non-payment of fees
• Serious breach of the code of conduct
• Provision of false information during admission
• Any action that compromises the safety or wellbeing of students or staff`
    },
    {
      title: '12. Limitation of Liability',
      content: `${school.name} will take all reasonable precautions for the safety of students. However:

• The school is not liable for injuries resulting from accidents despite reasonable supervision
• The school is not liable for loss or damage to personal belongings
• Parents are advised not to send children with expensive items or large amounts of cash
• The school is not liable for any indirect or consequential losses arising from our services

We maintain appropriate insurance coverage for school operations.`
    },
    {
      title: '13. Amendments to Terms',
      content: `${school.name} reserves the right to amend these Terms and Conditions. Parents will be notified of significant changes through:

• Notice in the parent portal
• Written communication to registered contact
• Notice displayed on the school premises

Continued enrollment after notification of changes constitutes acceptance.`
    },
    {
      title: '14. Contact Information',
      content: `For any questions about these Terms, please contact:

${school.name}
${school.school_address || ''}
Email: ${school.school_contact_email || ''}
${school.school_phone ? `Phone: ${school.school_phone}` : ''}`
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
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Terms & Conditions</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: June 2025</p>
          <div style={{ marginTop: '12px', padding: '10px 16px', background: `${color}15`, border: `1px solid ${color}30`, borderRadius: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            These terms apply to enrollment and services at {school.name}.
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
            <a href={`/school/${school.slug}/privacy`} style={{ color: color, fontSize: '13px' }}>Privacy Policy</a>
            <a href={`/school/${school.slug}/refund`} style={{ color: color, fontSize: '13px' }}>Refund Policy</a>
            <a href='/landing' style={{ color: color, fontSize: '13px' }}>IntelliGen Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}