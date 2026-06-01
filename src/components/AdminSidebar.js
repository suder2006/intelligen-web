'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/students', label: 'Students', icon: '👶' },
  { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
  { href: '/admin/staff-groups', label: 'Staff Groups', icon: '⏰' },
  { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
  { href: '/admin/enquiries', label: 'Enquiries CRM', icon: '🎯' },
  { href: '/admin/fees', label: 'Fees', icon: '💳', moduleId: 'fees' },
  { href: '/admin/fee-structure', label: 'Fee Structure', icon: '📊', moduleId: 'fee_structure' },
  { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
  { href: '/admin/checkin', label: 'Check-in/out', icon: '🚪' },
  { href: '/admin/leave', label: 'Leave', icon: '🏖️' },
  { href: '/admin/holidays', label: 'Holidays', icon: '📅' },
  { href: '/admin/staff-report', label: 'Staff Report', icon: '📋' },
  { href: '/admin/payroll', label: 'Payroll', icon: '💰', moduleId: 'payroll' },
  { href: '/admin/messages', label: 'Messages', icon: '💬' },
  { href: '/admin/curriculum/masters', label: 'Curriculum', icon: '📖' },
  { href: '/admin/moments', label: 'Moments', icon: '📸' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
  { href: '/admin/home-activities', label: 'Home Activities', icon: '🏠' },
  { href: '/admin/ptm', label: 'PTM', icon: '🤝' },
  { href: '/admin/birthdays', label: 'Birthdays', icon: '🎂' },
  { href: '/admin/transport', label: 'Transport', icon: '🚌' },
  { href: '/admin/diary', label: 'Diary', icon: '📔' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️', moduleId: 'settings' },
]

export default function AdminSidebar({ active }) {
  const pathname = usePathname()
  const router = useRouter()

  // Password protection state
  const [restrictions, setRestrictions] = useState(null) // null = not loaded yet
  const [unlockedModules, setUnlockedModules] = useState([]) // unlocked this session
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingNav, setPendingNav] = useState(null) // { href, moduleId }
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [checkingPassword, setCheckingPassword] = useState(false)
  const [schoolModulePassword, setSchoolModulePassword] = useState('')
  const [isMainAdmin, setIsMainAdmin] = useState(false)

  useEffect(() => { loadRestrictions() }, [])

  const loadRestrictions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, schools(module_access_password)')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Store school's module password
      setSchoolModulePassword(profile.schools?.module_access_password || '')

      // Check if this user is the main admin (school_admin role)
      // Main admin has no restrictions
      if (profile.role === 'school_admin') {
        setIsMainAdmin(true)
        setRestrictions([]) // no restrictions for main admin
        return
      }

      // Load restrictions for this user
      const { data: restrictionData } = await supabase
        .from('sub_admin_restrictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      setRestrictions(restrictionData?.restricted_modules || [])
    } catch (e) {
      setRestrictions([])
    }
  }

  const isModuleRestricted = (moduleId) => {
    if (!moduleId) return false
    if (isMainAdmin) return false
    if (!restrictions) return false
    if (unlockedModules.includes(moduleId)) return false
    return restrictions.includes(moduleId)
  }

  const handleNavClick = (e, item) => {
    if (!item.moduleId) return // not a restricted module
    if (isMainAdmin) return // main admin — no restriction
    if (!restrictions) return // not loaded yet
    if (!restrictions.includes(item.moduleId)) return // not restricted for this user
    if (unlockedModules.includes(item.moduleId)) return // already unlocked this session

    // Module is restricted and not unlocked — show password modal
    e.preventDefault()
    setPendingNav(item)
    setPasswordInput('')
    setPasswordError('')
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = async () => {
    if (!passwordInput) { setPasswordError('Please enter the password'); return }
    setCheckingPassword(true)

    if (!schoolModulePassword) {
      setPasswordError('No access password has been set. Please contact the school admin.')
      setCheckingPassword(false)
      return
    }

    if (passwordInput === schoolModulePassword) {
      // Correct! Unlock this module for the session
      setUnlockedModules(prev => [...prev, pendingNav.moduleId])
      setShowPasswordModal(false)
      setPasswordInput('')
      setPasswordError('')
      // Navigate to the page
      router.push(pendingNav.href)
    } else {
      setPasswordError('❌ Incorrect password. Please try again.')
    }
    setCheckingPassword(false)
  }

  return (
    <>
      <style>{`
        .admin-sidebar { width: 240px; min-height: 100vh; height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; font-family: 'DM Sans', sans-serif; }
        .admin-sidebar .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .admin-sidebar .logo span { color: #38bdf8; }
        .admin-sidebar .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; cursor: pointer; }
        .admin-sidebar .nav-item:hover, .admin-sidebar .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .admin-sidebar .nav-item.locked { color: rgba(255,255,255,0.3); }
        .admin-sidebar .nav-item.locked:hover { background: rgba(239,68,68,0.08); color: #f87171; }
        .lock-badge { margin-left: auto; font-size: 11px; background: rgba(239,68,68,0.15); color: #f87171; padding: 2px 6px; border-radius: 10px; }
        @media (max-width: 768px) { .admin-sidebar { display: none; } }
      `}</style>

      <div className="admin-sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => {
          const isActive = active ? item.href === active : pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
          const locked = isModuleRestricted(item.moduleId)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={(e) => handleNavClick(e, item)}
            >
              <span>{item.icon}</span>
              {item.label}
              {locked && <span className="lock-badge">🔒</span>}
            </Link>
          )
        })}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
            <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '6px', color: '#fff' }}>
              Restricted Module
            </div>
            <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '6px' }}>
              {pendingNav?.icon} {pendingNav?.label}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>
              This module requires the access password. Please enter it below.
            </div>

            <input
              type='password'
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder='Enter access password'
              autoFocus
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${passwordError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', letterSpacing: '3px' }}
            />

            {passwordError && (
              <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{passwordError}</div>
            )}
            {!passwordError && <div style={{ marginBottom: '16px' }} />}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowPasswordModal(false); setPendingNav(null); setPasswordInput(''); setPasswordError('') }}
                style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handlePasswordSubmit} disabled={checkingPassword}
                style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {checkingPassword ? '⏳...' : '🔓 Unlock'}
              </button>
            </div>

            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '16px' }}>
              Contact your school admin if you don't have the password
            </div>
          </div>
        </div>
      )}
    </>
  )
}