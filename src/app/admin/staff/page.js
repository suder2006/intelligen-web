'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import { APP_URL } from '@/lib/config'

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [programs, setPrograms] = useState([])
  const [staffPrograms, setStaffPrograms] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'teacher' })
  const [selectedPrograms, setSelectedPrograms] = useState([])
  const [editingPrograms, setEditingPrograms] = useState(null)
  const [editPrograms, setEditPrograms] = useState([])

  const { schoolId } = useSchool()

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '⊞' },
    { href: '/admin/students', label: 'Students', icon: '👶' },
    { href: '/admin/classes', label: 'Classes', icon: '📚' },
    { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
    { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
    { href: '/admin/fees', label: 'Fees', icon: '💳' },
    { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
    { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
    { href: '/admin/curriculum', label: 'Curriculum', icon: '📖' },
    { href: '/admin/moments', label: 'Moments', icon: '📸' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
  ]

    useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

    const fetchAll = async () => {
    setLoading(true)
    const [{ data: staffData }, { data: progsData }, { data: spData }] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['teacher', 'staff']).eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value'),
      supabase.from('staff_programs').select('*')
    ])  
    setStaff(staffData || [])
    setPrograms(progsData?.map(p => p.value) || [])
    // Build map: staff_id -> [programs]
    const map = {}
    for (const sp of (spData || [])) {
      if (!map[sp.staff_id]) map[sp.staff_id] = []
      map[sp.staff_id].push(sp.program)
    }
    setStaffPrograms(map)
    setLoading(false)
  }

  const toggleProgram = (prog, list, setList) => {
    if (list.includes(prog)) setList(list.filter(p => p !== prog))
    else setList([...list, prog])
  }

  const [credentials, setCredentials] = useState(null)

  const addStaff = async () => {
    if (!form.full_name || !form.email || !form.password) { alert('Name, email and password are required'); return }
    setSaving(true)
    try {
    const { data, error } = await supabase.functions.invoke('create-staff-user', {
        body: {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          role: form.role,
          programs: selectedPrograms,
          school_id: schoolId
        }
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      setCredentials({ email: form.email, password: form.password, name: form.full_name })
      setForm({ full_name: '', email: '', phone: '', password: '', role: 'teacher' })
      setSelectedPrograms([])
      setShowAdd(false)
      await fetchAll()
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  const savePrograms = async (staffId) => {
    // Delete existing and re-insert
    await supabase.from('staff_programs').delete().eq('staff_id', staffId)
    if (editPrograms.length > 0) {
      await supabase.from('staff_programs').insert(
        editPrograms.map(p => ({ staff_id: staffId, program: p }))
      )
    }
    setEditingPrograms(null)
    await fetchAll()
  }

  const deleteStaff = async (id) => {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('staff_programs').delete().eq('staff_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    fetchAll()
  }

  const programColors = ['#38bdf8', '#10b981', '#f59e0b', '#a78bfa', '#f87171', '#34d399', '#fb923c']

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
        .page-title { font-size: 24px; font-weight: 700; }
        .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-top: 4px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .staff-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; }
        .staff-card:hover { border-color: rgba(56,189,248,0.2); transform: translateY(-2px); }
        .avatar { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 16px; }
        .staff-name { font-size: 17px; font-weight: 700; margin-bottom: 4px; }
        .staff-role { color: #38bdf8; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
        .staff-info { color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 4px; }
        .prog-tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin: 2px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        .form-label { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .form-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; margin-bottom: 16px; font-family: 'DM Sans', sans-serif; }
        .form-input:focus { border-color: #38bdf8; }
        .modal-btns { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
        .btn-cancel { background: rgba(255,255,255,0.06); border: none; border-radius: 10px; padding: 10px 20px; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .hint { background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; padding: 12px; color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 20px; }
        .empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.3); }
        .prog-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; border: 1px solid #334155; background: #0f172a; color: #94a3b8; cursor: pointer; font-size: 13px; font-family: 'DM Sans'; margin: 4px; transition: all 0.15s; }
        .prog-toggle.selected { border-color: #38bdf8; background: rgba(56,189,248,0.15); color: #38bdf8; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/staff' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">Staff Management</div>
            <div className="page-sub">{staff.length} staff members</div>
          </div>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
        </div>

        {loading ? <div className="empty">Loading staff...</div> :
         staff.length === 0 ? <div className="empty">No staff added yet.</div> : (
          <div className="grid">
            {staff.map(s => {
              const progs = staffPrograms[s.id] || []
              return (
                <div key={s.id} className="staff-card">
                  <div className="avatar">{s.full_name?.[0]?.toUpperCase() || '?'}</div>
                  <div className="staff-name">{s.full_name}</div>
                  <div className="staff-role">{s.role === 'teacher' ? 'Teacher' : 'School Admin'}</div>
                  {s.email && <div className="staff-info">✉️ {s.email}</div>}
                  {s.phone && <div className="staff-info">📞 {s.phone}</div>}
                  <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '6px' }}>Programs:</div>
                    {progs.length === 0 ? (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>No programs assigned</span>
                    ) : progs.map((p, i) => (
                      <span key={p} className="prog-tag" style={{ background: `${programColors[i % programColors.length]}22`, color: programColors[i % programColors.length], border: `1px solid ${programColors[i % programColors.length]}44` }}>{p}</span>
                    ))}
                  </div>
                  {editingPrograms === s.id ? (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px' }}>Select programs:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                        {programs.map(p => (
                          <button key={p} className={`prog-toggle ${editPrograms.includes(p) ? 'selected' : ''}`}
                            onClick={() => toggleProgram(p, editPrograms, setEditPrograms)}>
                            {editPrograms.includes(p) ? '✓' : '+'} {p}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => savePrograms(s.id)} style={{ padding: '6px 14px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Save</button>
                        <button onClick={() => setEditingPrograms(null)} style={{ padding: '6px 14px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                      <button onClick={() => { setEditingPrograms(s.id); setEditPrograms(progs) }}
                        style={{ flex: 1, padding: '7px', backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                        Assign Programs
                      </button>
                      <button onClick={() => deleteStaff(s.id)}
                        style={{ padding: '7px 12px', backgroundColor: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Staff Member</div>
            <div className="hint">Default login password: <strong>Staff@123456</strong></div>
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="e.g. Sarah Williams" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} />
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="e.g. sarah@school.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="e.g. +91 98765 43210" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <label className="form-label">Password *</label>
            <input className="form-input" type="password" placeholder="e.g. Teacher@123" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />           
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
              <option value="center_head">Center Head</option>
              <option value="school_admin">School Admin</option>
            </select>
            <label className="form-label">Assign Programs</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px' }}>
              {programs.map(p => (
                <button key={p} className={`prog-toggle ${selectedPrograms.includes(p) ? 'selected' : ''}`}
                  onClick={() => toggleProgram(p, selectedPrograms, setSelectedPrograms)}>
                  {selectedPrograms.includes(p) ? '✓' : '+'} {p}
                </button>
              ))}
            </div>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={addStaff} disabled={saving}>{saving ? 'Saving...' : 'Add Staff'}</button>
            </div>
          </div>
        </div>
      )}
      {credentials && (
        <div className="modal-overlay" onClick={() => setCredentials(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <div className="modal-title" style={{ marginBottom: '4px' }}>Staff Added!</div>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>Share these credentials with {credentials.name}</p>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Name</div>
                <div style={{ fontWeight: '600' }}>{credentials.name}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Login Email</div>
                <div style={{ fontWeight: '600', color: '#38bdf8' }}>{credentials.email}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Password</div>
                <div style={{ fontWeight: '600', color: '#10b981' }}>{credentials.password}</div>
              </div>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Login URL</div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#f59e0b' }}>{APP_URL}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { navigator.clipboard.writeText(`IntelliGen Staff Login\nName: ${credentials.name}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nURL: ${APP_URL}`); alert('Copied!') }}
                style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                📋 Copy Credentials
              </button>
              <button onClick={() => setCredentials(null)} className="btn-primary" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>   
  )
}
