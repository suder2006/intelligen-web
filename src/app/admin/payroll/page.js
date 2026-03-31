'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'




export default function PayrollPage() {
  const [view, setView] = useState('payroll') // payroll | salary | rules
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [staff, setStaff] = useState([])
  const [salaries, setSalaries] = useState([])
  const [payrollRecords, setPayrollRecords] = useState([])
  const [groups, setGroups] = useState([])
  const [rules, setRules] = useState([])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [showSalaryForm, setShowSalaryForm] = useState(null) // staff object
  const [showRulesForm, setShowRulesForm] = useState(null) // group object
  const [selectedPayroll, setSelectedPayroll] = useState(null)

  const [salaryForm, setSalaryForm] = useState({
    salary_type: 'fixed', basic_salary: '', hourly_rate: '',
    pf_applicable: false, esi_applicable: false,
    tax_amount: 0, tax_percent: 0, effective_from: '', academic_year: `${new Date().getFullYear()}-${new Date().getFullYear()+1}`
  })

  const [rulesForm, setRulesForm] = useState({
    working_days_per_month: 26, late_deduction_percent: 50,
    half_day_deduction_percent: 50, overtime_rate_multiplier: 1.5,
    leave_encashment_applicable: false
  })
  const { schoolId } = useSchool()

  useEffect(() => { if (schoolId) fetchAll() }, [filterMonth, schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [staffRes, salRes, payRes, grpRes, rulesRes] = await Promise.all([
      supabase.from('profiles').select('*, staff_type_groups(name, id)').in('role', ['teacher', 'staff']).eq('school_id', schoolId).order('full_name'),
      supabase.from('staff_salary').select('*'),
      supabase.from('payroll').select('*, profiles(full_name, role)').eq('month', filterMonth).eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('staff_type_groups').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('payroll_rules').select('*')
    ])
    setStaff(staffRes.data || [])
    setSalaries(salRes.data || [])
    setPayrollRecords(payRes.data || [])
    setGroups(grpRes.data || [])
    setRules(rulesRes.data || [])
    setLoading(false)
  }

  const saveSalary = async () => {
    if (!showSalaryForm) return
    setSaving(true)
    const existing = salaries.find(s => s.staff_id === showSalaryForm.id && s.academic_year === salaryForm.academic_year)
    const data = { ...salaryForm, staff_id: showSalaryForm.id, school_id: schoolId, basic_salary: parseFloat(salaryForm.basic_salary) || 0, hourly_rate: parseFloat(salaryForm.hourly_rate) || 0 }
    if (existing) {
      await supabase.from('staff_salary').update(data).eq('id', existing.id)
    } else {
      await supabase.from('staff_salary').insert(data)
    }
    setShowSalaryForm(null)
    await fetchAll()
    setSaving(false)
  }

  const saveRules = async () => {
    if (!showRulesForm) return
    setSaving(true)
    const existing = rules.find(r => r.staff_group_id === showRulesForm.id)
    const data = { ...rulesForm, staff_group_id: showRulesForm.id, school_id: schoolId }
    if (existing) {
      await supabase.from('payroll_rules').update(data).eq('id', existing.id)
    } else {
      await supabase.from('payroll_rules').insert(data)
    }
    setShowRulesForm(null)
    await fetchAll()
    setSaving(false)
  }

  const generatePayroll = async (staffMember) => {
    const salary = salaries.find(s => s.staff_id === staffMember.id)
    if (!salary) { alert(`No salary configured for ${staffMember.full_name}. Please set up salary first.`); return }

    setGenerating(true)
    const monthStart = `${filterMonth}-01`
    const monthEnd = `${filterMonth}-31`

    // Get attendance
    const { data: attData } = await supabase.from('staff_attendance')
      .select('*').eq('staff_id', staffMember.id).gte('date', monthStart).lte('date', monthEnd)

    // Get approved leaves
    const { data: leaveData } = await supabase.from('leave_requests')
      .select('*').eq('staff_id', staffMember.id).eq('status', 'approved')
      .gte('from_date', monthStart).lte('to_date', monthEnd)

    // Get payroll rules for staff group
    const rule = rules.find(r => r.staff_group_id === staffMember.staff_type_groups?.id) || {
      working_days_per_month: 26, late_deduction_percent: 50,
      half_day_deduction_percent: 50, overtime_rate_multiplier: 1.5,
      leave_encashment_applicable: false
    }

    const workingDays = rule.working_days_per_month
    const presentDays = (attData || []).filter(a => a.status === 'present').length
    const lateDays = (attData || []).filter(a => a.status === 'late').length
    const halfDays = (attData || []).filter(a => a.status === 'half_day').length
    const leaveDays = (leaveData || []).reduce((s, l) => s + l.no_of_days, 0)
    const absentDays = Math.max(0, workingDays - presentDays - lateDays - halfDays - leaveDays)

    // Calculate overtime hours
    const overtimeHours = (attData || []).reduce((s, a) => {
      if (!a.working_hours || !rule) return s
      const expectedHours = parseFloat(staffMember.staff_type_groups?.working_hours || 8)
      const extra = Math.max(0, Number(a.working_hours) - expectedHours)
      return s + extra
    }, 0)

    // Calculate earnings
    const basicSalary = salary.basic_salary || 0
    const dailyRate = basicSalary / workingDays
    const hourlyRate = salary.hourly_rate || (dailyRate / 8)

    const overtimePay = overtimeHours * hourlyRate * (rule.overtime_rate_multiplier || 1.5)

    // Deductions
    const absentDeduction = absentDays * dailyRate
    const lateDeduction = lateDays * dailyRate * ((rule.late_deduction_percent || 50) / 100)
    const halfDayDeduction = halfDays * dailyRate * ((rule.half_day_deduction_percent || 50) / 100)
    const grossEarnings = basicSalary + overtimePay
    const pfDeduction = salary.pf_applicable ? grossEarnings * 0.12 : 0
    const esiDeduction = salary.esi_applicable ? grossEarnings * 0.0075 : 0
    const taxDeduction = salary.tax_percent > 0 ? grossEarnings * (salary.tax_percent / 100) : (salary.tax_amount || 0)
    const totalDeductions = absentDeduction + lateDeduction + halfDayDeduction + pfDeduction + esiDeduction + taxDeduction
    const netPay = Math.max(0, grossEarnings - totalDeductions)

    const payrollData = {
      staff_id: staffMember.id, month: filterMonth,
      working_days: workingDays, present_days: presentDays,
      absent_days: absentDays, late_days: lateDays,
      half_days: halfDays, leave_days: leaveDays,
      overtime_hours: parseFloat(overtimeHours.toFixed(2)),
      basic_salary: basicSalary, daily_rate: parseFloat(dailyRate.toFixed(2)),
      gross_earnings: parseFloat(grossEarnings.toFixed(2)),
      absent_deduction: parseFloat(absentDeduction.toFixed(2)),
      late_deduction: parseFloat(lateDeduction.toFixed(2)),
      half_day_deduction: parseFloat(halfDayDeduction.toFixed(2)),
      pf_deduction: parseFloat(pfDeduction.toFixed(2)),
      esi_deduction: parseFloat(esiDeduction.toFixed(2)),
      tax_deduction: parseFloat(taxDeduction.toFixed(2)),
      total_deductions: parseFloat(totalDeductions.toFixed(2)),
      overtime_pay: parseFloat(overtimePay.toFixed(2)),
      net_pay: parseFloat(netPay.toFixed(2)),
      status: 'draft', school_id: schoolId
    }

    const existing = payrollRecords.find(p => p.staff_id === staffMember.id)
    if (existing) {
      await supabase.from('payroll').update(payrollData).eq('id', existing.id)
    } else {
      await supabase.from('payroll').insert(payrollData)
    }
    await fetchAll()
    setGenerating(false)
  }

  const generateAllPayroll = async () => {
    if (!confirm(`Generate payroll for all staff for ${filterMonth}?`)) return
    setGenerating(true)
    for (const s of staff) {
      const salary = salaries.find(sal => sal.staff_id === s.id)
      if (salary) await generatePayroll(s)
    }
    setGenerating(false)
    alert('Payroll generated for all staff!')
  }

  const finalizePayroll = async (id) => {
    if (!confirm('Finalize this payroll? This cannot be undone.')) return
    await supabase.from('payroll').update({ status: 'finalized', finalized_at: new Date().toISOString() }).eq('id', id)
    await fetchAll()
  }

  const exportPayroll = () => {
    const headers = ['Staff Name', 'Role', 'Working Days', 'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Overtime Hrs', 'Basic Salary', 'Gross Earnings', 'Absent Deduction', 'Late Deduction', 'Half Day Deduction', 'PF', 'ESI', 'Tax', 'Total Deductions', 'Overtime Pay', 'Net Pay', 'Status']
    const rows = payrollRecords.map(p => [
      p.profiles?.full_name, p.profiles?.role,
      p.working_days, p.present_days, p.absent_days, p.late_days, p.half_days, p.leave_days,
      p.overtime_hours, p.basic_salary, p.gross_earnings,
      p.absent_deduction, p.late_deduction, p.half_day_deduction,
      p.pf_deduction, p.esi_deduction, p.tax_deduction,
      p.total_deductions, p.overtime_pay, p.net_pay, p.status
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payroll-${filterMonth}.csv`; a.click()
  }

  const totalNetPay = payrollRecords.reduce((s, p) => s + Number(p.net_pay), 0)
  const totalGross = payrollRecords.reduce((s, p) => s + Number(p.gross_earnings), 0)
  const totalDeductions = payrollRecords.reduce((s, p) => s + Number(p.total_deductions), 0)

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 11px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); white-space: nowrap; }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); white-space: nowrap; }
        tr:last-child td { border-bottom: none; }
        .badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        @media print {
          .sidebar, .print-hide { display: none !important; }
          .main { margin-left: 0 !important; padding: 20px !important; }
        }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>💰 Payroll Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Calculate and manage staff salaries</p>
          </div>
          <div className="print-hide" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => window.print()} className="btn-secondary">🖨️ Print</button>
            <button onClick={exportPayroll} className="btn-secondary">📥 Export Excel</button>
            <button onClick={generateAllPayroll} disabled={generating} className="btn-primary">{generating ? '⏳ Generating...' : '⚡ Generate All'}</button>
          </div>
        </div>

        {/* Month selector */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }} className="print-hide">
          <input type='month' value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{payrollRecords.length} payroll records generated</span>
        </div>

        {/* View Tabs */}
        <div className="print-hide" style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['payroll', '💰 Payroll'], ['salary', '⚙️ Salary Setup'], ['rules', '📋 Payroll Rules']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* PAYROLL VIEW */}
            {view === 'payroll' && (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total Gross', value: `₹${totalGross.toLocaleString()}`, color: '#38bdf8' },
                    { label: 'Total Deductions', value: `₹${totalDeductions.toLocaleString()}`, color: '#ef4444' },
                    { label: 'Total Net Pay', value: `₹${totalNetPay.toLocaleString()}`, color: '#10b981' },
                    { label: 'Staff Count', value: payrollRecords.length, color: '#a78bfa' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '18px' }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Staff without payroll */}
                {staff.filter(s => !payrollRecords.find(p => p.staff_id === s.id)).length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#fbbf24' }}>
                    ⚠️ {staff.filter(s => !payrollRecords.find(p => p.staff_id === s.id)).length} staff have no payroll generated yet. Click ⚡ Generate All or generate individually.
                  </div>
                )}

                {/* Payroll Table */}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Days</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Leave</th>
                        <th>OT Hrs</th>
                        <th>Gross</th>
                        <th>Deductions</th>
                        <th>Net Pay</th>
                        <th>Status</th>
                        <th className="print-hide">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map(s => {
                        const p = payrollRecords.find(pr => pr.staff_id === s.id)
                        const hasSalary = salaries.find(sal => sal.staff_id === s.id)
                        return (
                          <tr key={s.id}>
                            <td>
                              <div style={{ fontWeight: '600' }}>{s.full_name}</div>
                              <div style={{ color: '#a78bfa', fontSize: '11px' }}>{s.staff_type_groups?.name || s.role}</div>
                            </td>
                            <td>{p?.working_days || '—'}</td>
                            <td style={{ color: '#10b981' }}>{p?.present_days ?? '—'}</td>
                            <td style={{ color: '#ef4444' }}>{p?.absent_days ?? '—'}</td>
                            <td style={{ color: '#f59e0b' }}>{p?.late_days ?? '—'}</td>
                            <td style={{ color: '#a78bfa' }}>{p?.leave_days ?? '—'}</td>
                            <td style={{ color: '#38bdf8' }}>{p?.overtime_hours ?? '—'}</td>
                            <td style={{ color: '#38bdf8', fontWeight: '600' }}>{p ? `₹${Number(p.gross_earnings).toLocaleString()}` : '—'}</td>
                            <td style={{ color: '#ef4444' }}>{p ? `₹${Number(p.total_deductions).toLocaleString()}` : '—'}</td>
                            <td style={{ color: '#10b981', fontWeight: '700' }}>{p ? `₹${Number(p.net_pay).toLocaleString()}` : '—'}</td>
                            <td>
                              {p ? (
                                <span className="badge" style={{ background: p.status === 'finalized' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: p.status === 'finalized' ? '#34d399' : '#fbbf24' }}>{p.status}</span>
                              ) : (
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>Not generated</span>
                              )}
                            </td>
                            <td className="print-hide">
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {!hasSalary ? (
                                  <button onClick={() => { setShowSalaryForm(s); setSalaryForm({ salary_type: 'fixed', basic_salary: '', hourly_rate: '', pf_applicable: false, esi_applicable: false, tax_amount: 0, tax_percent: 0, effective_from: '', academic_year: `${new Date().getFullYear()}-${new Date().getFullYear()+1}` }) }}
                                    style={{ padding: '4px 8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#fbbf24', cursor: 'pointer', fontSize: '11px' }}>⚙️ Set Salary</button>
                                ) : (
                                  <>
                                    <button onClick={() => generatePayroll(s)} disabled={generating}
                                      style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '11px' }}>🔄 Generate</button>
                                    {p && p.status !== 'finalized' && (
                                      <button onClick={() => setSelectedPayroll(p)}
                                        style={{ padding: '4px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '11px' }}>👁️ View</button>
                                    )}
                                    {p && p.status !== 'finalized' && (
                                      <button onClick={() => finalizePayroll(p.id)}
                                        style={{ padding: '4px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', cursor: 'pointer', fontSize: '11px' }}>✅ Finalize</button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {/* Total row */}
                      <tr style={{ background: 'rgba(255,255,255,0.03)', fontWeight: '700' }}>
                        <td colSpan={7} style={{ color: '#38bdf8' }}>Total ({payrollRecords.length} staff)</td>
                        <td style={{ color: '#38bdf8' }}>₹{totalGross.toLocaleString()}</td>
                        <td style={{ color: '#ef4444' }}>₹{totalDeductions.toLocaleString()}</td>
                        <td style={{ color: '#10b981' }}>₹{totalNetPay.toLocaleString()}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* SALARY SETUP */}
            {view === 'salary' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>Configure basic salary or hourly rate for each staff member.</div>
                {staff.map(s => {
                  const sal = salaries.find(sal => sal.staff_id === s.id)
                  return (
                    <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '700' }}>{s.full_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px' }}>{s.staff_type_groups?.name || s.role}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {sal ? (
                          <>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>₹{Number(sal.basic_salary).toLocaleString()}</div>
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>Basic/Month</div>
                            </div>
                            {sal.hourly_rate > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '18px' }}>₹{sal.hourly_rate}/hr</div>
                                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>Hourly</div>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                              {sal.pf_applicable && <span style={{ padding: '2px 6px', borderRadius: '20px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>PF</span>}
                              {sal.esi_applicable && <span style={{ padding: '2px 6px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>ESI</span>}
                              {(sal.tax_amount > 0 || sal.tax_percent > 0) && <span style={{ padding: '2px 6px', borderRadius: '20px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Tax</span>}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '13px' }}>⚠️ Not configured</span>
                        )}
                        <button onClick={() => {
                          setShowSalaryForm(s)
                          setSalaryForm(sal ? { salary_type: sal.salary_type, basic_salary: sal.basic_salary, hourly_rate: sal.hourly_rate, pf_applicable: sal.pf_applicable, esi_applicable: sal.esi_applicable, tax_amount: sal.tax_amount, tax_percent: sal.tax_percent, effective_from: sal.effective_from || '', academic_year: sal.academic_year } : { salary_type: 'fixed', basic_salary: '', hourly_rate: '', pf_applicable: false, esi_applicable: false, tax_amount: 0, tax_percent: 0, effective_from: '', academic_year: `${new Date().getFullYear()}-${new Date().getFullYear()+1}` })
                        }}
                          style={{ padding: '7px 14px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>
                          {sal ? '✏️ Edit' : '+ Set Salary'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* PAYROLL RULES */}
            {view === 'rules' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>Configure deduction rules per staff group.</div>
                {groups.map(grp => {
                  const rule = rules.find(r => r.staff_group_id === grp.id)
                  return (
                    <div key={grp.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '10px' }}>{grp.name}</div>
                          {rule ? (
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Working Days', value: rule.working_days_per_month },
                                { label: 'Late Deduction', value: `${rule.late_deduction_percent}%` },
                                { label: 'Half Day Deduction', value: `${rule.half_day_deduction_percent}%` },
                                { label: 'OT Multiplier', value: `${rule.overtime_rate_multiplier}x` },
                                { label: 'Leave Encashment', value: rule.leave_encashment_applicable ? 'Yes' : 'No' },
                              ].map(item => (
                                <div key={item.label} style={{ textAlign: 'center' }}>
                                  <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '16px' }}>{item.value}</div>
                                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{item.label}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: '13px' }}>⚠️ No rules configured — using defaults</span>
                          )}
                        </div>
                        <button onClick={() => { setShowRulesForm(grp); setRulesForm(rule ? { working_days_per_month: rule.working_days_per_month, late_deduction_percent: rule.late_deduction_percent, half_day_deduction_percent: rule.half_day_deduction_percent, overtime_rate_multiplier: rule.overtime_rate_multiplier, leave_encashment_applicable: rule.leave_encashment_applicable } : { working_days_per_month: 26, late_deduction_percent: 50, half_day_deduction_percent: 50, overtime_rate_multiplier: 1.5, leave_encashment_applicable: false }) }}
                          style={{ padding: '7px 14px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>
                          {rule ? '✏️ Edit Rules' : '+ Set Rules'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Salary Form Modal */}
      {showSalaryForm && (
        <div className="modal-overlay" onClick={() => setShowSalaryForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>⚙️ Salary Configuration</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showSalaryForm.full_name}</p>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Salary Type</label>
            <select value={salaryForm.salary_type} onChange={e => setSalaryForm({ ...salaryForm, salary_type: e.target.value })} style={inputStyle}>
              <option value='fixed'>Fixed Monthly</option>
              <option value='hourly'>Hourly</option>
              <option value='both'>Both Fixed + Hourly</option>
            </select>
            {['fixed', 'both'].includes(salaryForm.salary_type) && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Basic Monthly Salary (₹)</label>
                <input type='number' value={salaryForm.basic_salary} onChange={e => setSalaryForm({ ...salaryForm, basic_salary: e.target.value })} placeholder='e.g. 25000' style={inputStyle} />
              </>
            )}
            {['hourly', 'both'].includes(salaryForm.salary_type) && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Hourly Rate (₹)</label>
                <input type='number' value={salaryForm.hourly_rate} onChange={e => setSalaryForm({ ...salaryForm, hourly_rate: e.target.value })} placeholder='e.g. 150' style={inputStyle} />
              </>
            )}
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Academic Year</label>
            <input value={salaryForm.academic_year} onChange={e => setSalaryForm({ ...salaryForm, academic_year: e.target.value })} style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Effective From</label>
            <input type='date' value={salaryForm.effective_from} onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} style={inputStyle} />
            {/* PF / ESI / Tax */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={salaryForm.pf_applicable} onChange={e => setSalaryForm({ ...salaryForm, pf_applicable: e.target.checked })} />
                PF Applicable (12%)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                <input type='checkbox' checked={salaryForm.esi_applicable} onChange={e => setSalaryForm({ ...salaryForm, esi_applicable: e.target.checked })} />
                ESI Applicable (0.75%)
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Tax Amount (₹ fixed)</label>
                <input type='number' value={salaryForm.tax_amount} onChange={e => setSalaryForm({ ...salaryForm, tax_amount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Tax Percent (%)</label>
                <input type='number' value={salaryForm.tax_percent} onChange={e => setSalaryForm({ ...salaryForm, tax_percent: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowSalaryForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveSalary} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Salary'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Form Modal */}
      {showRulesForm && (
        <div className="modal-overlay" onClick={() => setShowRulesForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>📋 Payroll Rules</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{showRulesForm.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                ['working_days_per_month', 'Working Days/Month', 'number'],
                ['late_deduction_percent', 'Late Deduction (%)', 'number'],
                ['half_day_deduction_percent', 'Half Day Deduction (%)', 'number'],
                ['overtime_rate_multiplier', 'Overtime Multiplier (x)', 'number'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input type={type} value={rulesForm[field]} onChange={e => setRulesForm({ ...rulesForm, [field]: parseFloat(e.target.value) })} style={inputStyle} />
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', marginBottom: '20px' }}>
              <input type='checkbox' checked={rulesForm.leave_encashment_applicable} onChange={e => setRulesForm({ ...rulesForm, leave_encashment_applicable: e.target.checked })} />
              Leave Encashment Applicable
            </label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRulesForm(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveRules} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Rules'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Detail Modal */}
      {selectedPayroll && (
        <div className="modal-overlay" onClick={() => setSelectedPayroll(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>💰 Payroll Details</h3>
            <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{selectedPayroll.profiles?.full_name} · {selectedPayroll.month}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '16px' }}>
              {[
                ['Working Days', selectedPayroll.working_days, null],
                ['Present', selectedPayroll.present_days, '#10b981'],
                ['Absent', selectedPayroll.absent_days, '#ef4444'],
                ['Late', selectedPayroll.late_days, '#f59e0b'],
                ['Half Day', selectedPayroll.half_days, '#38bdf8'],
                ['Leave', selectedPayroll.leave_days, '#a78bfa'],
                ['Overtime Hours', selectedPayroll.overtime_hours, '#38bdf8'],
                ['Daily Rate', `₹${Number(selectedPayroll.daily_rate).toLocaleString()}`, null],
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{label}</span>
                  <span style={{ fontWeight: '600', color: color || '#fff', fontSize: '13px' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: '600', marginBottom: '10px', color: '#34d399' }}>💚 Earnings</div>
              {[
                ['Basic Salary', selectedPayroll.basic_salary],
                ['Overtime Pay', selectedPayroll.overtime_pay],
                ['Leave Encashment', selectedPayroll.leave_encashment],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                  <span style={{ color: '#34d399' }}>₹{Number(value || 0).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: '700' }}>
                <span>Gross Earnings</span>
                <span style={{ color: '#34d399' }}>₹{Number(selectedPayroll.gross_earnings).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ fontWeight: '600', marginBottom: '10px', color: '#f87171' }}>❤️ Deductions</div>
              {[
                ['Absent Deduction', selectedPayroll.absent_deduction],
                ['Late Deduction', selectedPayroll.late_deduction],
                ['Half Day Deduction', selectedPayroll.half_day_deduction],
                ['PF', selectedPayroll.pf_deduction],
                ['ESI', selectedPayroll.esi_deduction],
                ['Tax', selectedPayroll.tax_deduction],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                  <span style={{ color: '#f87171' }}>₹{Number(value || 0).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: '700' }}>
                <span>Total Deductions</span>
                <span style={{ color: '#f87171' }}>₹{Number(selectedPayroll.total_deductions).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '16px' }}>💰 Net Pay</span>
              <span style={{ fontWeight: '700', fontSize: '22px', color: '#38bdf8' }}>₹{Number(selectedPayroll.net_pay).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setSelectedPayroll(null)} className="btn-secondary">Close</button>
              {selectedPayroll.status !== 'finalized' && (
                <button onClick={() => { finalizePayroll(selectedPayroll.id); setSelectedPayroll(null) }} className="btn-primary">✅ Finalize</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}