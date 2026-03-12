'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const FEE_TYPES = ['Registration Fee', 'Admission Fee', 'Annual Fee', 'Tuition Fee', 'Books & Materials', 'Uniform', 'Event Fee', 'Daycare Fee', 'Transport Fee']

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
]

export default function FeeStructurePage() {
  const [structures, setStructures] = useState([])
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [academicYears, setAcademicYears] = useState([])
  const currentAY = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  const [selectedYear, setSelectedYear] = useState(currentAY)
  const [showAddYear, setShowAddYear] = useState(false)
  const [newYear, setNewYear] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { program, fee_type }
  const [editValue, setEditValue] = useState('')
  const [showAddProgram, setShowAddProgram] = useState(false)
  const [newProgram, setNewProgram] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [str, progs] = await Promise.all([
      supabase.from('fee_structures').select('*').order('program'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').order('value')
    ])
    const allStructures = str.data || []
    setStructures(allStructures)
    setPrograms(progs?.data?.map(p => p.value) || [])
    // Collect all academic years from structures + current
    const years = [...new Set([currentAY, ...allStructures.map(s => s.academic_year).filter(Boolean)])]
    years.sort().reverse()
    setAcademicYears(years)
    setLoading(false)
  }

  const getAmount = (program, feeType) => {
    const match = structures.find(s => s.program === program && s.fee_type === feeType && s.academic_year === selectedYear)
    return match ? match.amount : null
  }

  const saveCell = async (program, feeType, amount) => {
    if (!amount && amount !== 0) { setEditingCell(null); return }
    setSaving(true)
    const existing = structures.find(s => s.program === program && s.fee_type === feeType && s.academic_year === selectedYear)
    if (existing) {
      await supabase.from('fee_structures').update({ amount: parseFloat(amount) }).eq('id', existing.id)
    } else {
      await supabase.from('fee_structures').insert({ program, fee_type: feeType, amount: parseFloat(amount), academic_year: selectedYear })
    }
    setEditingCell(null)
    setEditValue('')
    await fetchAll()
    setSaving(false)
  }

  const deleteCell = async (program, feeType) => {
    const existing = structures.find(s => s.program === program && s.fee_type === feeType && s.academic_year === selectedYear)
    if (existing) {
      await supabase.from('fee_structures').delete().eq('id', existing.id)
      await fetchAll()
    }
  }

  const addYear = () => {
    if (!newYear.trim()) return
    const formatted = newYear.trim()
    setAcademicYears(prev => [...new Set([...prev, formatted])].sort().reverse())
    setSelectedYear(formatted)
    setNewYear('')
    setShowAddYear(false)
  }

  const copyFromPrevYear = async () => {
    const sorted = [...academicYears].sort()
    const currentIndex = sorted.indexOf(selectedYear)
    if (currentIndex <= 0) { alert('No previous year to copy from'); return }
    const prevYear = sorted[currentIndex - 1]
    const prevStructures = structures.filter(s => s.academic_year === prevYear)
    if (prevStructures.length === 0) { alert(`No fee structure found for ${prevYear}`); return }
    if (!confirm(`Copy all fees from ${prevYear} to ${selectedYear}?`)) return
    setSaving(true)
    for (const s of prevStructures) {
      const exists = structures.find(x => x.program === s.program && x.fee_type === s.fee_type && x.academic_year === selectedYear)
      if (!exists) {
        await supabase.from('fee_structures').insert({ program: s.program, fee_type: s.fee_type, amount: s.amount, academic_year: selectedYear })
      }
    }
    await fetchAll()
    setSaving(false)
  }

  const programTotals = (program) => {
    return structures.filter(s => s.program === program && s.academic_year === selectedYear).reduce((sum, s) => sum + Number(s.amount), 0)
  }

  const yearStructures = structures.filter(s => s.academic_year === selectedYear)

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
        .year-tab { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .year-tab.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .year-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .grid-table { width: 100%; border-collapse: collapse; }
        .grid-table th { padding: 12px 16px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); white-space: nowrap; }
        .grid-table td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .grid-table tr:last-child td { border-bottom: none; }
        .grid-table tr:hover td { background: rgba(255,255,255,0.02); }
        .amount-cell { color: #10b981; font-weight: 600; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 6px; display: inline-block; }
        .amount-cell:hover { background: rgba(16,185,129,0.1); }
        .empty-cell { color: rgba(255,255,255,0.15); font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 6px; display: inline-block; }
        .empty-cell:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); }
        .cell-input { background: #0f172a; border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 14px; width: 110px; outline: none; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 400px; }
        .print-hide { }
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .main { margin-left: 0 !important; padding: 20px !important; }
          body { background: white !important; color: black !important; }
          .grid-table th { color: #333 !important; background: #f5f5f5 !important; }
          .grid-table td { color: #333 !important; border-color: #ddd !important; }
          .amount-cell { color: #16a34a !important; }
        }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/fee-structure' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📊 Fee Structure</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Standard fee reference by program & academic year</p>
          </div>
          <div className="print-hide" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={copyFromPrevYear} className="btn-secondary" disabled={saving}>📋 Copy from Prev Year</button>
            <button onClick={() => window.print()} className="btn-secondary">🖨️ Print</button>
          </div>
        </div>

        {/* Academic Year Tabs */}
        <div className="print-hide" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginRight: '4px' }}>Academic Year:</span>
          {academicYears.map(year => (
            <button key={year} className={`year-tab ${selectedYear === year ? 'active' : ''}`} onClick={() => setSelectedYear(year)}>
              {year}
            </button>
          ))}
          <button onClick={() => setShowAddYear(true)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}>
            + New Year
          </button>
        </div>

        {/* Print Header */}
        <div style={{ display: 'none' }} className="print-show">
          <h2>Time Kids Preschool — Fee Structure {selectedYear}</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>No programs found. Add programs in Curriculum Masters first.</div>
        ) : (
          <>
            {/* Summary cards per program */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }} className="print-hide">
              {programs.map(prog => (
                <div key={prog} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px' }}>
                  <div style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>{prog}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                    {programTotals(prog) > 0 ? `₹${programTotals(prog).toLocaleString()}` : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>Not set</span>}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '2px' }}>Total annual fees</div>
                </div>
              ))}
            </div>

            {/* Fee Grid Table */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'auto' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>Fee Structure — {selectedYear}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }} className="print-hide">Click any cell to edit amount</span>
              </div>
              <table className="grid-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '160px' }}>Fee Type</th>
                    {programs.map(prog => <th key={prog} style={{ minWidth: '140px', textAlign: 'right' }}>{prog}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {FEE_TYPES.map(feeType => (
                    <tr key={feeType}>
                      <td style={{ fontWeight: '500', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>{feeType}</td>
                      {programs.map(prog => {
                        const amount = getAmount(prog, feeType)
                        const isEditing = editingCell?.program === prog && editingCell?.fee_type === feeType
                        return (
                          <td key={prog} style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <input
                                  autoFocus
                                  className="cell-input"
                                  type='number'
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveCell(prog, feeType, editValue)
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }}
                                  placeholder='Amount'
                                />
                                <button onClick={() => saveCell(prog, feeType, editValue)}
                                  style={{ padding: '6px 8px', background: '#10b981', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✓</button>
                                {amount && <button onClick={() => deleteCell(prog, feeType)}
                                  style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
                              </div>
                            ) : amount !== null ? (
                              <span className="amount-cell" onClick={() => { setEditingCell({ program: prog, fee_type: feeType }); setEditValue(String(amount)) }}>
                                ₹{Number(amount).toLocaleString()}
                              </span>
                            ) : (
                              <span className="empty-cell print-hide" onClick={() => { setEditingCell({ program: prog, fee_type: feeType }); setEditValue('') }}>
                                + Add
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    <td style={{ fontWeight: '700', color: '#38bdf8', fontSize: '14px' }}>Total</td>
                    {programs.map(prog => (
                      <td key={prog} style={{ textAlign: 'right', fontWeight: '700', color: '#38bdf8', fontSize: '15px' }}>
                        {programTotals(prog) > 0 ? `₹${programTotals(prog).toLocaleString()}` : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {yearStructures.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
                No fees set for {selectedYear} yet. Click any cell in the table above to add amounts.
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Year Modal */}
      {showAddYear && (
        <div className="modal-overlay" onClick={() => setShowAddYear(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>📅 Add Academic Year</h3>
            <input
              autoFocus
              value={newYear}
              onChange={e => setNewYear(e.target.value)}
              placeholder='e.g. 2026-2027'
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '16px', fontFamily: "'DM Sans', sans-serif" }}
              onKeyDown={e => e.key === 'Enter' && addYear()}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddYear(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '9px 18px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addYear} style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Add Year</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}