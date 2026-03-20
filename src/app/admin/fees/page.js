'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'

const FEE_TYPES = ['Registration Fee', 'Admission Fee', 'Annual Fee', 'Tuition Fee', 'Books & Materials', 'Uniform', 'Event Fee', 'Daycare Fee', 'Transport Fee']
const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Online']

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
  { href: '/admin/curriculum', label: 'Curriculum', icon: '📖' },
  { href: '/admin/moments', label: 'Moments', icon: '📸' },
  { href: '/admin/reports', label: 'Reports', icon: '📈' },
  { href: '/admin/skills', label: 'Skills & Progress', icon: '🎯' },
  { href: '/admin/settings', label: 'School Settings', icon: '⚙️' },
]

export default function FeesPage() {
  const [view, setView] = useState('overview') // overview | student | invoices | structures
  const [students, setStudents] = useState([])
  const [invoices, setInvoices] = useState([])
  const [installments, setInstallments] = useState([])
  const [structures, setStructures] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [showInstallmentForm, setShowInstallmentForm] = useState(false)
  const [showStructureForm, setShowStructureForm] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(null)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchStudent, setSearchStudent] = useState('')
  const [activeInvoice, setActiveInvoice] = useState(null)

  const { schoolId } = useSchool()

  const [invoiceForm, setInvoiceForm] = useState({
    student_id: '', fee_type: 'Tuition Fee', description: '', total_amount: '',
    due_date: '', academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1), notes: ''
  })

  const [installmentForm, setInstallmentForm] = useState({
    installment_number: 1, amount: '', due_date: '', notes: ''
  })

  const [structureForm, setStructureForm] = useState({
    program: '', fee_type: 'Tuition Fee', amount: '', academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
  })

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [s, inv, inst, str] = await Promise.all([
      supabase.from('students').select('id, full_name, program, student_id').eq('status', 'active').eq('school_id', schoolId).order('full_name'),
      supabase.from('fee_invoices').select('*, students(full_name, program)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('fee_installments').select('*').order('due_date'),
      supabase.from('fee_structures').select('*').order('program')
    ])
    setStudents(s.data || [])
    setInvoices(inv.data || [])
    setInstallments(inst.data || [])
    setStructures(str.data || [])
    setLoading(false)
  }

  const createInvoice = async () => {
    if (!invoiceForm.student_id || !invoiceForm.fee_type || !invoiceForm.total_amount) {
      alert('Please fill student, fee type and amount'); return
    }
    setSaving(true)
    const { error } = await supabase.from('fee_invoices').insert({
      ...invoiceForm,
      total_amount: parseFloat(invoiceForm.total_amount),
      paid_amount: 0,
      status: 'unpaid',
      school_id: schoolId
    })
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    setShowInvoiceForm(false)
    setInvoiceForm({ student_id: '', fee_type: 'Tuition Fee', description: '', total_amount: '', due_date: '', academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1), notes: '' })
    await fetchAll()
    setSaving(false)
  }

  const createInstallment = async () => {
    if (!activeInvoice || !installmentForm.amount || !installmentForm.due_date) {
      alert('Please fill amount and due date'); return
    }
    setSaving(true)
    await supabase.from('fee_installments').insert({
      student_id: activeInvoice.student_id,
      invoice_id: activeInvoice.id,
      installment_number: installmentForm.installment_number,
      amount: parseFloat(installmentForm.amount),
      due_date: installmentForm.due_date,
      notes: installmentForm.notes,
      status: 'unpaid'
    })
    setShowInstallmentForm(false)
    setInstallmentForm({ installment_number: 1, amount: '', due_date: '', notes: '' })
    await fetchAll()
    setSaving(false)
  }

  const markInvoicePaid = async (invoice, mode) => {
    await supabase.from('fee_invoices').update({
      status: 'paid',
      paid_amount: invoice.total_amount,
      payment_mode: mode,
      payment_date: new Date().toISOString().split('T')[0]
    }).eq('id', invoice.id)
    setShowPaymentModal(null)
    await fetchAll()
  }

  const markInstallmentPaid = async (inst, mode) => {
    await supabase.from('fee_installments').update({
      status: 'paid',
      paid_amount: inst.amount,
      payment_mode: mode,
      payment_date: new Date().toISOString().split('T')[0]
    }).eq('id', inst.id)
    const invoiceInsts = installments.filter(i => i.invoice_id === inst.invoice_id)
    const paidTotal = invoiceInsts.filter(i => i.status === 'paid' || i.id === inst.id).reduce((s, i) => s + Number(i.amount), 0)
    const invoice = invoices.find(i => i.id === inst.invoice_id)
    if (invoice) {
      const newStatus = paidTotal >= invoice.total_amount ? 'paid' : 'partial'
      await supabase.from('fee_invoices').update({ paid_amount: paidTotal, status: newStatus }).eq('id', inst.invoice_id)
    }
    setShowPaymentModal(null)
    await fetchAll()
  }

  const deleteInvoice = async (id) => {
    if (!confirm('Delete this invoice and all its installments?')) return
    await supabase.from('fee_installments').delete().eq('invoice_id', id)
    await supabase.from('fee_invoices').delete().eq('id', id)
    await fetchAll()
  }

  const saveStructure = async () => {
    if (!structureForm.program || !structureForm.fee_type || !structureForm.amount) {
      alert('Please fill all fields'); return
    }
    setSaving(true)
    await supabase.from('fee_structures').insert({
      ...structureForm, amount: parseFloat(structureForm.amount)
    })
    setShowStructureForm(false)
    setStructureForm({ program: '', fee_type: 'Tuition Fee', amount: '', academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) })
    await fetchAll()
    setSaving(false)
  }

  const sendReminder = async (invoice) => {
    const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', invoice.student_id)
    if (!ps || ps.length === 0) { alert('No parent linked to this student'); return }
    for (const { parent_id } of ps) {
      await supabase.from('chat_messages').insert({
        sender_id: schoolId,
        receiver_id: parent_id,
        sender_name: 'School Admin',
        content: `📢 Fee Reminder: ${invoice.fee_type} of ₹${invoice.total_amount} is due on ${invoice.due_date || 'soon'}. Please make the payment at the earliest. Thank you! 🙏`
      })
    }
    alert('Reminder sent to parent(s)! ✅')
  }

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount), 0)
  const totalPending = totalInvoiced - totalCollected
  const overdueCount = invoices.filter(i => i.status === 'unpaid' && i.due_date && new Date(i.due_date) < new Date()).length

  const filteredInvoices = invoices.filter(inv => {
    const matchStatus = filterStatus === 'all' ? true : inv.status === filterStatus
    const matchSearch = searchStudent ? inv.students?.full_name?.toLowerCase().includes(searchStudent.toLowerCase()) : true
    return matchStatus && matchSearch
  })

  const studentInvoices = selectedStudent ? invoices.filter(i => i.student_id === selectedStudent.id) : []
  const studentInstallments = selectedStudent ? installments.filter(i => i.student_id === selectedStudent.id) : []

  const statusColor = { unpaid: '#f59e0b', paid: '#10b981', overdue: '#ef4444', partial: '#38bdf8' }
  const statusBg = { unpaid: 'rgba(245,158,11,0.15)', paid: 'rgba(16,185,129,0.15)', overdue: 'rgba(239,68,68,0.15)', partial: 'rgba(56,189,248,0.15)' }
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '14px', fontFamily: "'DM Sans', sans-serif" }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sidebar { width: 240px; min-height: 100vh; background: rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.06); padding: 24px 16px; position: fixed; top: 0; left: 0; }
        .logo { font-family: 'Playfair Display', serif; font-size: 24px; color: #fff; padding: 8px 12px; margin-bottom: 32px; }
        .logo span { color: #38bdf8; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover, .nav-item.active { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
        .view-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .filter-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/fees' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>💳 Fee Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage student fees, installments & payments</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={() => setShowStructureForm(true)}>📋 Fee Structure</button>
            <button className="btn-primary" onClick={() => setShowInvoiceForm(true)}>+ Create Invoice</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['overview', '📊 Overview'], ['invoices', '📋 All Invoices'], ['student', '👶 By Student']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {view === 'overview' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                  {[
                    { label: 'Total Invoiced', value: `₹${totalInvoiced.toLocaleString()}`, color: '#38bdf8' },
                    { label: 'Collected', value: `₹${totalCollected.toLocaleString()}`, color: '#10b981' },
                    { label: 'Pending', value: `₹${totalPending.toLocaleString()}`, color: '#f59e0b' },
                    { label: 'Overdue', value: overdueCount, color: '#ef4444' },
                    { label: 'Total Invoices', value: invoices.length, color: '#a78bfa' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '18px' }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: item.color, marginBottom: '4px' }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px', color: 'rgba(255,255,255,0.8)' }}>📊 Program-wise Summary</h3>
                {[...new Set(students.map(s => s.program).filter(Boolean))].map(prog => {
                  const progStudents = students.filter(s => s.program === prog)
                  const progInvoices = invoices.filter(i => progStudents.some(s => s.id === i.student_id))
                  const progTotal = progInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
                  const progPaid = progInvoices.reduce((s, i) => s + Number(i.paid_amount), 0)
                  return (
                    <div key={prog} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{prog}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{progStudents.length} students · {progInvoices.length} invoices</div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        {[['₹'+progTotal.toLocaleString(),'Invoiced','#38bdf8'],['₹'+progPaid.toLocaleString(),'Collected','#10b981'],['₹'+(progTotal-progPaid).toLocaleString(),'Pending','#f59e0b']].map(([val,lbl,col]) => (
                          <div key={lbl} style={{ textAlign: 'right' }}>
                            <div style={{ color: col, fontWeight: '700' }}>{val}</div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {overdueCount > 0 && (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '24px 0 14px', color: '#ef4444' }}>⚠️ Overdue Invoices</h3>
                    {invoices.filter(i => i.status === 'unpaid' && i.due_date && new Date(i.due_date) < new Date()).map(inv => (
                      <div key={inv.id} className="card" style={{ borderColor: 'rgba(239,68,68,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{inv.students?.full_name}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{inv.fee_type} · Due: {inv.due_date}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: '#ef4444', fontWeight: '700' }}>₹{Number(inv.total_amount).toLocaleString()}</span>
                          <button onClick={() => sendReminder(inv)} style={{ padding: '6px 12px', backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>📤 Remind</button>
                          <button onClick={() => { setShowPaymentModal({...inv, type:'invoice'}); setPaymentMode('Cash') }} style={{ padding: '6px 12px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>✅ Pay</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {view === 'invoices' && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input placeholder='Search student...' value={searchStudent} onChange={e => setSearchStudent(e.target.value)}
                    style={{ flex: 1, minWidth: '200px', padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                  {['all', 'unpaid', 'partial', 'paid'].map(s => (
                    <button key={s} className={`filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'all' ? invoices.length : invoices.filter(i => i.status === s).length})
                    </button>
                  ))}
                </div>
                {filteredInvoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No invoices found.</div>
                ) : filteredInvoices.map(inv => {
                  const invInsts = installments.filter(i => i.invoice_id === inv.id)
                  return (
                    <div key={inv.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: invInsts.length > 0 ? '14px' : '0' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{inv.students?.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{inv.fee_type} · {inv.academic_year}</div>
                          {inv.description && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{inv.description}</div>}
                          {inv.due_date && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>Due: {inv.due_date}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: '700', color: '#38bdf8', fontSize: '16px' }}>₹{Number(inv.total_amount).toLocaleString()}</div>
                              {inv.paid_amount > 0 && <div style={{ color: '#10b981', fontSize: '12px' }}>Paid: ₹{Number(inv.paid_amount).toLocaleString()}</div>}
                            </div>
                            <span className="badge" style={{ background: statusBg[inv.status]||statusBg.unpaid, color: statusColor[inv.status]||statusColor.unpaid }}>{inv.status}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {inv.status !== 'paid' && <>
                              <button onClick={() => { setActiveInvoice(inv); setShowInstallmentForm(true); setInstallmentForm({ installment_number: invInsts.length+1, amount:'', due_date:'', notes:'' }) }}
                                style={{ padding:'5px 10px', backgroundColor:'rgba(167,139,250,0.15)', color:'#a78bfa', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>+ Installment</button>
                              <button onClick={() => sendReminder(inv)}
                                style={{ padding:'5px 10px', backgroundColor:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>📤 Remind</button>
                              <button onClick={() => { setShowPaymentModal({...inv,type:'invoice'}); setPaymentMode('Cash') }}
                                style={{ padding:'5px 10px', backgroundColor:'rgba(16,185,129,0.15)', color:'#34d399', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✅ Mark Paid</button>
                            </>}
                            <button onClick={() => deleteInvoice(inv.id)}
                              style={{ padding:'5px 10px', backgroundColor:'rgba(239,68,68,0.1)', color:'#f87171', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>🗑️</button>
                          </div>
                        </div>
                      </div>
                      {invInsts.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>Installments:</div>
                          {invInsts.map(inst => (
                            <div key={inst.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                              <div style={{ fontSize:'13px' }}>#{inst.installment_number} · Due: {inst.due_date} {inst.notes && `· ${inst.notes}`}</div>
                              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                                <span style={{ color:'#38bdf8', fontWeight:'600', fontSize:'13px' }}>₹{Number(inst.amount).toLocaleString()}</span>
                                <span className="badge" style={{ background:statusBg[inst.status]||statusBg.unpaid, color:statusColor[inst.status]||statusColor.unpaid, fontSize:'11px' }}>{inst.status}</span>
                                {inst.status !== 'paid' && <button onClick={() => { setShowPaymentModal({...inst,type:'installment'}); setPaymentMode('Cash') }}
                                  style={{ padding:'3px 8px', backgroundColor:'rgba(16,185,129,0.15)', color:'#34d399', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>Pay</button>}
                                {inst.payment_mode && <span style={{ color:'rgba(255,255,255,0.3)', fontSize:'11px' }}>{inst.payment_mode}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {view === 'student' && (
              <>
                {!selectedStudent ? (
                  <>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Select a Student</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                      {students.map(s => {
                        const sInv = invoices.filter(i => i.student_id === s.id)
                        const sPaid = sInv.reduce((sum,i) => sum+Number(i.paid_amount), 0)
                        const sTotal = sInv.reduce((sum,i) => sum+Number(i.total_amount), 0)
                        return (
                          <div key={s.id} className="card" style={{ cursor:'pointer' }} onClick={() => setSelectedStudent(s)}>
                            <div style={{ fontWeight:'700', marginBottom:'4px' }}>{s.full_name}</div>
                            <div style={{ color:'#a78bfa', fontSize:'13px', marginBottom:'10px' }}>{s.program}</div>
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <div><div style={{ color:'#10b981', fontWeight:'600' }}>₹{sPaid.toLocaleString()}</div><div style={{ color:'rgba(255,255,255,0.3)', fontSize:'11px' }}>Paid</div></div>
                              <div><div style={{ color:(sTotal-sPaid)>0?'#f59e0b':'#10b981', fontWeight:'600' }}>₹{(sTotal-sPaid).toLocaleString()}</div><div style={{ color:'rgba(255,255,255,0.3)', fontSize:'11px' }}>Pending</div></div>
                              <div><div style={{ color:'#38bdf8', fontWeight:'600' }}>{sInv.length}</div><div style={{ color:'rgba(255,255,255,0.3)', fontSize:'11px' }}>Invoices</div></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
                      <button onClick={() => setSelectedStudent(null)} style={{ padding:'7px 14px', background:'rgba(255,255,255,0.06)', border:'1px solid #334155', color:'#94a3b8', borderRadius:'8px', cursor:'pointer' }}>← Back</button>
                      <div>
                        <div style={{ fontWeight:'700', fontSize:'18px' }}>{selectedStudent.full_name}</div>
                        <div style={{ color:'#a78bfa', fontSize:'13px' }}>{selectedStudent.program}</div>
                      </div>
                      <button onClick={() => { setInvoiceForm(f => ({...f, student_id:selectedStudent.id})); setShowInvoiceForm(true) }}
                        className="btn-primary" style={{ marginLeft:'auto' }}>+ Add Invoice</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
                      {[
                        ['Total Invoiced','₹'+studentInvoices.reduce((s,i)=>s+Number(i.total_amount),0).toLocaleString(),'#38bdf8'],
                        ['Paid','₹'+studentInvoices.reduce((s,i)=>s+Number(i.paid_amount),0).toLocaleString(),'#10b981'],
                        ['Pending','₹'+(studentInvoices.reduce((s,i)=>s+Number(i.total_amount),0)-studentInvoices.reduce((s,i)=>s+Number(i.paid_amount),0)).toLocaleString(),'#f59e0b'],
                      ].map(([lbl,val,col]) => (
                        <div key={lbl} className="card" style={{ padding:'16px', textAlign:'center' }}>
                          <div style={{ fontSize:'20px', fontWeight:'700', color:col }}>{val}</div>
                          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    {studentInvoices.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'40px', color:'rgba(255,255,255,0.3)' }}>No invoices for this student yet.</div>
                    ) : studentInvoices.map(inv => {
                      const invInsts = studentInstallments.filter(i => i.invoice_id === inv.id)
                      return (
                        <div key={inv.id} className="card">
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px', marginBottom: invInsts.length>0?'12px':0 }}>
                            <div>
                              <div style={{ fontWeight:'700', marginBottom:'4px' }}>{inv.fee_type}</div>
                              {inv.description && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>{inv.description}</div>}
                              <div style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px', marginTop:'4px' }}>
                                {inv.academic_year}{inv.due_date && ` · Due: ${inv.due_date}`}{inv.payment_mode && ` · ${inv.payment_mode}`}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                              <div style={{ textAlign:'right' }}>
                                <div style={{ fontWeight:'700', color:'#38bdf8' }}>₹{Number(inv.total_amount).toLocaleString()}</div>
                                {inv.paid_amount > 0 && <div style={{ color:'#10b981', fontSize:'12px' }}>Paid: ₹{Number(inv.paid_amount).toLocaleString()}</div>}
                              </div>
                              <span className="badge" style={{ background:statusBg[inv.status]||statusBg.unpaid, color:statusColor[inv.status]||statusColor.unpaid }}>{inv.status}</span>
                              {inv.status !== 'paid' && <>
                                <button onClick={() => { setActiveInvoice(inv); setShowInstallmentForm(true); setInstallmentForm({installment_number:invInsts.length+1,amount:'',due_date:'',notes:''}) }}
                                  style={{ padding:'5px 10px', backgroundColor:'rgba(167,139,250,0.15)', color:'#a78bfa', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>+ Install</button>
                                <button onClick={() => { setShowPaymentModal({...inv,type:'invoice'}); setPaymentMode('Cash') }}
                                  style={{ padding:'5px 10px', backgroundColor:'rgba(16,185,129,0.15)', color:'#34d399', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>✅ Pay</button>
                              </>}
                            </div>
                          </div>
                          {invInsts.length > 0 && (
                            <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'10px' }}>
                              {invInsts.map(inst => (
                                <div key={inst.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0' }}>
                                  <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.6)' }}>Installment #{inst.installment_number} · {inst.due_date}</div>
                                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                                    <span style={{ color:'#38bdf8', fontSize:'13px', fontWeight:'600' }}>₹{Number(inst.amount).toLocaleString()}</span>
                                    <span className="badge" style={{ background:statusBg[inst.status]||statusBg.unpaid, color:statusColor[inst.status]||statusColor.unpaid, fontSize:'11px' }}>{inst.status}</span>
                                    {inst.status !== 'paid' && <button onClick={() => { setShowPaymentModal({...inst,type:'installment'}); setPaymentMode('Cash') }}
                                      style={{ padding:'3px 8px', backgroundColor:'rgba(16,185,129,0.15)', color:'#34d399', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }}>Pay</button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showInvoiceForm && (
        <div className="modal-overlay" onClick={() => setShowInvoiceForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'20px' }}>💳 Create Fee Invoice</h3>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Student *</label>
            <select value={invoiceForm.student_id} onChange={e => setInvoiceForm({...invoiceForm, student_id:e.target.value})} style={inputStyle}>
              <option value=''>-- Select Student --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.program})</option>)}
            </select>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Fee Type *</label>
            <select value={invoiceForm.fee_type} onChange={e => setInvoiceForm({...invoiceForm, fee_type:e.target.value})} style={inputStyle}>
              {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Description</label>
            <input value={invoiceForm.description} onChange={e => setInvoiceForm({...invoiceForm, description:e.target.value})} placeholder='e.g. Term 1 Tuition' style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Total Amount (₹) *</label>
            <input type='number' value={invoiceForm.total_amount} onChange={e => setInvoiceForm({...invoiceForm, total_amount:e.target.value})} placeholder='e.g. 15000' style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Due Date</label>
            <input type='date' value={invoiceForm.due_date} onChange={e => setInvoiceForm({...invoiceForm, due_date:e.target.value})} style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Academic Year</label>
            <input value={invoiceForm.academic_year} onChange={e => setInvoiceForm({...invoiceForm, academic_year:e.target.value})} placeholder='e.g. 2025-2026' style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Notes</label>
            <input value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes:e.target.value})} placeholder='Any additional notes' style={inputStyle} />
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'8px' }}>
              <button onClick={() => setShowInvoiceForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={createInvoice} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create Invoice'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Installment Modal */}
      {showInstallmentForm && activeInvoice && (
        <div className="modal-overlay" onClick={() => setShowInstallmentForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'8px' }}>📅 Add Installment</h3>
            <p style={{ color:'#a78bfa', fontSize:'14px', marginBottom:'20px' }}>{activeInvoice.fee_type} · Total: ₹{Number(activeInvoice.total_amount).toLocaleString()}</p>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Installment #</label>
            <input type='number' value={installmentForm.installment_number} onChange={e => setInstallmentForm({...installmentForm, installment_number:parseInt(e.target.value)})} style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Amount (₹) *</label>
            <input type='number' value={installmentForm.amount} onChange={e => setInstallmentForm({...installmentForm, amount:e.target.value})} placeholder='e.g. 5000' style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Due Date *</label>
            <input type='date' value={installmentForm.due_date} onChange={e => setInstallmentForm({...installmentForm, due_date:e.target.value})} style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Notes</label>
            <input value={installmentForm.notes} onChange={e => setInstallmentForm({...installmentForm, notes:e.target.value})} placeholder='Optional' style={inputStyle} />
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowInstallmentForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={createInstallment} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Add Installment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'380px' }}>
            <h3 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'8px' }}>✅ Record Payment</h3>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'14px', marginBottom:'20px' }}>
              Amount: <strong style={{ color:'#38bdf8' }}>₹{showPaymentModal.type==='invoice' ? Number(showPaymentModal.total_amount).toLocaleString() : Number(showPaymentModal.amount).toLocaleString()}</strong>
            </p>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'10px' }}>Payment Mode *</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'20px' }}>
              {PAYMENT_MODES.map(mode => (
                <button key={mode} onClick={() => setPaymentMode(mode)}
                  style={{ padding:'7px 16px', borderRadius:'20px', border:`1px solid ${paymentMode===mode?'#38bdf8':'#334155'}`, backgroundColor:paymentMode===mode?'rgba(56,189,248,0.15)':'transparent', color:paymentMode===mode?'#38bdf8':'#94a3b8', cursor:'pointer', fontSize:'13px' }}>
                  {mode}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowPaymentModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => showPaymentModal.type==='invoice' ? markInvoicePaid(showPaymentModal, paymentMode) : markInstallmentPaid(showPaymentModal, paymentMode)} className="btn-primary">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Fee Structure Modal */}
      {showStructureForm && (
        <div className="modal-overlay" onClick={() => setShowStructureForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'18px', fontWeight:'700', marginBottom:'20px' }}>📋 Fee Structure Templates</h3>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Program *</label>
            <select value={structureForm.program} onChange={e => setStructureForm({...structureForm, program:e.target.value})} style={inputStyle}>
              <option value=''>-- Select Program --</option>
              {[...new Set(students.map(s => s.program).filter(Boolean))].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Fee Type *</label>
            <select value={structureForm.fee_type} onChange={e => setStructureForm({...structureForm, fee_type:e.target.value})} style={inputStyle}>
              {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Amount (₹) *</label>
            <input type='number' value={structureForm.amount} onChange={e => setStructureForm({...structureForm, amount:e.target.value})} placeholder='e.g. 15000' style={inputStyle} />
            <label style={{ color:'#94a3b8', fontSize:'13px', display:'block', marginBottom:'6px' }}>Academic Year</label>
            <input value={structureForm.academic_year} onChange={e => setStructureForm({...structureForm, academic_year:e.target.value})} style={inputStyle} />
            {structures.length > 0 && (
              <div style={{ marginBottom:'16px' }}>
                <div style={{ color:'#94a3b8', fontSize:'13px', marginBottom:'8px' }}>Saved Structures:</div>
                {structures.map(s => (
                  <div key={s.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'13px' }}>
                    <span style={{ color:'rgba(255,255,255,0.6)' }}>{s.program} · {s.fee_type}</span>
                    <span style={{ color:'#38bdf8' }}>₹{Number(s.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={() => setShowStructureForm(false)} className="btn-secondary">Close</button>
              <button onClick={saveStructure} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Structure'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}