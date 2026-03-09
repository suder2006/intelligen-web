'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function CurriculumHome() {
  const router = useRouter()

  const sections = [
    { href: '/admin/curriculum/blocks', icon: '📅', title: 'Curriculum Blocks', desc: 'Manage term/unit date ranges (Block 1, Block 2...)', color: '#38bdf8' },
    { href: '/admin/curriculum/masters', icon: '📋', title: 'Master Lists', desc: 'Manage Programs, Activities, Categories & Types', color: '#a78bfa' },
    { href: '/admin/curriculum/planner', icon: '📝', title: 'Curriculum Planner', desc: 'Plan weekly activities per program and block', color: '#10b981' },
    { href: '/admin/curriculum/newsletter', icon: '📰', title: 'Newsletter', desc: 'Generate and send weekly newsletters to parents', color: '#f59e0b' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>📚 Curriculum Management</h1>
            <p style={{ color: '#64748b', marginTop: '4px' }}>Plan, track and share curriculum with teachers and parents</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {sections.map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = s.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{s.icon}</div>
                <h3 style={{ color: s.color, fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{s.title}</h3>
                <p style={{ color: '#64748b', fontSize: '14px' }}>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}