'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const SCHOOL_ID = '554c668d-1668-474b-a8aa-f529941dbcf6'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/staff-groups', label: 'Staff Groups', icon: '⏰' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/fees', label: 'Fees', icon: '💳' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
  { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
]

export default function StaffGroupsPage() {
  const [groups, setGroups] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [form, setForm] = useState({
    name: '', checkin_start: '07:00', present_before: '08:30',
    late_before: '09:00', halfday_before: '09:30',
    checkin_closes: '10:00', checkout_time: '16:00', working_hours: 8
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [grpRes, staffRes] = await Promise.all([
      supabase.from('staff_type_groups').select('*').eq('school_id', SCHOOL_ID).order('name'),
      supabase.from('profiles').select('*, staff_type_groups(name)').in('role', ['teacher', 'staff', 'school_admin']).order('full_name')
    ])
    setGroups(grpRes.data || [])
    setStaff(staffRes.data || [])
    setLoading(false)
  }

  const saveGroup = async () => {
    if (!form.name.trim()) { alert('Please enter group name'); return }
    setSaving(true)
    if (editingGroup) {
      await supabase.from('staff_type_groups').update(form).eq('id', editingGroup.id)
    } else {
      await supabase.from('staff_type_groups').insert({ ...form, school_id: SCHOOL_ID })
    }
    setShowForm(false)
    setEditingGroup(null)
    setForm({ name: '', checkin_start: '07:00', present_before: '08:30', late_before: '09:00', halfday_before: '09:30', checkin_closes: '10:00', checkout_time: '16:00', working_hours: 8 })
    await fetchAll()
    setSaving(false)
  }

  const deleteGroup = async (id) => {
    if (!confirm('Delete this group?')) return
    await supabase.from('staff_type_groups').delete().eq('id', id)
    await fetchAll()
  }

  const assignGroup = async (staffId, groupId) => {
    await supabase.from('profiles').update({ staff_group_id: groupId || null }).eq('id', staffId)
    await fetchAll()
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

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
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .time-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/staff-groups' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>⏰ Staff Groups & Timings</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Configure check-in timings per staff type</p>
          </div>
          <button onClick={() => { setEditingGroup(null); setForm({ name: '', checkin_start: '07:00', present_before: '08:30', late_before: '09:00', halfday_before: '09:30', checkin_closes: '10:00', checkout_time: '16:00', working_hours: 8 }); setShowForm(true) }} className="btn-primary">+ Add Group</button>
        </div>

        {/* Info box */}
        <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.8' }}>
          <strong style={{ color: '#38bdf8' }}>How it works:</strong><br/>
          1. Create groups (e.g. Teaching Staff, Non-Teaching Staff)<br/>
          2. Set check-in timings for each group<br/>
          3. Assign each staff member to a group below
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* Groups */}
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>⏰ Staff Type Groups</h3>
            {groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)', marginBottom: '24px' }}>No groups yet. Click "+ Add Group" to create one.</div>
            ) : groups.map(grp => (
              <div key={grp.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '12px' }}>{grp.name}</div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {[
                        { label: '🟢 Check-in Opens', value: grp.checkin_start },
                        { label: '✅ Present Before', value: grp.present_before },
                        { label: '⏰ Late After', value: grp.late_before },
                        { label: '🌓 Half Day After', value: grp.halfday_before },
                        { label: '🔴 Closes At', value: grp.checkin_closes },
                        { label: '🚪 Check-out', value: grp.checkout_time },
                        { label: '⌚ Work Hours', value: `${grp.working_hours}h` },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center', minWidth: '80px' }}>
                          <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '15px' }}>{item.value}</div>
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setEditingGroup(grp); setForm({ name: grp.name, checkin_start: grp.checkin_start, present_before: grp.present_before, late_before: grp.late_before, halfday_before: grp.halfday_before, checkin_closes: grp.checkin_closes, checkout_time: grp.checkout_time, working_hours: grp.working_hours }); setShowForm(true) }}
                      style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>✏️ Edit</button>
                    <button onClick={() => deleteGroup(grp.id)}
                      style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>🗑️</button>
                  </div>
                </div>
                <div style={{ marginTop: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                  {staff.filter(s => s.staff_group_id === grp.id).length} staff assigned
                </div>
              </div>
            ))}

            {/* Staff Assignment */}
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px', marginTop: '24px' }}>👩‍🏫 Assign Staff to Groups</h3>
            {staff.map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '14px 20px' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{s.full_name}</div>
                  <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.role}</div>
                </div>
                <select value={s.staff_group_id || ''} onChange={e => assignGroup(s.id, e.target.value)}
                  style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px', minWidth: '200px' }}>
                  <option value=''>-- No Group Assigned --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Group Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editingGroup ? '✏️ Edit Group' : '⏰ Add Staff Group'}</h3>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Group Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. Teaching Staff, Non-Teaching Staff' style={inputStyle} autoFocus />
            <div className="time-grid">
              {[
                ['checkin_start', '🟢 Check-in Opens'],
                ['present_before', '✅ Present Before'],
                ['late_before', '⏰ Late After'],
                ['halfday_before', '🌓 Half Day After'],
                ['checkin_closes', '🔴 Check-in Closes'],
                ['checkout_time', '🚪 Expected Check-out'],
              ].map(([field, label]) => (
                <div key={field}>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input type='time' value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} style={inputStyle} />
                </div>
              ))}
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>⌚ Working Hours (per day)</label>
            <input type='number' value={form.working_hours} onChange={e => setForm({ ...form, working_hours: parseFloat(e.target.value) })} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveGroup} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editingGroup ? 'Update' : 'Add Group'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}