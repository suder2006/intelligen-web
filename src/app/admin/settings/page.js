'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/settings', label: 'School Settings', icon: '⚙️' },
]

export default function SchoolSettingsPage() {
  const { schoolId, schoolName } = useSchool()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '',
    website: '', primary_color: '#38bdf8',
    upi_id: '', upi_name: '', upi_description: ''
  })

  useEffect(() => { if (schoolId) fetchSchool() }, [schoolId])

  const fetchSchool = async () => {
    setLoading(true)
    const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single()
    setSchool(data)
    if (data) {
      setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        primary_color: data.primary_color || '#38bdf8',
        upi_id: data.upi_id || '',
        upi_name: data.upi_name || '',
        upi_description: data.upi_description || ''
      })
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('schools').update(form).eq('id', schoolId)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    await fetchSchool()
    setSaving(false)
  }

  const upiQrUrl = form.upi_id ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${form.upi_id}&pn=${encodeURIComponent(form.upi_name)}`)}`  : null

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '14px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; max-width: 1000px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 12px 28px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .section { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        label { color: #94a3b8; fontSize: 13px; display: block; margin-bottom: 6px; font-size: 13px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } .grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/settings' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>⚙️ School Settings</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>{schoolName}</p>
          </div>
          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save All Settings'}
          </button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* School Info */}
            <div className="section">
              <div className="section-title">🏫 School Information</div>
              <div className="grid-2">
                <div>
                  <label>School Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='School name' style={inputStyle} />
                </div>
                <div>
                  <label>Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder='school@example.com' style={inputStyle} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
                </div>
                <div>
                  <label>Website</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder='https://yourschool.com' style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Address</label>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder='Full address' style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="section">
              <div className="section-title">🎨 Branding</div>
              <div>
                <label>Primary Color</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
                  <input type='color' value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })}
                    style={{ width: '56px', height: '44px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
                  <input value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })}
                    style={{ ...inputStyle, marginBottom: 0, maxWidth: '160px' }} />
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: form.primary_color }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>This color appears throughout your school's portal</span>
                </div>
              </div>

              {/* Color Preview */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Preview:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button style={{ padding: '8px 20px', background: `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}dd)`, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px' }}>Primary Button</button>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', background: `${form.primary_color}22`, color: form.primary_color, fontWeight: '600', fontSize: '13px', border: `1px solid ${form.primary_color}44` }}>Badge</span>
                  <span style={{ color: form.primary_color, fontWeight: '700', fontSize: '16px' }}>Link Text</span>
                </div>
              </div>
            </div>

            {/* UPI Payment Settings */}
            <div className="section">
              <div className="section-title">💳 UPI Payment Settings</div>
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                ℹ️ Parents will use this UPI ID to pay fees. Make sure the details are correct before saving.
              </div>
              <div className="grid-2">
                <div>
                  <label>UPI ID *</label>
                  <input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder='e.g. school@icici or 9876543210@upi' style={inputStyle} />
                </div>
                <div>
                  <label>UPI Display Name *</label>
                  <input value={form.upi_name} onChange={e => setForm({ ...form, upi_name: e.target.value })} placeholder='e.g. Time Kids Preschool' style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Payment Description (optional)</label>
                  <input value={form.upi_description} onChange={e => setForm({ ...form, upi_description: e.target.value })} placeholder='e.g. School fees payment' style={inputStyle} />
                </div>
              </div>

              {/* UPI QR Preview */}
              {form.upi_id && form.upi_name && (
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', flexWrap: 'wrap' }}>
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'inline-block' }}>
                    <img src={upiQrUrl} alt='UPI QR' style={{ width: '120px', height: '120px', display: 'block' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{form.upi_name}</div>
                    <div style={{ color: '#38bdf8', fontSize: '14px', marginBottom: '4px' }}>{form.upi_id}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>This QR will be shown to parents when they pay fees</div>
                  </div>
                </div>
              )}
              {(!form.upi_id || !form.upi_name) && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  ⚠️ Enter UPI ID and Name above to see the payment QR preview
                </div>
              )}
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? '⏳ Saving...' : saved ? '✅ All Settings Saved!' : '💾 Save All Settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}