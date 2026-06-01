'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'

const LOCKABLE_MODULES = [
  { id: 'fees', label: 'Fees', icon: '💳' },
  { id: 'fee_structure', label: 'Fee Structure', icon: '📋' },
  { id: 'payroll', label: 'Payroll', icon: '💰' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
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
    upi_id: '', upi_name: '', upi_description: '',
    payment_method: 'upi',
    razorpay_key_id: '', razorpay_key_secret: '',
    payu_merchant_key: '', payu_merchant_salt: ''
  })

  // Sub-admin management
  const [subAdmins, setSubAdmins] = useState([])
  const [showSubAdminForm, setShowSubAdminForm] = useState(false)
  const [subAdminForm, setSubAdminForm] = useState({ name: '', email: '', restricted_modules: [] })
  const [savingSubAdmin, setSavingSubAdmin] = useState(false)
  const [editingSubAdmin, setEditingSubAdmin] = useState(null)

  // Module access password
  const [modulePassword, setModulePassword] = useState('')
  const [newModulePassword, setNewModulePassword] = useState('')
  const [confirmModulePassword, setConfirmModulePassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => { if (schoolId) { fetchSchool(); fetchSubAdmins() } }, [schoolId])

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
      setModulePassword(data.module_access_password || '')
    }
    setLoading(false)
  }

  const fetchSubAdmins = async () => {
    const { data: restrictions } = await supabase
      .from('sub_admin_restrictions')
      .select('*, profiles(full_name, email, role)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    setSubAdmins(restrictions || [])
  }

  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('schools').update(form).eq('id', schoolId)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    await fetchSchool()
    setSaving(false)
  }

  const saveModulePassword = async () => {
    if (!newModulePassword) { alert('Please enter a password'); return }
    if (newModulePassword !== confirmModulePassword) { alert('Passwords do not match!'); return }
    if (newModulePassword.length < 6) { alert('Password must be at least 6 characters'); return }
    setSavingPassword(true)
    await supabase.from('schools').update({ module_access_password: newModulePassword }).eq('id', schoolId)
    setModulePassword(newModulePassword)
    setNewModulePassword('')
    setConfirmModulePassword('')
    setShowPasswordForm(false)
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 3000)
    setSavingPassword(false)
    alert('✅ Module access password saved!')
  }

  const saveSubAdmin = async () => {
    if (!subAdminForm.email) { alert('Please enter email'); return }
    setSavingSubAdmin(true)
    try {
      // Find user by email
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('email', subAdminForm.email)
        .eq('school_id', schoolId)
        .single()

      if (!profileData) {
        alert('No staff member found with this email in your school. Please make sure they have an account first.')
        setSavingSubAdmin(false)
        return
      }

      if (editingSubAdmin) {
        await supabase.from('sub_admin_restrictions').update({
          restricted_modules: subAdminForm.restricted_modules,
          is_active: true
        }).eq('id', editingSubAdmin)
      } else {
        // Check if already exists
        const { data: existing } = await supabase
          .from('sub_admin_restrictions')
          .select('id')
          .eq('user_id', profileData.id)
          .eq('school_id', schoolId)
          .single()

        if (existing) {
          await supabase.from('sub_admin_restrictions').update({
            restricted_modules: subAdminForm.restricted_modules,
            is_active: true
          }).eq('id', existing.id)
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          await supabase.from('sub_admin_restrictions').insert({
            school_id: schoolId,
            user_id: profileData.id,
            restricted_modules: subAdminForm.restricted_modules,
            is_active: true,
            created_by: user.id
          })
        }
      }

      setSubAdminForm({ name: '', email: '', restricted_modules: [] })
      setEditingSubAdmin(null)
      setShowSubAdminForm(false)
      await fetchSubAdmins()
      alert(`✅ Sub-admin restrictions saved for ${profileData.full_name}!`)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSavingSubAdmin(false)
  }

  const toggleModule = (moduleId) => {
    const current = subAdminForm.restricted_modules
    if (current.includes(moduleId)) {
      setSubAdminForm({ ...subAdminForm, restricted_modules: current.filter(m => m !== moduleId) })
    } else {
      setSubAdminForm({ ...subAdminForm, restricted_modules: [...current, moduleId] })
    }
  }

  const toggleSubAdminStatus = async (id, currentStatus) => {
    await supabase.from('sub_admin_restrictions').update({ is_active: !currentStatus }).eq('id', id)
    await fetchSubAdmins()
  }

  const deleteSubAdminRestriction = async (id, name) => {
    if (!confirm(`Remove restrictions for ${name}? They will have full access.`)) return
    await supabase.from('sub_admin_restrictions').delete().eq('id', id)
    await fetchSubAdmins()
  }

  const startEditSubAdmin = (sa) => {
    setEditingSubAdmin(sa.id)
    setSubAdminForm({
      name: sa.profiles?.full_name || '',
      email: sa.profiles?.email || '',
      restricted_modules: sa.restricted_modules || []
    })
    setShowSubAdminForm(true)
    window.scrollTo(0, 0)
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
        label { color: #94a3b8; font-size: 13px; display: block; margin-bottom: 6px; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } .grid-2 { grid-template-columns: 1fr; } }
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
                <div><label>School Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='School name' style={inputStyle} /></div>
                <div><label>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder='school@example.com' style={inputStyle} /></div>
                <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} /></div>
                <div><label>Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder='https://yourschool.com' style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder='Full address' style={inputStyle} /></div>
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
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>Preview:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button style={{ padding: '8px 20px', background: `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}dd)`, border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px' }}>Primary Button</button>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', background: `${form.primary_color}22`, color: form.primary_color, fontWeight: '600', fontSize: '13px', border: `1px solid ${form.primary_color}44` }}>Badge</span>
                  <span style={{ color: form.primary_color, fontWeight: '700', fontSize: '16px' }}>Link Text</span>
                </div>
              </div>
            </div>

            {/* Payment Gateway */}
            <div className="section">
              <div className="section-title">💳 Payment Gateway</div>
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

              {['upi', 'both'].includes(form.payment_method) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '14px', color: '#38bdf8' }}>📱 UPI Settings</div>
                  <div className="grid-2">
                    <div><label>UPI ID *</label><input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder='e.g. school@icici' style={inputStyle} /></div>
                    <div><label>UPI Display Name *</label><input value={form.upi_name} onChange={e => setForm({ ...form, upi_name: e.target.value })} placeholder='e.g. Time Kids Preschool' style={inputStyle} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label>Payment Description</label><input value={form.upi_description} onChange={e => setForm({ ...form, upi_description: e.target.value })} placeholder='e.g. School fees payment' style={inputStyle} /></div>
                  </div>
                  {form.upi_id && form.upi_name && (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <div style={{ background: '#fff', borderRadius: '10px', padding: '10px' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${form.upi_id}&pn=${encodeURIComponent(form.upi_name)}`)}`} alt='UPI QR' style={{ width: '100px', height: '100px', display: 'block' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '2px' }}>{form.upi_name}</div>
                        <div style={{ color: '#38bdf8', fontSize: '14px' }}>{form.upi_id}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {['razorpay', 'both'].includes(form.payment_method) && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '14px', color: '#a78bfa' }}>💳 Razorpay Settings</div>
                  <div className="grid-2">
                    <div><label>Razorpay Key ID (Public)</label><input value={form.razorpay_key_id} onChange={e => setForm({ ...form, razorpay_key_id: e.target.value })} placeholder='rzp_live_xxxxxxxxxx' style={inputStyle} /></div>
                    <div><label>Razorpay Key Secret</label><input type='password' value={form.razorpay_key_secret} onChange={e => setForm({ ...form, razorpay_key_secret: e.target.value })} placeholder='Your secret key' style={inputStyle} /></div>
                  </div>
                </div>
              )}

              {form.payment_method === 'payu' && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '14px', color: '#10b981' }}>💳 PayU Settings</div>
                  <div className="grid-2">
                    <div><label>PayU Merchant Key</label><input value={form.payu_merchant_key} onChange={e => setForm({ ...form, payu_merchant_key: e.target.value })} placeholder='Your merchant key' style={inputStyle} /></div>
                    <div><label>PayU Merchant Salt</label><input type='password' value={form.payu_merchant_salt} onChange={e => setForm({ ...form, payu_merchant_salt: e.target.value })} placeholder='Your merchant salt' style={inputStyle} /></div>
                  </div>
                </div>
              )}
            </div>

            {/* ==================== SUB-ADMIN MANAGEMENT ==================== */}
            <div className="section">
              <div className="section-title">👥 Sub-Admin Management</div>

              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.7' }}>
                ℹ️ Add staff members here and select which modules they cannot access freely. When they try to open a restricted module, they will be asked for the module access password.
              </div>

              {/* Module Access Password */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: '600', color: '#fbbf24' }}>🔑 Module Access Password</div>
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)}
                    style={{ padding: '6px 14px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', color: '#fbbf24', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    {showPasswordForm ? 'Cancel' : modulePassword ? '🔄 Change Password' : '+ Set Password'}
                  </button>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>
                  {modulePassword ? '✅ Password is set. Sub-admins will be asked this password when accessing restricted modules.' : '⚠️ No password set yet. Set a password before restricting modules.'}
                </div>

                {showPasswordForm && (
                  <div style={{ marginTop: '14px', padding: '16px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: '10px' }}>
                    <div className="grid-2" style={{ marginBottom: '12px' }}>
                      <div>
                        <label>New Password *</label>
                        <input type='password' value={newModulePassword} onChange={e => setNewModulePassword(e.target.value)}
                          placeholder='Min 6 characters' style={inputStyle} />
                      </div>
                      <div>
                        <label>Confirm Password *</label>
                        <input type='password' value={confirmModulePassword} onChange={e => setConfirmModulePassword(e.target.value)}
                          placeholder='Repeat password' style={inputStyle} />
                      </div>
                    </div>
                    <button onClick={saveModulePassword} disabled={savingPassword}
                      style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: '700', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                      {savingPassword ? '⏳ Saving...' : '🔑 Save Password'}
                    </button>
                  </div>
                )}
              </div>

              {/* Add Sub-Admin Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{subAdmins.length} sub-admin(s) configured</div>
                <button onClick={() => { setShowSubAdminForm(!showSubAdminForm); setEditingSubAdmin(null); setSubAdminForm({ name: '', email: '', restricted_modules: [] }) }}
                  style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                  + Add Sub-Admin
                </button>
              </div>

              {/* Sub-Admin Form */}
              {showSubAdminForm && (
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '16px' }}>
                    {editingSubAdmin ? '✏️ Edit Sub-Admin Restrictions' : '➕ Add Sub-Admin Restrictions'}
                  </div>

                  {!editingSubAdmin && (
                    <div style={{ marginBottom: '16px' }}>
                      <label>Staff Email * (must already have an account)</label>
                      <input value={subAdminForm.email} onChange={e => setSubAdminForm({ ...subAdminForm, email: e.target.value })}
                        placeholder='centerhead@timekids.com'
                        style={inputStyle} />
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '-10px', marginBottom: '8px' }}>
                        This person must already be added as a staff member with school_admin or center_head role
                      </div>
                    </div>
                  )}

                  {editingSubAdmin && (
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                      <div style={{ fontWeight: '600' }}>{subAdminForm.name}</div>
                      <div style={{ color: '#38bdf8', fontSize: '13px' }}>{subAdminForm.email}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ marginBottom: '10px', display: 'block' }}>🔒 Restrict these modules (sub-admin will need password to access):</label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {LOCKABLE_MODULES.map(mod => {
                        const isSelected = subAdminForm.restricted_modules.includes(mod.id)
                        return (
                          <button key={mod.id} onClick={() => toggleModule(mod.id)} type='button'
                            style={{ padding: '10px 18px', borderRadius: '10px', border: `2px solid ${isSelected ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, background: isSelected ? 'rgba(239,68,68,0.12)' : 'transparent', color: isSelected ? '#f87171' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isSelected ? '🔒' : '🔓'} {mod.icon} {mod.label}
                          </button>
                        )
                      })}
                    </div>
                    {subAdminForm.restricted_modules.length === 0 && (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '8px' }}>No modules restricted — sub-admin will have full access</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setShowSubAdminForm(false); setEditingSubAdmin(null) }}
                      style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                      Cancel
                    </button>
                    <button onClick={saveSubAdmin} disabled={savingSubAdmin}
                      style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                      {savingSubAdmin ? '⏳ Saving...' : '💾 Save Restrictions'}
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Admins List */}
              {subAdmins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  No sub-admin restrictions configured yet.
                </div>
              ) : subAdmins.map(sa => (
                <div key={sa.id} style={{ background: sa.is_active ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)', border: `1px solid ${sa.is_active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`, borderRadius: '12px', padding: '16px', marginBottom: '10px', opacity: sa.is_active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '700', marginBottom: '2px' }}>{sa.profiles?.full_name || 'Unknown'}</div>
                      <div style={{ color: '#38bdf8', fontSize: '13px', marginBottom: '8px' }}>{sa.profiles?.email}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {sa.restricted_modules?.length === 0 ? (
                          <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✅ Full Access</span>
                        ) : sa.restricted_modules?.map(mod => {
                          const modInfo = LOCKABLE_MODULES.find(m => m.id === mod)
                          return (
                            <span key={mod} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                              🔒 {modInfo?.icon} {modInfo?.label || mod}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: sa.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)', color: sa.is_active ? '#34d399' : '#64748b' }}>
                        {sa.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => startEditSubAdmin(sa)}
                        style={{ padding: '5px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => toggleSubAdminStatus(sa.id, sa.is_active)}
                        style={{ padding: '5px 10px', background: sa.is_active ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', border: `1px solid ${sa.is_active ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '6px', color: sa.is_active ? '#fbbf24' : '#34d399', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                        {sa.is_active ? '🔒 Disable' : '🔓 Enable'}
                      </button>
                      <button onClick={() => deleteSubAdminRestriction(sa.id, sa.profiles?.full_name)}
                        style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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