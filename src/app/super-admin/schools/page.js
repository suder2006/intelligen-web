'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SuperAdminSchools() {
  const [view, setView] = useState('schools') // schools | registrations
  const [schools, setSchools] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSchoolForm, setShowSchoolForm] = useState(false)
  const [showAdminForm, setShowAdminForm] = useState(null) // school object
  const [showCredentials, setShowCredentials] = useState(null)
  const [editingSchool, setEditingSchool] = useState(null)
  const [copied, setCopied] = useState(false)

  const [schoolForm, setSchoolForm] = useState({
    name: '', address: '', phone: '', email: '',
    website: '', primary_color: '#38bdf8', status: 'active'
  })

  const [adminForm, setAdminForm] = useState({
    full_name: '', email: '', phone: '',
    password: 'School@123456'
  })

  const router = useRouter()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [schRes, regRes] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('school_registrations').select('*').order('created_at', { ascending: false })
    ])
    const schoolsWithStats = await Promise.all((schRes.data || []).map(async school => {
      const [stuCount, staffCount] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }).eq('school_id', school.id).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('school_id', school.id).in('role', ['teacher', 'staff'])
      ])
      return { ...school, student_count: stuCount.count || 0, staff_count: staffCount.count || 0 }
    }))
    setSchools(schoolsWithStats)
    setRegistrations(regRes.data || [])
    setLoading(false)
  }

  const saveSchool = async () => {
    if (!schoolForm.name) { alert('Please enter school name'); return }
    setSaving(true)
    if (editingSchool) {
      await supabase.from('schools').update(schoolForm).eq('id', editingSchool.id)
    } else {
      await supabase.from('schools').insert(schoolForm)
    }
    setShowSchoolForm(false)
    setEditingSchool(null)
    setSchoolForm({ name: '', address: '', phone: '', email: '', website: '', primary_color: '#38bdf8', status: 'active' })
    await fetchAll()
    setSaving(false)
  }

  const createSchoolAdmin = async () => {
    if (!adminForm.full_name || !adminForm.email || !adminForm.password) {
      alert('Please fill all fields'); return
    }
    setSaving(true)
    try {
      const res = await fetch('https://wmxywsbrfbmyatzaehre.supabase.co/functions/v1/create-staff-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: adminForm.full_name,
          email: adminForm.email,
          password: adminForm.password,
          phone: adminForm.phone,
          role: 'school_admin',
          school_id: showAdminForm.id,
          programs: []
        })
      })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setSaving(false); return }
      setShowCredentials({ school: showAdminForm.name, ...adminForm })
      setShowAdminForm(null)
      setAdminForm({ full_name: '', email: '', phone: '', password: 'School@123456' })
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  const approveRegistration = async (reg) => {
    if (!confirm(`Approve ${reg.school_name} and create their account?`)) return
    setSaving(true)
    // Create school
    const { data: newSchool } = await supabase.from('schools').insert({
      name: reg.school_name, address: reg.address,
      phone: reg.phone, email: reg.email,
      website: reg.website, status: 'active', primary_color: '#38bdf8'
    }).select().single()

    if (newSchool) {
      // Create admin account via edge function
      const password = 'School@123456'
      await fetch('https://wmxywsbrfbmyatzaehre.supabase.co/functions/v1/create-staff-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: reg.admin_name, email: reg.admin_email,
          password, phone: reg.admin_phone,
          role: 'school_admin', school_id: newSchool.id, programs: []
        })
      })
      // Update registration status
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('school_registrations').update({
        status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString()
      }).eq('id', reg.id)
      setShowCredentials({ school: reg.school_name, email: reg.admin_email, password, full_name: reg.admin_name })
    }
    await fetchAll()
    setSaving(false)
  }

  const rejectRegistration = async (id) => {
    if (!confirm('Reject this registration?')) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('school_registrations').update({
      status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString()
    }).eq('id', id)
    await fetchAll()
  }

  const toggleSchoolStatus = async (school) => {
    await supabase.from('schools').update({ status: school.status === 'active' ? 'inactive' : 'active' }).eq('id', school.id)
    await fetchAll()
  }

  const copyCredentials = () => {
    const text = `IntelliGen Login Credentials\nSchool: ${showCredentials.school}\nEmail: ${showCredentials.email}\nPassword: ${showCredentials.password}\nURL: https://intelligen-web.vercel.app`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pendingCount = registrations.filter(r => r.status === 'pending').length
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; }
        .logo span { color: #38bdf8; }
        .content { padding: 32px; max-width: 1100px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .view-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>⚡ Super Admin</span>
        </div>
        <button onClick={() => { supabase.auth.signOut(); router.push('/') }} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>🚪 Sign Out</button>
      </div>

      <div className="content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🏫 Schools Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>{schools.length} schools · {schools.filter(s => s.status === 'active').length} active</p>
          </div>
          <button onClick={() => { setEditingSchool(null); setSchoolForm({ name: '', address: '', phone: '', email: '', website: '', primary_color: '#38bdf8', status: 'active' }); setShowSchoolForm(true) }} className="btn-primary">+ Add School</button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total Schools', value: schools.length, color: '#38bdf8' },
            { label: 'Active', value: schools.filter(s => s.status === 'active').length, color: '#10b981' },
            { label: 'Inactive', value: schools.filter(s => s.status === 'inactive').length, color: '#ef4444' },
            { label: 'Pending Approvals', value: pendingCount, color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          <button className={`view-tab ${view === 'schools' ? 'active' : ''}`} onClick={() => setView('schools')}>🏫 Schools ({schools.length})</button>
          <button className={`view-tab ${view === 'registrations' ? 'active' : ''}`} onClick={() => setView('registrations')}>
            📋 Registrations ({registrations.length})
            {pendingCount > 0 && <span style={{ marginLeft: '6px', background: '#f59e0b', color: '#000', borderRadius: '20px', padding: '1px 6px', fontSize: '11px' }}>{pendingCount}</span>}
          </button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* SCHOOLS */}
            {view === 'schools' && (
              schools.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>No schools yet. Click "+ Add School" to get started.</div>
              ) : schools.map(school => (
                <div key={school.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {/* School color indicator */}
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: school.primary_color || '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🏫</div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>{school.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{school.email} · {school.phone}</div>
                        {school.address && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '2px' }}>{school.address}</div>}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600' }}>👶 {school.student_count} Students</span>
                          <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600' }}>👩‍🏫 {school.staff_count} Staff</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: school.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: school.status === 'active' ? '#34d399' : '#f87171' }}>{school.status}</span>
                      <button onClick={() => { setShowAdminForm(school); setAdminForm({ full_name: '', email: '', phone: '', password: 'School@123456' }) }}
                        style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>👤 Add Admin</button>
                      <button onClick={() => { setEditingSchool(school); setSchoolForm({ name: school.name, address: school.address || '', phone: school.phone || '', email: school.email || '', website: school.website || '', primary_color: school.primary_color || '#38bdf8', status: school.status }); setShowSchoolForm(true) }}
                        style={{ padding: '6px 12px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                      <button onClick={() => toggleSchoolStatus(school)}
                        style={{ padding: '6px 12px', background: school.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${school.status === 'active' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: '8px', color: school.status === 'active' ? '#f87171' : '#34d399', cursor: 'pointer', fontSize: '12px' }}>
                        {school.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* REGISTRATIONS */}
            {view === 'registrations' && (
              registrations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>No registration requests yet.</div>
              ) : registrations.map(reg => (
                <div key={reg.id} className="card" style={{ borderColor: reg.status === 'pending' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px' }}>{reg.school_name}</div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>📧 {reg.email}</div>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>📞 {reg.phone}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px' }}>
                        <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Admin Contact</div>
                        <div style={{ fontSize: '13px' }}>{reg.admin_name} · {reg.admin_email} · {reg.admin_phone}</div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '8px' }}>Submitted: {new Date(reg.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <span className="badge" style={{ background: reg.status === 'pending' ? 'rgba(245,158,11,0.15)' : reg.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: reg.status === 'pending' ? '#fbbf24' : reg.status === 'approved' ? '#34d399' : '#f87171' }}>{reg.status}</span>
                      {reg.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => approveRegistration(reg)} disabled={saving}
                            style={{ padding: '7px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>✅ Approve</button>
                          <button onClick={() => rejectRegistration(reg.id)}
                            style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>❌ Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* School Form Modal */}
      {showSchoolForm && (
        <div className="modal-overlay" onClick={() => setShowSchoolForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingSchool ? '✏️ Edit School' : '🏫 Add New School'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>School Name *</label>
            <input value={schoolForm.name} onChange={e => setSchoolForm({ ...schoolForm, name: e.target.value })} placeholder='e.g. Time Kids Preschool Anna Nagar' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Address</label>
            <input value={schoolForm.address} onChange={e => setSchoolForm({ ...schoolForm, address: e.target.value })} placeholder='Full address' style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Phone</label>
                <input value={schoolForm.phone} onChange={e => setSchoolForm({ ...schoolForm, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email</label>
                <input value={schoolForm.email} onChange={e => setSchoolForm({ ...schoolForm, email: e.target.value })} placeholder='school@example.com' style={inputStyle} />
              </div>
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Website</label>
            <input value={schoolForm.website} onChange={e => setSchoolForm({ ...schoolForm, website: e.target.value })} placeholder='https://yourschool.com' style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Primary Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <input type='color' value={schoolForm.primary_color} onChange={e => setSchoolForm({ ...schoolForm, primary_color: e.target.value })}
                style={{ width: '50px', height: '40px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
              <input value={schoolForm.primary_color} onChange={e => setSchoolForm({ ...schoolForm, primary_color: e.target.value })}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: schoolForm.primary_color, flexShrink: 0 }} />
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Status</label>
            <select value={schoolForm.status} onChange={e => setSchoolForm({ ...schoolForm, status: e.target.value })} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowSchoolForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveSchool} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingSchool ? 'Update School' : 'Add School'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showAdminForm && (
        <div className="modal-overlay" onClick={() => setShowAdminForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>👤 Create School Admin</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showAdminForm.name}</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Admin Name *</label>
            <input value={adminForm.full_name} onChange={e => setAdminForm({ ...adminForm, full_name: e.target.value })} placeholder='Full name' style={inputStyle} autoFocus />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email *</label>
            <input value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} placeholder='admin@school.com' style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Phone</label>
            <input value={adminForm.phone} onChange={e => setAdminForm({ ...adminForm, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Password *</label>
            <input value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowAdminForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={createSchoolAdmin} disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Admin'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="modal-overlay" onClick={() => setShowCredentials(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>Admin Account Created!</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showCredentials.school}</p>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Name</div>
                <div style={{ fontWeight: '600' }}>{showCredentials.full_name}</div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Email</div>
                <div style={{ fontWeight: '600', color: '#38bdf8' }}>{showCredentials.email}</div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Password</div>
                <div style={{ fontWeight: '600', color: '#10b981' }}>{showCredentials.password}</div>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>Login URL</div>
                <div style={{ fontWeight: '600', fontSize: '13px' }}>https://intelligen-web.vercel.app</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={copyCredentials}
                style={{ flex: 1, padding: '11px', background: copied ? '#10b981' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: copied ? '#fff' : 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                {copied ? '✅ Copied!' : '📋 Copy Credentials'}
              </button>
              <button onClick={() => setShowCredentials(null)} className="btn-primary" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}