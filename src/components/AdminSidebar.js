'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  { href: '/admin/transport', label: 'Transport', icon: '🚌' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminSidebar({ active }) {
  const pathname = usePathname()

  return (
    <>
      <style>{`
        .admin-sidebar { width: 240px; min-height: 100vh; height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; overflow-y: auto; font-family: 'DM Sans', sans-serif; }
        .admin-sidebar .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .admin-sidebar .logo span { color: #38bdf8; }
        .admin-sidebar .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .admin-sidebar .nav-item:hover, .admin-sidebar .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        @media (max-width: 768px) { .admin-sidebar { display: none; } }
      `}</style>
      <div className="admin-sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => {
          const isActive = active ? item.href === active : pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span> {item.label}
            </Link>
          )
        })}
      </div>
    </>
  )
}