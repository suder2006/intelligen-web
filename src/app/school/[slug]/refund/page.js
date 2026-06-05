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

export default async function SchoolRefundPolicy({ params }) {
  const school = await getSchool(params.slug)
  if (!school) notFound()

  const color = school.primary_color || '#38bdf8'

  const sections = [
    {
      title: '1. Overview',
      content: `This Refund and Cancellation Policy applies to all fees paid to ${school.name} ("School") for educational services, programs, and activities.

Please read this policy carefully before completing enrollment or making any payment. By enrolling your child and making a payment, you acknowledge and agree to this policy.

This policy covers:
• Admission and registration fees
• Tuition and program fees
• Activity and material fees
• Transport fees
• Any other fees charged by the school`
    },
    {
      title: '2. No Refund Policy',
      content: `${school.name} operates a strict No Refund Policy once enrollment is confirmed.

Admission Fees
• Admission fees are completely non-refundable under any circumstances
• This includes registration fees, enrollment fees, and seat reservation fees
• Payment of the admission fee confirms your acceptance of this no-refund policy

Tuition and Program Fees
• Fees paid for any term, semester, or academic year are non-refundable once enrollment is confirmed
• No refund will be issued if your child:
  — Withdraws from school after enrollment confirmation
  — Is absent for extended periods
  — Does not attend classes after enrollment
  — Is withdrawn due to disciplinary reasons
  — Relocates to another city or country

Activity and Material Fees
• Fees paid for activities, workshops, field trips, and materials are non-refundable
• This applies even if the child does not participate in the activity

Transport Fees
• Transport fees paid for a term are non-refundable once the term commences
• Discontinuation of transport mid-term does not entitle a refund`
    },
    {
      title: '3. Exceptions to the No Refund Policy',
      content: `Refunds will ONLY be considered in the following exceptional circumstances, subject to school management review and approval:

School Closure or Cancellation
• If the school closes permanently or cancels a program before it commences, a pro-rata refund will be issued for the unused period

Medical Emergencies
• In cases of serious medical conditions preventing a child from attending school, a written request supported by a medical certificate from a registered doctor may be considered
• Such requests must be submitted within 15 days of the last day of attendance
• The school management's decision on such requests is final

Relocation
• Families relocating more than 50 km from the school may submit a refund request
• Proof of relocation (rental/ownership document or transfer letter) is required
• A processing fee equivalent to one month's fees will be deducted from any approved refund

These exceptions are considered at the sole discretion of school management and are not guaranteed.`
    },
    {
      title: '4. Withdrawal Process',
      content: `If you choose to withdraw your child from ${school.name}:

Step 1 — Submit Written Notice
• Provide written withdrawal notice at least 30 days in advance
• Submit the withdrawal form available at the school office
• Email: ${school.school_contact_email || 'the school office'}

Step 2 — Fees During Notice Period
• Fees for the notice period are payable regardless of attendance
• Outstanding fees must be cleared before withdrawal is processed

Step 3 — Documentation
• Transfer certificate and school records will be issued only after:
  — All outstanding dues are cleared
  — School property is returned (if any)
  — Withdrawal form is duly completed

Step 4 — Confirmation
• Withdrawal is confirmed only after school management processes the request
• Processing may take 7–10 working days`
    },
    {
      title: '5. Fee Payment Disputes',
      content: `Payment Errors
In the rare event of a technical error causing a duplicate or incorrect charge through our online payment portal:

• Contact us within 48 hours of the transaction
• Email: ${school.school_contact_email || ''}
• Provide your transaction ID and payment details
• Valid payment errors will be refunded within 7–10 business days

Disputes
• Fee disputes must be raised in writing within 15 days of the payment date
• Disputes raised after 15 days will not be considered
• The school management's decision on fee disputes is final

For payment-related technical issues on the IntelliGen platform, contact IntelliGen support at getintelligen@gmail.com`
    },
    {
      title: '6. Advance Fee Payments',
      content: `Annual and Advance Payments
• Some families opt to pay fees annually or for multiple terms in advance
• Advance payments are subject to the same no-refund policy
• In case of school-initiated cancellation of services, pro-rata refunds will be considered for advance payments only

Fee Adjustments
• The school reserves the right to adjust fees with 30 days advance notice
• If fees are revised after advance payment, any difference will be adjusted in future invoices or collected separately`
    },
    {
      title: '7. Scholarship and Concession',
      content: `Fee Concessions
• Fee concessions or scholarships, if granted, are subject to annual review
• Concessions are not transferable and cannot be combined unless explicitly stated
• Misrepresentation of information to obtain a concession will result in immediate withdrawal of the concession and recovery of the waived amount

Sibling Discounts
• Sibling discounts, if applicable, are communicated at the time of enrollment
• Withdrawal of one sibling does not affect the fee structure of the other`
    },
    {
      title: '8. Contact for Refund Queries',
      content: `For any questions about fees or this refund policy, please contact:

${school.name}
${school.school_address || ''}
Email: ${school.school_contact_email || ''}
${school.school_phone ? `Phone: ${school.school_phone}` : ''}

School Office Hours: Monday – Saturday, 8:30 AM – 4:30 PM

We are committed to addressing all fee-related queries promptly and fairly. Please note that all decisions regarding refunds are at the discretion of school management and are final.`
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
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Refund & Cancellation Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Last updated: June 2025</p>

          {/* Important Notice Box */}
          <div style={{ marginTop: '16px', padding: '16px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px' }}>
            <div style={{ color: '#f87171', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>⚠️ Important Notice</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.6' }}>
              {school.name} operates a <strong>No Refund Policy</strong>. All fees paid are non-refundable once enrollment is confirmed. Please read this policy in full before making any payment.
            </div>
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
            <a href={`/school/${school.slug}/terms`} style={{ color: color, fontSize: '13px' }}>Terms & Conditions</a>
            <a href='/landing' style={{ color: color, fontSize: '13px' }}>IntelliGen Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}