'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, staff: 0, classes: 0, fees: 0, admissions: 0, attendance: 0 })
  const [students, setStudents] = useState([])
  const [school, setSchool] = useState(null)
  const [birthdayTemplate, setBirthdayTemplate] = useState('')
  const [showBirthdaySettings, setShowBirthdaySettings] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [sendingWishes, setSendingWishes] = useState(null)
  const [wishSent, setWishSent] = useState({})

  const [schoolName, setSchoolName] = useState('My School')
  const [schoolId, setSchoolId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
    // Get school_id from profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: schoolData } = await supabase.from('schools').select('name').eq('id', prof?.school_id).single()
      setSchoolName(schoolData?.name || 'My School')
      const schoolId = prof?.school_id
      setSchoolId(schoolId)
      const [s, st, f, ad, at] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }).eq('school_id', schoolId),
        supabase.from('profiles').select('id', { count: 'exact' }).in('role', ['teacher', 'staff']).eq('school_id', schoolId),
        supabase.from('fee_invoices').select('total_amount, paid_amount').eq('school_id', schoolId).neq('status', 'paid'),
        supabase.from('admissions').select('id', { count: 'exact' }).eq('status', 'pending').eq('school_id', schoolId),
        supabase.from('attendance').select('id', { count: 'exact' }).eq('date', new Date().toISOString().split('T')[0])
      ])
      const totalUnpaid = f.data?.reduce((sum, r) => sum + Math.max(0, Number(r.total_amount) - Number(r.paid_amount || 0)), 0) || 0
      setStats({ students: s.count || 0, staff: st.count || 0, classes: 0, fees: totalUnpaid, admissions: ad.count || 0, attendance: at.count || 0 })
      // Load students and school for birthdays
      const [stuRes, schRes, notifRes] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name'),
        supabase.from('schools').select('*').eq('id', schoolId).single(),
        supabase.from('birthday_notifications').select('student_id, notification_date').eq('school_id', schoolId)
      ])
      setStudents(stuRes.data || [])
      setSchool(schRes.data)
      setBirthdayTemplate(schRes.data?.birthday_message_template || '🎂 Happy Birthday, [Name]! 🎉 Wishing you a wonderful day filled with joy and laughter. With love from all of us at [School]! 🌟')
      // Build sent map
      const sentMap = {}
      const today = new Date().toISOString().split('T')[0]
      ;(notifRes.data || []).forEach(n => { if (n.notification_date === today) sentMap[n.student_id] = true })
      setWishSent(sentMap)
      
      setLoading(false)  
    }
    load()
  }, [])

  const getTodayBirthdays = () => {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return students.filter(s => s.date_of_birth && s.date_of_birth.slice(5) === `${mm}-${dd}`)
  }

  const getMonthBirthdays = () => {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return students.filter(s => s.date_of_birth && s.date_of_birth.slice(5, 7) === mm)
      .sort((a, b) => a.date_of_birth.slice(8) - b.date_of_birth.slice(8))
  }

  const getUpcomingBirthdays = () => {
    const today = new Date()
    const upcoming = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const bday = students.filter(s => s.date_of_birth && s.date_of_birth.slice(5) === `${mm}-${dd}`)
      bday.forEach(s => upcoming.push({ ...s, birthdayDate: d.toISOString().split('T')[0] }))
    }
    return upcoming
  }

  const sendBirthdayWish = async (student) => {
    setSendingWishes(student.id)
    const { data: { user } } = await supabase.auth.getUser()
    const message = birthdayTemplate
      .replace(/\[Name\]/g, student.full_name)
      .replace(/\[School\]/g, school?.name || 'School')

    // Get parent
    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', student.id)
    if (ps && ps.length > 0) {
      for (const { parent_id } of ps) {
        await supabase.from('chat_messages').insert({
          sender_id: school?.id,
          receiver_id: parent_id,
          sender_name: school?.name || 'School',
          content: message
        })
      }
    }
    // Log notification
    await supabase.from('birthday_notifications').insert({
      school_id: school?.id,
      student_id: student.id,
      notification_date: new Date().toISOString().split('T')[0],
      sent_by: user.id,
      message
    })
    setWishSent(prev => ({ ...prev, [student.id]: true }))
    setSendingWishes(null)
    alert(`🎂 Birthday wish sent to ${student.full_name}'s parent!`)
  }

  const saveBirthdayTemplate = async () => {
    setSavingTemplate(true)
    try {
      const { error } = await supabase.from('schools').update({ birthday_message_template: birthdayTemplate }).eq('id', schoolId)
      if (error) throw error
    } catch (e) {
      console.error('Save error:', e)
    } finally {
      setSavingTemplate(false)
      setShowBirthdaySettings(false)
    }
  }

  const sendAllTodayWishes = async () => {
    const todays = getTodayBirthdays().filter(s => !wishSent[s.id])
    if (todays.length === 0) { alert('All wishes already sent today!'); return }
    if (!confirm(`Send birthday wishes to ${todays.length} student(s)?`)) return
    for (const s of todays) { await sendBirthdayWish(s) }
  }
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '⊞' },
    { href: '/admin/students', label: 'Students', icon: '👶' },
    { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
    { href: '/admin/staff-groups', label: 'Staff Groups', icon: '⏰' },
    { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
    { href: '/admin/enquiries', label: 'Enquiries CRM', icon: '🎯' },
    { href: '/admin/fees', label: 'Fees', icon: '💳' },
    { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊' },
    { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
    { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
    { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
    { href: '/admin/holidays', label: 'Holidays', icon: '📅' },
    { href: '/admin/staff-report', label: 'Staff Report', icon: '📋' },
    { href: '/admin/payroll', label: 'Payroll', icon: '💰' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
    { href: '/admin/curriculum/masters', label: 'Curriculum', icon: '📖' },
    { href: '/admin/moments', label: 'Moments', icon: '📸' },
    { href: '/admin/skills', label: 'Skills', icon: '🎯' },
    { href: '/admin/home-activities', label: 'Home Activities', icon: '🏠' },
    { href: '/admin/ptm', label: 'PTM', icon: '🤝' },
    { href: '/admin/birthdays', label: 'Birthdays', icon: '🎂' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ]

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: '👶', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    { label: 'Staff Members', value: stats.staff, icon: '👩‍🏫', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Active Classes', value: stats.classes, icon: '📚', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    { label: 'Pending Admissions', value: stats.admissions, icon: '📋', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Unpaid Fees (₹)', value: `₹${stats.fees.toLocaleString()}`, icon: '💳', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { label: "Today's Attendance", value: stats.attendance, icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .sidebar { width: 240px; min-height: 100vh; height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; overflow-y: auto; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .nav-item.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .page-title { font-size: 24px; font-weight: 700; }
        .page-sub { color: rgba(255,255,255,0.4); font-size: 14px; margin-top: 4px; }
        .logout-btn { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); color: #f87171; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; }
        .logout-btn:hover { background: rgba(239,68,68,0.25); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .stat-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; transition: all 0.2s; cursor: default; }
        .stat-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.12); }
        .stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; }
        .stat-value { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .quick-link { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; text-decoration: none; color: #fff; text-align: center; transition: all 0.2s; }
        .quick-link:hover { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.2); transform: translateY(-2px); }
        .quick-link-icon { font-size: 28px; margin-bottom: 8px; }
        .quick-link-label { font-size: 13px; color: rgba(255,255,255,0.6); font-weight: 500; }
        .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: rgba(255,255,255,0.8); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 20px; } }
      `}</style>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <button className="logout-btn" onClick={handleLogout}>🚪 Sign Out</button>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="topbar">
          <div>
            <div className="page-title">{schoolName}</div>
            <div className="page-sub">Welcome back! Here's what's happening today.</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Stats */}
        <div className="section-title">Overview</div>
        <div className="stats-grid">
          {statCards.map(card => (
            <div key={card.label} className="stat-card">
              <div className="stat-icon" style={{ background: card.bg }}>
                {card.icon}
              </div>
              <div className="stat-value" style={{ color: card.color }}>{loading ? '...' : card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>
        {/* Birthday Section */}
        {(() => {
          const todayBdays = getTodayBirthdays()
          const monthBdays = getMonthBirthdays()
          const upcomingBdays = getUpcomingBirthdays()
          return (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>🎂 Birthdays</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {todayBdays.length > 0 && (
                    <button onClick={sendAllTodayWishes}
                      style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                      🎉 Send All Today's Wishes
                    </button>
                  )}
                  <button onClick={() => setShowBirthdaySettings(true)}
                    style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    ✏️ Edit Template
                  </button>
                </div>
              </div>

              {/* Today's Birthdays */}
              {todayBdays.length > 0 ? (
                <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.05))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: '#fbbf24', marginBottom: '14px', fontSize: '15px' }}>🎂 Today's Birthdays ({todayBdays.length})</div>
                  {todayBdays.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(245,158,11,0.1)', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', color: '#000' }}>
                          {s.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{s.full_name}</div>
                          <div style={{ color: '#fbbf24', fontSize: '12px' }}>{s.program} · 🎂 Today!</div>
                        </div>
                      </div>
                      <button onClick={() => sendBirthdayWish(s)} disabled={sendingWishes === s.id || wishSent[s.id]}
                        style={{ padding: '6px 14px', background: wishSent[s.id] ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.2)', border: `1px solid ${wishSent[s.id] ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '8px', color: wishSent[s.id] ? '#34d399' : '#fbbf24', cursor: wishSent[s.id] ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                        {sendingWishes === s.id ? '⏳ Sending...' : wishSent[s.id] ? '✅ Wish Sent!' : '🎉 Send Wish'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                  No birthdays today 🎈
                </div>
              )}

              {/* Upcoming Birthdays */}
              {upcomingBdays.length > 0 && (
                <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', color: '#a78bfa', marginBottom: '12px', fontSize: '14px' }}>📅 Upcoming (Next 7 Days)</div>
                  {upcomingBdays.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(167,139,250,0.08)', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{s.full_name}</span>
                        <span style={{ color: '#a78bfa', fontSize: '12px', marginLeft: '8px' }}>{s.program}</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                        {new Date(s.birthdayDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* This Month */}
              {monthBdays.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '12px', fontSize: '14px' }}>
                    📋 This Month's Birthdays ({monthBdays.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {monthBdays.map(s => {
                      const day = s.date_of_birth.slice(8)
                      const isToday = getTodayBirthdays().find(t => t.id === s.id)
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: isToday ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${isToday ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isToday ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: isToday ? '#000' : '#fff', flexShrink: 0 }}>
                            {day}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: isToday ? '#fbbf24' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{s.program}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
        {/* Quick Links */}
        <div className="section-title">Quick Access</div>
        <div className="quick-links">
          {navItems.slice(1).map(item => (
            <Link key={item.href} href={item.href} className="quick-link">
              <div className="quick-link-icon">{item.icon}</div>
              <div className="quick-link-label">{item.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Birthday Template Modal */}
      {showBirthdaySettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
          onClick={() => setShowBirthdaySettings(false)}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>🎂 Birthday Message Template</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px' }}>Use [Name] for student name and [School] for school name.</p>
            <textarea value={birthdayTemplate} onChange={e => setBirthdayTemplate(e.target.value)} rows={5}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", resize: 'vertical', marginBottom: '16px' }} />
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '4px' }}>Preview:</div>
              {birthdayTemplate.replace(/\[Name\]/g, 'Aarav').replace(/\[School\]/g, school?.name || 'School')}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowBirthdaySettings(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 18px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={saveBirthdayTemplate} disabled={savingTemplate}
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {savingTemplate ? '⏳ Saving...' : '💾 Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}