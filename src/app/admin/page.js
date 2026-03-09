'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, staff: 0, classes: 0, fees: 0, admissions: 0, attendance: 0 })
  const [schoolName, setSchoolName] = useState('My School')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      const [s, st, cl, f, ad, at] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact' }),
        supabase.from('staff').select('id', { count: 'exact' }),
        supabase.from('classes').select('id', { count: 'exact' }),
        supabase.from('fees').select('amount').eq('status', 'unpaid'),
        supabase.from('admissions').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('attendance').select('id', { count: 'exact' }).eq('date', new Date().toISOString().split('T')[0])
      ])
      const totalUnpaid = f.data?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
      setStats({ students: s.count || 0, staff: st.count || 0, classes: cl.count || 0, fees: totalUnpaid, admissions: ad.count || 0, attendance: at.count || 0 })
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '⊞' },
    { href: '/admin/students', label: 'Students', icon: '👶' },
    { href: '/admin/classes', label: 'Classes', icon: '📚' },
    { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
    { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
    { href: '/admin/fees', label: 'Fees', icon: '💳' },
    { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
    { href: '/admin/messages', label: 'Messages', icon: '💬' },
    { href: '/admin/curriculum', label: 'Curriculum', icon: '📖' },
    { href: '/admin/moments', label: 'Moments', icon: '📸' },
  ]

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: '👶', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
    { label: 'Staff Members', value: stats.staff, icon: '👩‍🏫', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Active Classes', value: stats.classes, icon: '📚', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    { label: 'Pending Admissions', value: stats.admissions, icon: '📋', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Unpaid Fees ($)', value: `$${stats.fees.toLocaleString()}`, icon: '💳', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    { label: "Today's Attendance", value: stats.attendance, icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; }
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
            <div className="page-title">Dashboard</div>
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
    </div>
  )
}