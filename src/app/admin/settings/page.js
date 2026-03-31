'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'



export default function SchoolSettingsPage() {
  const { schoolId, schoolName } = useSchool()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [school, setSchool] = useState(null)
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '',
    website: '', primary_color: '#38bdf8',
    upi_id: '', upi_name: '', upi_description: '',
    payment_method: 'upi',
    razorpay_key_id: '', razorpay_key_secret: '',
    payu_merchant_key: '', payu_merchant_salt: ''
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
        upi_description: data.upi_description || '',
        payment_method: data.payment_method || 'upi',
        razorpay_key_id: data.razorpay_key_id || '',
        razorpay_key_secret: data.razorpay_key_secret || '',
        payu_merchant_key: data.payu_merchant_key || '',
        payu_merchant_salt: data.payu_merchant_salt || ''
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
        
        .main { margin-left: 240px; flex: 1; padding: 32px; max-width: 1000px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 12px 28px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .section { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        label { color: #94a3b8; fontSize: 13px; display: block; margin-bottom: 6px; font-size: 13px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } .grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <AdminSidebar />

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
             {/* Payment Gateway Settings */}
            <div className="section">
              <div className="section-title">💳 Payment Gateway</div>
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                ℹ️ Configure how parents pay fees. You can enable UPI, Razorpay, or both. Payment gateway integration will be activated once configured.
              </div>

              {/* Payment Method Selector */}
              <label>Payment Method</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { value: 'upi', label: '📱 UPI Only' },
                  { value: 'razorpay', label: '💳 Razorpay Only' },
                  { value: 'payu', label: '💳 PayU Only' },
                  { value: 'both', label: '📱💳 UPI + Razorpay' },
                ].map(opt => (
                  <button key={opt.value} type='button' onClick={() => setForm({ ...form, payment_method: opt.value })}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: `1px solid ${form.payment_method === opt.value ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: form.payment_method === opt.value ? 'rgba(56,189,248,0.15)' : 'transparent', color: form.payment_method === opt.value ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* UPI Section */}
              {['upi', 'both'].includes(form.payment_method) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '14px', color: '#38bdf8' }}>📱 UPI Settings</div>
                  <div className="grid-2">
                    <div>
                      <label>UPI ID *</label>
                      <input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder='e.g. school@icici' style={inputStyle} />
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
                  {form.upi_id && form.upi_name && (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <div style={{ background: '#fff', borderRadius: '10px', padding: '10px' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${form.upi_id}&pn=${encodeURIComponent(form.upi_name)}`)}`} alt='UPI QR' style={{ width: '100px', height: '100px', display: 'block' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>{form.upi_name}</div>
                        <div style={{ color: '#38bdf8', fontSize: '14px' }}>{form.upi_id}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>QR preview for parents</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Razorpay Section */}
              {['razorpay', 'both'].includes(form.payment_method) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px', color: '#a78bfa' }}>💳 Razorpay Settings</div>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#fbbf24' }}>
                    ⚠️ Payment integration coming soon. Save your keys now and payments will activate automatically when ready.
                  </div>
                  <div className="grid-2">
                    <div>
                      <label>Razorpay Key ID (Public)</label>
                      <input value={form.razorpay_key_id} onChange={e => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder='rzp_live_xxxxxxxxxx' style={inputStyle} />
                    </div>
                    <div>
                      <label>Razorpay Key Secret</label>
                      <input type='password' value={form.razorpay_key_secret} onChange={e => setForm({ ...form, razorpay_key_secret: e.target.value })} placeholder='Your secret key' style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                    🔒 Keys are stored securely. Get your keys from <a href='https://dashboard.razorpay.com' target='_blank' style={{ color: '#a78bfa' }}>Razorpay Dashboard</a>
                  </div>
                </div>
              )}

              {/* PayU Section */}
              {form.payment_method === 'payu' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px', color: '#10b981' }}>💳 PayU Settings</div>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#fbbf24' }}>
                    ⚠️ Payment integration coming soon. Save your keys now and payments will activate automatically when ready.
                  </div>
                  <div className="grid-2">
                    <div>
                      <label>PayU Merchant Key</label>
                      <input value={form.payu_merchant_key} onChange={e => setForm({ ...form, payu_merchant_key: e.target.value })} placeholder='Your merchant key' style={inputStyle} />
                    </div>
                    <div>
                      <label>PayU Merchant Salt</label>
                      <input type='password' value={form.payu_merchant_salt} onChange={e => setForm({ ...form, payu_merchant_salt: e.target.value })} placeholder='Your merchant salt' style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                    🔒 Keys are stored securely. Get your keys from <a href='https://dashboard.payu.in' target='_blank' style={{ color: '#10b981' }}>PayU Dashboard</a>
                  </div>
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