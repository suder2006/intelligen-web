'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function SchoolAboutPage() {
  const params = useParams()
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSchool = async () => {
      const { data } = await supabase
        .from('schools')
        .select('name, school_address, school_contact_email, school_phone, slug')
        .eq('slug', params.slug)
        .single()
      setSchool(data)
      setLoading(false)
    }
    if (params.slug) fetchSchool()
  }, [params.slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
  )
  if (!school) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>School not found.</div>
  )

  // Time Kids specific content
  const isTimekids = params.slug === 'timekids-annanagar'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#38bdf8' }}>{school.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Powered by IntelliGen</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href={`/school/${school.slug}/privacy`} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Privacy</a>
          <a href={`/school/${school.slug}/terms`} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Terms</a>
          <a href={`/school/${school.slug}/refund`} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>Refund Policy</a>
          <a href='/landing' style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textDecoration: 'none' }}>IntelliGen</a>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '40px', fontWeight: '700', color: '#38bdf8', marginBottom: '12px' }}>{school.name}</div>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.7' }}>
            A warm, child-friendly preschool in Chennai — nurturing happiness in learning.
          </p>
        </div>

        {/* About */}
        <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', padding: '36px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#38bdf8', marginBottom: '14px' }}>About Us</h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: '1.8', marginBottom: '14px' }}>
            Time Kids Preschool – Anna Nagar is a warm, child-friendly preschool in Chennai, created for families who want a safe, joyful, and structured early learning experience for their little ones. We welcome children in the key early years — when curiosity is at its peak — and support parents with a transparent, nurturing environment.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: '1.8' }}>
            Our campus in Y Block, Anna Nagar is designed for play-based learning, age-appropriate routines, and gentle guidance. Children learn best when they feel secure, heard, and encouraged — so we focus on building confidence, social skills, independence, and strong foundational readiness.
          </p>
        </div>

        {/* Programs */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '20px' }}>📚 Programs We Offer</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { age: '1 – 1.5 years', name: 'Early Toddler Program', desc: 'Gentle introduction to structured play, sensory exploration and early social interaction.' },
              { age: '1.5 – 2 years', name: 'Parent Toddler Program', desc: 'Parent and child learn together through guided activities, building confidence and attachment.' },
              { age: '2 – 3 years', name: 'Playgroup', desc: 'Settling in, play routines, sensory exploration and early language development.' },
              { age: '3 – 4 years', name: 'Nursery', desc: 'Communication, fine motor skills, pre-writing readiness and social development.' },
              { age: '4 – 5 years', name: 'LKG', desc: 'Structured readiness, early numeracy and literacy foundations, creativity and expression.' },
              { age: '5 – 6 years', name: 'UKG', desc: 'School readiness, confident communication and independent learning habits.' },
              { age: '2 – 8 years', name: 'Daycare', desc: 'Safe, supervised and engaging environment for children after school hours.' },
            ].map(prog => (
              <div key={prog.name} style={{ display: 'flex', gap: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: '8px', padding: '6px 12px', color: '#38bdf8', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {prog.age}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{prog.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6' }}>{prog.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How We Teach */}
        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#a78bfa', marginBottom: '14px' }}>🎨 How We Teach</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8', marginBottom: '14px' }}>
            Our approach blends joyful play with structured learning goals. Children experience learning through:
          </p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              'Hands-on activities and learning corners',
              'Stories, music, movement, and art',
              'Sensory and fine-motor work for pre-writing skills',
              'Language-rich classroom conversations',
              'Group activities that develop sharing, turn-taking, and empathy',
              'Playway, Montessori, and Multiple Intelligence approaches',
            ].map(item => (
              <div key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                <span style={{ color: '#a78bfa', flexShrink: 0 }}>→</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Safety */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#34d399', marginBottom: '14px' }}>🛡️ Safety & Environment</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8' }}>
            A safe campus is essential for early learners. We maintain a child-friendly and secured setup with attention to cleanliness and supervision. Parents can visit the campus and experience the classroom environment during our open house sessions.
          </p>
        </div>

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

        {/* Contact */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '32px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '20px' }}>📍 Contact & Location</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              ['📍 Address', 'No. 2731, 7th Cross Street, 12th Main Rd, Y Block, Anna Nagar, Chennai – 600040, Tamil Nadu, India'],
              ['📞 Phone / WhatsApp', '+91 99629 28099'],
              ['✉️ Email', 'annanagartimekids@gmail.com'],
              ['🕐 Hours', 'Monday – Friday: 9 AM – 6 PM | Saturday: 9 AM – 2 PM'],
              ['🌐 Website', 'timekidspreschoolsannanagar.com'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', minWidth: '160px', flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.6' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '12px' }}>© 2025 {school.name}. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            <a href={`/school/${school.slug}/privacy`} style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
            <a href={`/school/${school.slug}/terms`} style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Terms & Conditions</a>
            <a href={`/school/${school.slug}/refund`} style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Refund Policy</a>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
            School management powered by <a href='/about' style={{ color: '#38bdf8', textDecoration: 'none' }}>IntelliGen</a>
          </p>
        </div>
      </div>
    </div>
  )
}