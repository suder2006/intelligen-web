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
  { href: '/admin/curriculum', label: 'Curriculum', icon: '📖' },
  { href: '/admin/moments', label: 'Moments', icon: '📸' },
  { href: '/admin/skills', label: 'Skills', icon: '🎯' },
  { href: '/admin/home-activities', label: 'Home Activities', icon: '🏠' },
  { href: '/admin/ptm', label: 'PTM', icon: '🤝' },
  { href: '/admin/birthdays', label: 'Birthdays', icon: '🎂' },
  { href: '/admin/transport', label: 'Transport', icon: '🚌' },
  { href: '/admin/events', label: 'Events', icon: '📅' },
  { href: '/admin/diary', label: 'Diary', icon: '📔' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️', moduleId: 'settings' },
]

export default function AdminSidebar({ active }) {
  const pathname = usePathname()
  const router = useRouter()

  const [restrictedModules, setRestrictedModules] = useState([])
  const [unlockedModules, setUnlockedModules] = useState([])
  const [isMainAdmin, setIsMainAdmin] = useState(false)
  const [schoolPassword, setSchoolPassword] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Password modal state
  const [showModal, setShowModal] = useState(false)
  const [pendingItem, setPendingItem] = useState(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => { loadRestrictions() }, [])

  const loadRestrictions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, school_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      // Get school password
      const { data: school } = await supabase
        .from('schools')
        .select('module_access_password')
        .eq('id', profile.school_id)
        .single()

      setSchoolPassword(school?.module_access_password || '')

      // Check if this user has restrictions
      const { data: restriction } = await supabase
        .from('sub_admin_restrictions')
        .select('restricted_modules, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!restriction) {
        // No restrictions = main admin = full access
        setIsMainAdmin(true)
        setRestrictedModules([])
      } else {
        setIsMainAdmin(false)
        setRestrictedModules(restriction.restricted_modules || [])
      }
    } catch (e) {
      console.error('Error loading restrictions:', e)
    }
    setLoaded(true)
  }

  const isLocked = (moduleId) => {
    if (!moduleId) return false
    if (isMainAdmin) return false
    if (unlockedModules.includes(moduleId)) return false
    return restrictedModules.includes(moduleId)
  }

  const handleNavClick = (e, item) => {
    if (!item.moduleId) return
    if (!isLocked(item.moduleId)) return
    e.preventDefault()
    setPendingItem(item)
    setPasswordInput('')
    setPasswordError('')
    setShowModal(true)
  }

  const handleUnlock = async () => {
    if (!passwordInput) { setPasswordError('Please enter the password'); return }
    setChecking(true)
    if (!schoolPassword) {
      setPasswordError('No access password set. Contact your school admin.')
      setChecking(false)
      return
    }
    if (passwordInput === schoolPassword) {
      setUnlockedModules(prev => [...prev, pendingItem.moduleId])
      setShowModal(false)
      setPasswordInput('')
      setPasswordError('')
      router.push(pendingItem.href)
    } else {
      setPasswordError('❌ Incorrect password. Please try again.')
    }
    setChecking(false)
  }

  return (
    <>
      <style>{`
        .admin-sidebar { width: 240px; min-height: 100vh; height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; font-family: 'DM Sans', sans-serif; }
        .admin-sidebar .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .admin-sidebar .logo span { color: #38bdf8; }
        .admin-sidebar .nav-item { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; cursor: pointer; position: relative; }
        .admin-sidebar .nav-item:hover { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .admin-sidebar .nav-item.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .admin-sidebar .nav-item.locked { color: rgba(255,255,255,0.3); }
        .admin-sidebar .nav-item.locked:hover { background: rgba(239,68,68,0.08); color: rgba(255,100,100,0.7); }
        .lock-icon { margin-left: auto; font-size: 11px; opacity: 0.6; }
        @media (max-width: 768px) { .admin-sidebar { display: none; } }
      `}</style>

      <div className="admin-sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => {
          const isActive = active
            ? item.href === active
            : pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
          const locked = isLocked(item.moduleId)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}
              onClick={(e) => handleNavClick(e, item)}
            >
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {locked && <span className="lock-icon">🔒</span>}
            </Link>
          )
        })}
      </div>

      {/* Password Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#fff', marginBottom: '6px' }}>Restricted Module</div>
            <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '6px' }}>
              {pendingItem?.icon} {pendingItem?.label}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>
              Enter the access password to unlock this module.
            </div>

            <input
              type='password'
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              placeholder='Enter access password'
              autoFocus
              style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${passwordError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`, borderRadius: '10px', color: '#fff', fontSize: '15px', outline: 'none', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', letterSpacing: '4px' }}
            />

            {passwordError && (
              <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{passwordError}</div>
            )}
            {!passwordError && <div style={{ height: '24px' }} />}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowModal(false); setPendingItem(null); setPasswordInput(''); setPasswordError('') }}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                disabled={checking}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                {checking ? '⏳' : '🔓 Unlock'}
              </button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', marginTop: '16px' }}>
              Contact your school admin if you don't have the password
            </div>
          </div>
        </div>
      )}
    </>
  )
}