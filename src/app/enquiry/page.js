'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

const VISIT_SLOTS = ['12:30 PM', '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM']
const MAX_PER_SLOT = 3

const getSuggestedProgram = (dob) => {
  if (!dob) return ''
  const today = new Date()
  const birth = new Date(dob)
  const ageMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth())
  if (ageMonths < 18) return 'Too Young'
  if (ageMonths < 30) return 'Playgroup'
  if (ageMonths < 42) return 'Nursery'
  if (ageMonths < 54) return 'LKG'
  if (ageMonths < 72) return 'UKG'
  return 'Too Old'
}

const getAgeText = (dob) => {
  if (!dob) return ''
  const today = new Date()
  const birth = new Date(dob)
  const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth())
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return y > 0 ? `${y}y ${m}m` : `${m} months`
}

function EnquiryContent() {
  const searchParams = useSearchParams()
  const schoolParam = searchParams.get('school')
  const [school, setSchool] = useState(null)
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  const [slotAvailability, setSlotAvailability] = useState({})
  const [enquiryId, setEnquiryId] = useState(null)
  const [step, setStep] = useState(1)

  const [form, setForm] = useState({
    parent_name: '', phone: '', email: '',
    child_name: '', child_dob: '',
    program: '', lead_source: 'walk-in',
    preferred_visit_date: '', notes: ''
  })

  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    slot_time: ''
  })

  const suggestedProgram = getSuggestedProgram(form.child_dob)
  const ageText = getAgeText(form.child_dob)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      if (schoolParam) {
        const { data: schoolData } = await supabase.from('schools').select('*').eq('id', schoolParam).single()
        setSchool(schoolData)
        const { data: progsData } = await supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolParam).order('value')
        setPrograms(progsData?.map(p => p.value) || [])
      }
      setLoading(false)
    }
    init()
  }, [schoolParam])

  useEffect(() => {
    if (suggestedProgram && suggestedProgram !== 'Too Young' && suggestedProgram !== 'Too Old') {
      setForm(f => ({ ...f, program: suggestedProgram }))
    }
  }, [suggestedProgram])

  useEffect(() => {
    if (visitForm.visit_date && schoolParam) fetchSlotAvailability()
  }, [visitForm.visit_date])

  const fetchSlotAvailability = async () => {
    const { data } = await supabase.from('visit_bookings')
      .select('slot_time').eq('school_id', schoolParam)
      .eq('visit_date', visitForm.visit_date).eq('status', 'scheduled')
    const counts = {}
    VISIT_SLOTS.forEach(s => counts[s] = 0)
    ;(data || []).forEach(b => { if (counts[b.slot_time] !== undefined) counts[b.slot_time]++ })
    setSlotAvailability(counts)
  }

  const checkDuplicate = async () => {
    if (!form.phone || form.phone.length < 10) return
    const { data } = await supabase.from('enquiries')
      .select('*').eq('school_id', schoolParam).eq('phone', form.phone).limit(1)
    if (data && data.length > 0) setDuplicate(data[0])
    else setDuplicate(null)
  }

const submitEnquiry = async () => {
    if (!form.parent_name || !form.phone || !form.child_name) {
      alert('Please fill Parent Name, Phone and Child Name'); return
    }
    if (!schoolParam) { alert('Invalid school link'); return }
    setSubmitting(true)

    try {
      const res = await fetch('https://wmxywsbrfbmyatzaehre.supabase.co/functions/v1/submit-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolParam,
          parent_name: form.parent_name,
          phone: form.phone,
          email: form.email,
          child_name: form.child_name,
          child_dob: form.child_dob,
          program: form.program,
          lead_source: form.lead_source,
          preferred_visit_date: form.preferred_visit_date,
          notes: form.notes
        })
      })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setSubmitting(false); return }
      setEnquiryId(data.enquiry_id)
      setSubmitting(false)
      setStep(2)
    } catch (e) {
      alert('Error: ' + e.message)
      setSubmitting(false)
    }
  }

const bookVisit = async () => {
    if (!visitForm.slot_time) { alert('Please select a time slot'); return }
    setSubmitting(true)

    try {
      const res = await fetch('https://wmxywsbrfbmyatzaehre.supabase.co/functions/v1/submit-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolParam,
          parent_name: form.parent_name,
          phone: form.phone,
          child_name: form.child_name,
          enquiry_id: enquiryId,
          visit_date: visitForm.visit_date,
          slot_time: visitForm.slot_time,
          update_visit_only: true
        })
      })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setSubmitting(false); return }
      setSubmitting(false)
      setStep(3)
    } catch (e) {
      alert('Error: ' + e.message)
      setSubmitting(false)
    }
  }

  const skipVisit = () => setStep(3)

  const primaryColor = school?.primary_color || '#0ea5e9'

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    backgroundColor: '#fff', color: '#1e293b',
    border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '15px', outline: 'none',
    fontFamily: "'DM Sans', sans-serif", marginBottom: '14px'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ color: '#64748b' }}>Loading...</div>
    </div>
  )

  if (!school) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏫</div>
        <div style={{ fontSize: '18px', fontWeight: '600' }}>Invalid school link</div>
        <div style={{ fontSize: '14px', marginTop: '8px' }}>Please use the correct enquiry link provided by the school.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, textarea:focus { border-color: ${primaryColor} !important; box-shadow: 0 0 0 3px ${primaryColor}22; }
        .slot-btn { padding: 12px 16px; border-radius: 10px; border: 2px solid #e2e8f0; background: #fff; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.2s; text-align: center; }
        .slot-btn.selected { border-color: ${primaryColor}; background: ${primaryColor}15; color: ${primaryColor}; }
        .slot-btn.full { opacity: 0.5; cursor: not-allowed; background: #f1f5f9; }
        .slot-btn:hover:not(.full):not(.selected) { border-color: ${primaryColor}; }
      `}</style>

      {/* Header */}
      <div style={{ background: primaryColor, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {school.logo_url && <img src={school.logo_url} alt='logo' style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />}
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', color: '#fff', fontWeight: '700' }}>{school.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>Admission Enquiry</div>
        </div>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 20px' }}>

        {/* STEP 1 - Enquiry Form */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>👶</div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Book an Enquiry</h1>
              <p style={{ color: '#64748b', fontSize: '14px' }}>Fill in the details below and we'll get back to you shortly</p>
            </div>

            {/* Duplicate warning */}
            {duplicate && (
              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                ⚠️ We already have an enquiry from this phone number ({duplicate.parent_name} - {new Date(duplicate.created_at).toLocaleDateString()}). Submitting will be recorded as a follow-up enquiry.
              </div>
            )}

            {/* Parent Details */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '16px' }}>👪 Parent Details</div>
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Parent Name *</label>
              <input value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} placeholder='e.g. Priya Sharma' style={inputStyle} />
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Phone Number *</label>
              <input type='tel' value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} onBlur={checkDuplicate} placeholder='+91 98765 43210' style={inputStyle} />
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email (optional)</label>
              <input type='email' value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder='parent@email.com' style={inputStyle} />
            </div>

            {/* Child Details */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '16px' }}>👶 Child Details</div>
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Child Name *</label>
              <input value={form.child_name} onChange={e => setForm({ ...form, child_name: e.target.value })} placeholder="Child's full name" style={inputStyle} />
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date of Birth</label>
              <input type='date' value={form.child_dob} onChange={e => setForm({ ...form, child_dob: e.target.value })}
                max={new Date().toISOString().split('T')[0]} style={inputStyle} />

              {/* Age + Program suggestion */}
              {form.child_dob && (
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>Age</div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{ageText}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>Suggested Program</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: suggestedProgram === 'Too Young' || suggestedProgram === 'Too Old' ? '#ef4444' : primaryColor }}>
                      {suggestedProgram || '—'}
                    </div>
                  </div>
                </div>
              )}

              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Program</label>
              <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} style={inputStyle}>
                <option value=''>-- Select Program --</option>
                {programs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Additional Details */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '16px' }}>📋 Additional Details</div>
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>How did you hear about us?</label>
              <select value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })} style={inputStyle}>
                <option value='walk-in'>Walk-in</option>
                <option value='google_ads'>Google Ads</option>
                <option value='meta_ads'>Facebook/Instagram Ads</option>
                <option value='referral'>Referral</option>
                <option value='website'>Website</option>
                <option value='other'>Other</option>
              </select>
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Preferred Visit Date (optional)</label>
              <input type='date' value={form.preferred_visit_date} onChange={e => setForm({ ...form, preferred_visit_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]} style={inputStyle} />
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Any Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder='Any questions or special requirements...' rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <button onClick={submitEnquiry} disabled={submitting}
              style={{ width: '100%', padding: '16px', background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`, border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              {submitting ? '⏳ Submitting...' : '📤 Submit Enquiry'}
            </button>
          </>
        )}

        {/* STEP 2 - Visit Booking */}
        {step === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>Enquiry Submitted!</h2>
              <p style={{ color: '#64748b', fontSize: '14px' }}>Would you like to book a school visit?</p>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b', marginBottom: '16px' }}>📅 Book a School Visit</div>
              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Visit Date</label>
              <input type='date' value={visitForm.visit_date} onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value, slot_time: '' })}
                min={new Date().toISOString().split('T')[0]} style={inputStyle} />

              <label style={{ color: '#64748b', fontSize: '13px', display: 'block', marginBottom: '10px' }}>Select Time Slot</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
                {VISIT_SLOTS.map(slot => {
                  const count = slotAvailability[slot] || 0
                  const isFull = count >= MAX_PER_SLOT
                  const isSelected = visitForm.slot_time === slot
                  const remaining = MAX_PER_SLOT - count
                  return (
                    <button key={slot} onClick={() => !isFull && setVisitForm({ ...visitForm, slot_time: slot })}
                      className={`slot-btn ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}`}
                      style={{ borderColor: isSelected ? primaryColor : isFull ? '#e2e8f0' : '#e2e8f0', background: isSelected ? `${primaryColor}15` : isFull ? '#f1f5f9' : '#fff', color: isSelected ? primaryColor : isFull ? '#94a3b8' : '#1e293b' }}>
                      <div>{slot}</div>
                      <div style={{ fontSize: '11px', marginTop: '2px', color: isFull ? '#ef4444' : '#10b981', fontWeight: '500' }}>
                        {isFull ? 'Full' : `${remaining} left`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={bookVisit} disabled={submitting || !visitForm.slot_time}
              style={{ width: '100%', padding: '16px', background: visitForm.slot_time ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` : '#e2e8f0', border: 'none', borderRadius: '12px', color: visitForm.slot_time ? '#fff' : '#94a3b8', fontSize: '16px', fontWeight: '700', cursor: visitForm.slot_time ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}>
              {submitting ? '⏳ Booking...' : '✅ Confirm Visit Booking'}
            </button>
            <button onClick={skipVisit}
              style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Skip for now — I'll visit later
            </button>
          </>
        )}

        {/* STEP 3 - Success */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Thank You!</h2>
            <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '24px', lineHeight: '1.6' }}>
              Your enquiry has been submitted successfully. Our team will contact you shortly.
            </p>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontWeight: '600', color: '#166534', marginBottom: '8px' }}>What happens next?</div>
              <div style={{ color: '#166534', fontSize: '14px', lineHeight: '1.8' }}>
                ✅ Our team will call you within 1 hour<br/>
                ✅ We'll confirm your visit (if booked)<br/>
                ✅ You'll receive all admission details
              </div>
            </div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              📞 {school.phone || 'Contact us for more information'}<br/>
              ✉️ {school.email || ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EnquiryPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', color: '#64748b' }}>
        Loading...
      </div>
    }>
      <EnquiryContent />
    </Suspense>
  )
}