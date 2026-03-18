'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [step, setStep] = useState(1) // 1: school details, 2: admin details, 3: success
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    school_name: '', address: '', phone: '', email: '', website: '',
    admin_name: '', admin_email: '', admin_phone: ''
  })
  const router = useRouter()

  const submitRegistration = async () => {
    if (!form.school_name || !form.admin_name || !form.admin_email) {
      alert('Please fill all required fields'); return
    }
    setSaving(true)
    const { error } = await supabase.from('school_registrations').insert({
      school_name: form.school_name, address: form.address,
      phone: form.phone, email: form.email, website: form.website,
      admin_name: form.admin_name, admin_email: form.admin_email,
      admin_phone: form.admin_phone, status: 'pending'
    })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setStep(3)
    setSaving(false)
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '14px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '32px', marginBottom: '8px' }}>Intelli<span style={{ color: '#38bdf8' }}>Gen</span></div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Preschool Management Platform</div>
        </div>

        {step === 3 ? (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontWeight: '700', fontSize: '22px', marginBottom: '8px' }}>Registration Submitted!</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Thank you for registering <strong style={{ color: '#fff' }}>{form.school_name}</strong>!<br/>
              Our team will review your application and get back to you within 24 hours.
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              📧 We'll send login credentials to <strong style={{ color: '#38bdf8' }}>{form.admin_email}</strong> once approved.
            </div>
            <button onClick={() => router.push('/')}
              style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
              Back to Login
            </button>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '32px' }}>
            {/* Progress */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
              {[1, 2].map(s => (
                <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= s ? '#38bdf8' : 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>

            {step === 1 && (
              <>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>🏫 School Details</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>Tell us about your school</p>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>School Name *</label>
                <input value={form.school_name} onChange={e => setForm({ ...form, school_name: e.target.value })} placeholder='e.g. Time Kids Preschool' style={inputStyle} autoFocus />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder='Full address' style={inputStyle} />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Phone *</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>School Email *</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder='school@example.com' style={inputStyle} />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Website (optional)</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder='https://yourschool.com' style={inputStyle} />
                <button onClick={() => { if (!form.school_name || !form.phone || !form.email) { alert('Please fill required fields'); return } setStep(2) }}
                  style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
                  Next → Admin Details
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>👤 Admin Account</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>Who will manage this school on IntelliGen?</p>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Admin Name *</label>
                <input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} placeholder='Full name' style={inputStyle} autoFocus />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Admin Email *</label>
                <input value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} placeholder='admin@yourschool.com' style={inputStyle} />
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Admin Phone</label>
                <input value={form.admin_phone} onChange={e => setForm({ ...form, admin_phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  ℹ️ Login credentials will be sent to the admin email after approval.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
                  <button onClick={submitRegistration} disabled={saving}
                    style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
                    {saving ? '⏳ Submitting...' : '🚀 Submit Registration'}
                  </button>
                </div>
              </>
            )}

            <div style={{ textAlign: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
              Already have an account? <a href='/' style={{ color: '#38bdf8', textDecoration: 'none' }}>Login here</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}