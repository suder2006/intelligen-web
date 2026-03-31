'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'



export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('fee-summary')
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [invoices, setInvoices] = useState([])
  const [installments, setInstallments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterProgram, setFilterProgram] = useState('all')
  const [programs, setPrograms] = useState([])
  
  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [s, inv, inst, att, progs] = await Promise.all([
      supabase.from('students').select('*').eq('status', 'active').eq('school_id', schoolId).order('full_name'),
      supabase.from('fee_invoices').select('*, students(full_name, program)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('fee_installments').select('*').order('due_date'),
      supabase.from('attendance').select('*, students(full_name, program)').order('date', { ascending: false }),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value')
    ])
    setStudents(s.data || [])
    setInvoices(inv.data || [])
    setInstallments(inst.data || [])
    setAttendance(att.data || [])
    setPrograms(progs?.data?.map(p => p.value) || [])
    setLoading(false)
  }

  // Fee calculations
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0)
  const totalPending = totalInvoiced - totalCollected
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const partialInvoices = invoices.filter(i => i.status === 'partial')
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid')

  // Attendance calculations for selected month
  const monthAttendance = attendance.filter(a => a.date?.startsWith(filterMonth))
  const filteredStudents = filterProgram === 'all' ? students : students.filter(s => s.program === filterProgram)

  const getStudentAttendance = (studentId, monthFilter) => {
    const recs = attendance.filter(a => a.student_id === studentId && (!monthFilter || a.date?.startsWith(monthFilter)))
    return {
      present: recs.filter(a => a.status === 'present').length,
      absent: recs.filter(a => a.status === 'absent').length,
      late: recs.filter(a => a.status === 'late').length,
      total: recs.length,
      pct: recs.length > 0 ? Math.round((recs.filter(a => a.status === 'present').length / recs.length) * 100) : 0
    }
  }

  // Export to Excel (CSV)
  const exportCSV = (headers, rows, filename) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportFeeCollection = () => {
    exportCSV(
      ['Student', 'Program', 'Fee Type', 'Academic Year', 'Total Amount', 'Paid Amount', 'Pending', 'Status', 'Payment Mode', 'Due Date'],
      invoices.map(i => [
        i.students?.full_name || '',
        i.students?.program || '',
        i.fee_type,
        i.academic_year || '',
        i.total_amount,
        i.paid_amount || 0,
        Number(i.total_amount) - Number(i.paid_amount || 0),
        i.status,
        i.payment_mode || '',
        i.due_date || ''
      ]),
      'fee-collection-report.csv'
    )
  }

  const exportAttendance = () => {
    exportCSV(
      ['Student', 'Program', 'Present', 'Absent', 'Late', 'Total Days', 'Attendance %'],
      filteredStudents.map(s => {
        const stats = getStudentAttendance(s.id, filterMonth)
        return [s.full_name, s.program || '', stats.present, stats.absent, stats.late, stats.total, `${stats.pct}%`]
      }),
      `attendance-report-${filterMonth}.csv`
    )
  }

  const reportTabs = [
    { id: 'fee-summary', label: '💰 Fee Summary' },
    { id: 'student-fees', label: '👶 Student Fees' },
    { id: 'program-fees', label: '📚 Program Fees' },
    { id: 'daily-attendance', label: '📅 Daily Attendance' },
    { id: 'student-attendance', label: '✅ Student Attendance' },
    { id: 'monthly-attendance', label: '📆 Monthly Overview' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .report-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
        .report-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .report-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 600px; }
        th { padding: 12px 16px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); white-space: nowrap; }
        td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .progress-bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .main { margin-left: 0 !important; padding: 20px !important; }
          body { background: white !important; color: black !important; }
          th { color: #333 !important; background: #f5f5f5 !important; border-color: #ddd !important; }
          td { color: #333 !important; border-color: #eee !important; }
          .card { border: 1px solid #ddd !important; background: #fff !important; }
          .table-wrap { border: 1px solid #ddd !important; }
        }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>📈 Reports</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Fee collection & attendance reports</p>
          </div>
          <div className="print-hide" style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => window.print()} className="btn-secondary">🖨️ Print</button>
            {['fee-summary', 'student-fees', 'program-fees'].includes(activeReport) && (
              <button onClick={exportFeeCollection} className="btn-secondary">📥 Export Excel</button>
            )}
            {['student-attendance', 'monthly-attendance'].includes(activeReport) && (
              <button onClick={exportAttendance} className="btn-secondary">📥 Export Excel</button>
            )}
          </div>
        </div>

        {/* Report Tabs */}
        <div className="print-hide" style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '6px' }}>
          {reportTabs.map(tab => (
            <button key={tab.id} className={`report-tab ${activeReport === tab.id ? 'active' : ''}`} onClick={() => setActiveReport(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* FEE SUMMARY */}
            {activeReport === 'fee-summary' && (
              <>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>💰 Fee Collection Summary</h2>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                  {[
                    { label: 'Total Invoiced', value: `₹${totalInvoiced.toLocaleString()}`, color: '#38bdf8' },
                    { label: 'Collected', value: `₹${totalCollected.toLocaleString()}`, color: '#10b981' },
                    { label: 'Pending', value: `₹${totalPending.toLocaleString()}`, color: '#f59e0b' },
                    { label: 'Paid Invoices', value: paidInvoices.length, color: '#10b981' },
                    { label: 'Partial', value: partialInvoices.length, color: '#38bdf8' },
                    { label: 'Unpaid', value: unpaidInvoices.length, color: '#ef4444' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '18px' }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: item.color, marginBottom: '4px' }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Collection Rate */}
                <div className="card" style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '600' }}>Overall Collection Rate</span>
                    <span style={{ color: '#10b981', fontWeight: '700' }}>{totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0}%`, background: '#10b981' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                    <span>Collected: ₹{totalCollected.toLocaleString()}</span>
                    <span>Pending: ₹{totalPending.toLocaleString()}</span>
                  </div>
                </div>

                {/* Fee Type Breakdown */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>Fee Type Breakdown</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fee Type</th>
                        <th>Invoices</th>
                        <th>Total Invoiced</th>
                        <th>Collected</th>
                        <th>Pending</th>
                        <th>Collection %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set(invoices.map(i => i.fee_type))].map(feeType => {
                        const typeInvoices = invoices.filter(i => i.fee_type === feeType)
                        const typeTotal = typeInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
                        const typePaid = typeInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0)
                        const typePct = typeTotal > 0 ? Math.round((typePaid / typeTotal) * 100) : 0
                        return (
                          <tr key={feeType}>
                            <td style={{ fontWeight: '500' }}>{feeType}</td>
                            <td>{typeInvoices.length}</td>
                            <td style={{ color: '#38bdf8' }}>₹{typeTotal.toLocaleString()}</td>
                            <td style={{ color: '#10b981' }}>₹{typePaid.toLocaleString()}</td>
                            <td style={{ color: '#f59e0b' }}>₹{(typeTotal - typePaid).toLocaleString()}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="progress-bar" style={{ flex: 1, minWidth: '60px' }}>
                                  <div className="progress-fill" style={{ width: `${typePct}%`, background: typePct >= 75 ? '#10b981' : typePct >= 50 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', minWidth: '35px' }}>{typePct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* STUDENT-WISE FEES */}
            {activeReport === 'student-fees' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700' }}>👶 Student-wise Fee Report</h2>
                  <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                    <option value='all'>All Programs</option>
                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Program</th>
                        <th>Invoices</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Pending</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => {
                        const sInvoices = invoices.filter(i => i.student_id === s.id)
                        const sTotal = sInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0)
                        const sPaid = sInvoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0)
                        const sPending = sTotal - sPaid
                        const allPaid = sInvoices.length > 0 && sInvoices.every(i => i.status === 'paid')
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '500' }}>{s.full_name}</td>
                            <td><span style={{ color: '#a78bfa', fontSize: '13px' }}>{s.program || '—'}</span></td>
                            <td>{sInvoices.length}</td>
                            <td style={{ color: '#38bdf8' }}>₹{sTotal.toLocaleString()}</td>
                            <td style={{ color: '#10b981' }}>₹{sPaid.toLocaleString()}</td>
                            <td style={{ color: sPending > 0 ? '#f59e0b' : '#10b981' }}>₹{sPending.toLocaleString()}</td>
                            <td>
                              <span className="badge" style={{
                                background: allPaid ? 'rgba(16,185,129,0.15)' : sPending > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)',
                                color: allPaid ? '#34d399' : sPending > 0 ? '#fbbf24' : '#38bdf8'
                              }}>{sInvoices.length === 0 ? 'No Invoice' : allPaid ? 'All Paid' : 'Pending'}</span>
                            </td>
                          </tr>
                        )
                      })}
                      {/* Total Row */}
                      <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: '700' }}>
                        <td colSpan={3} style={{ color: '#38bdf8' }}>Total ({filteredStudents.length} students)</td>
                        <td style={{ color: '#38bdf8' }}>₹{filteredStudents.reduce((s, st) => s + invoices.filter(i => i.student_id === st.id).reduce((sum, i) => sum + Number(i.total_amount), 0), 0).toLocaleString()}</td>
                        <td style={{ color: '#10b981' }}>₹{filteredStudents.reduce((s, st) => s + invoices.filter(i => i.student_id === st.id).reduce((sum, i) => sum + Number(i.paid_amount || 0), 0), 0).toLocaleString()}</td>
                        <td style={{ color: '#f59e0b' }}>₹{filteredStudents.reduce((s, st) => {
                          const inv = invoices.filter(i => i.student_id === st.id)
                          return s + inv.reduce((sum, i) => sum + Number(i.total_amount) - Number(i.paid_amount || 0), 0)
                        }, 0).toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* PROGRAM-WISE FEES */}
            {activeReport === 'program-fees' && (
              <>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>📚 Program-wise Fee Report</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Students</th>
                        <th>Invoices</th>
                        <th>Total Invoiced</th>
                        <th>Collected</th>
                        <th>Pending</th>
                        <th>Collection %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map(prog => {
                        const progStudents = students.filter(s => s.program === prog)
                        const progInvoices = invoices.filter(i => progStudents.some(s => s.id === i.student_id))
                        const progTotal = progInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
                        const progPaid = progInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0)
                        const progPct = progTotal > 0 ? Math.round((progPaid / progTotal) * 100) : 0
                        return (
                          <tr key={prog}>
                            <td style={{ fontWeight: '600', color: '#a78bfa' }}>{prog}</td>
                            <td>{progStudents.length}</td>
                            <td>{progInvoices.length}</td>
                            <td style={{ color: '#38bdf8' }}>₹{progTotal.toLocaleString()}</td>
                            <td style={{ color: '#10b981' }}>₹{progPaid.toLocaleString()}</td>
                            <td style={{ color: '#f59e0b' }}>₹{(progTotal - progPaid).toLocaleString()}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="progress-bar" style={{ flex: 1, minWidth: '80px' }}>
                                  <div className="progress-fill" style={{ width: `${progPct}%`, background: progPct >= 75 ? '#10b981' : '#f59e0b' }} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: progPct >= 75 ? '#10b981' : '#f59e0b' }}>{progPct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* DAILY ATTENDANCE */}
            {activeReport === 'daily-attendance' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700' }}>📅 Daily Attendance Summary</h2>
                  <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                    <option value='all'>All Programs</option>
                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {(() => {
                  const dates = [...new Set(attendance.map(a => a.date))].sort().reverse().slice(0, 30)
                  return (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Present</th>
                            <th>Absent</th>
                            <th>Late</th>
                            <th>Total Marked</th>
                            <th>Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dates.map(date => {
                            const dayRecs = attendance.filter(a => a.date === date && (filterProgram === 'all' || a.students?.program === filterProgram))
                            const present = dayRecs.filter(a => a.status === 'present').length
                            const absent = dayRecs.filter(a => a.status === 'absent').length
                            const late = dayRecs.filter(a => a.status === 'late').length
                            const pct = dayRecs.length > 0 ? Math.round((present / dayRecs.length) * 100) : 0
                            return (
                              <tr key={date}>
                                <td style={{ fontWeight: '500' }}>{date}</td>
                                <td><span style={{ color: '#10b981', fontWeight: '600' }}>{present}</span></td>
                                <td><span style={{ color: '#ef4444', fontWeight: '600' }}>{absent}</span></td>
                                <td><span style={{ color: '#f59e0b', fontWeight: '600' }}>{late}</span></td>
                                <td>{dayRecs.length}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="progress-bar" style={{ flex: 1, minWidth: '60px' }}>
                                      <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 75 ? '#10b981' : '#ef4444' }} />
                                    </div>
                                    <span style={{ fontSize: '12px', color: pct >= 75 ? '#10b981' : '#ef4444', fontWeight: '600' }}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          {dates.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No attendance records found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </>
            )}

            {/* STUDENT-WISE ATTENDANCE */}
            {activeReport === 'student-attendance' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700' }}>✅ Student-wise Attendance</h2>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                      style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }}>
                      <option value='all'>All Programs</option>
                      {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                      style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Program</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Total Days</th>
                        <th>Attendance %</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => {
                        const stats = getStudentAttendance(s.id, filterMonth)
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '500' }}>{s.full_name}</td>
                            <td><span style={{ color: '#a78bfa', fontSize: '13px' }}>{s.program || '—'}</span></td>
                            <td><span style={{ color: '#10b981', fontWeight: '600' }}>{stats.present}</span></td>
                            <td><span style={{ color: '#ef4444', fontWeight: '600' }}>{stats.absent}</span></td>
                            <td><span style={{ color: '#f59e0b', fontWeight: '600' }}>{stats.late}</span></td>
                            <td>{stats.total}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="progress-bar" style={{ flex: 1, minWidth: '60px' }}>
                                  <div className="progress-fill" style={{ width: `${stats.pct}%`, background: stats.pct >= 75 ? '#10b981' : '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: stats.pct >= 75 ? '#10b981' : '#ef4444' }}>{stats.pct}%</span>
                              </div>
                            </td>
                            <td>
                              {stats.total === 0 ? (
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>No Data</span>
                              ) : (
                                <span className="badge" style={{
                                  background: stats.pct >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                  color: stats.pct >= 75 ? '#34d399' : '#f87171'
                                }}>{stats.pct >= 75 ? '✅ Good' : '⚠️ Low'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* MONTHLY OVERVIEW */}
            {activeReport === 'monthly-attendance' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700' }}>📆 Monthly Attendance Overview</h2>
                  <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                </div>

                {/* Month summary cards */}
                {(() => {
                  const monthRecs = attendance.filter(a => a.date?.startsWith(filterMonth))
                  const present = monthRecs.filter(a => a.status === 'present').length
                  const absent = monthRecs.filter(a => a.status === 'absent').length
                  const late = monthRecs.filter(a => a.status === 'late').length
                  const pct = monthRecs.length > 0 ? Math.round((present / monthRecs.length) * 100) : 0
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        {[
                          { label: 'Present', value: present, color: '#10b981' },
                          { label: 'Absent', value: absent, color: '#ef4444' },
                          { label: 'Late', value: late, color: '#f59e0b' },
                          { label: 'Avg Attendance', value: `${pct}%`, color: '#38bdf8' },
                        ].map(item => (
                          <div key={item.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: item.color }}>{item.value}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}

                {/* Program-wise monthly breakdown */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>Program-wise Breakdown</h3>
                <div className="table-wrap" style={{ marginBottom: '24px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Students</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Avg Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map(prog => {
                        const progStudents = students.filter(s => s.program === prog)
                        const progRecs = attendance.filter(a => a.date?.startsWith(filterMonth) && a.students?.program === prog)
                        const present = progRecs.filter(a => a.status === 'present').length
                        const absent = progRecs.filter(a => a.status === 'absent').length
                        const late = progRecs.filter(a => a.status === 'late').length
                        const pct = progRecs.length > 0 ? Math.round((present / progRecs.length) * 100) : 0
                        return (
                          <tr key={prog}>
                            <td style={{ fontWeight: '600', color: '#a78bfa' }}>{prog}</td>
                            <td>{progStudents.length}</td>
                            <td><span style={{ color: '#10b981', fontWeight: '600' }}>{present}</span></td>
                            <td><span style={{ color: '#ef4444', fontWeight: '600' }}>{absent}</span></td>
                            <td><span style={{ color: '#f59e0b', fontWeight: '600' }}>{late}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="progress-bar" style={{ flex: 1, minWidth: '80px' }}>
                                  <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 75 ? '#10b981' : '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: pct >= 75 ? '#10b981' : '#ef4444' }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Students below 75% */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px', color: '#ef4444' }}>⚠️ Students Below 75% This Month</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Program</th>
                        <th>Present</th>
                        <th>Total</th>
                        <th>Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.filter(s => {
                        const stats = getStudentAttendance(s.id, filterMonth)
                        return stats.total > 0 && stats.pct < 75
                      }).map(s => {
                        const stats = getStudentAttendance(s.id, filterMonth)
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '500' }}>{s.full_name}</td>
                            <td style={{ color: '#a78bfa' }}>{s.program || '—'}</td>
                            <td style={{ color: '#10b981' }}>{stats.present}</td>
                            <td>{stats.total}</td>
                            <td><span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>{stats.pct}%</span></td>
                          </tr>
                        )
                      })}
                      {students.filter(s => { const stats = getStudentAttendance(s.id, filterMonth); return stats.total > 0 && stats.pct < 75 }).length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#10b981' }}>🎉 All students have good attendance this month!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}