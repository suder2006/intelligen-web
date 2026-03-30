'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSchool } from '@/hooks/useSchool'
import { APP_URL } from '@/lib/config'
import * as XLSX from 'xlsx'

const LEAD_STATUSES = ['new', 'contacted', 'visit_booked', 'visit_completed', 'enrolled', 'closed']
const LEAD_SOURCES = ['walk-in', 'google_ads', 'meta_ads', 'referral', 'website', 'other']

const statusColor = {
  new: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  contacted: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  visit_booked: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  visit_completed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  enrolled: { bg: 'rgba(16,185,129,0.25)', color: '#10b981' },
  closed: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

const sourceColor = {
  'walk-in': { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8' },
  'google_ads': { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  'meta_ads': { bg: 'rgba(99,102,241,0.1)', color: '#818cf8' },
  'referral': { bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
  'website': { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa' },
  'other': { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
}

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState([])
  const [visits, setVisits] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [centerHeads, setCenterHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('pipeline') // pipeline | list | visits | analytics
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterProgram, setFilterProgram] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [programs, setPrograms] = useState([])
  const [saving2, setSaving2] = useState(false)
  const [copied, setCopied] = useState(false)
  const { schoolId, schoolName } = useSchool()

  const [addForm, setAddForm] = useState({
    parent_name: '', phone: '', email: '', child_name: '',
    child_dob: '', program: '', lead_source: 'walk-in',
    preferred_visit_date: '', notes: '', assigned_to: ''
  })

  const [noteText, setNoteText] = useState('')
  const [followUpForm, setFollowUpForm] = useState({
    due_date: new Date().toISOString().split('T')[0],
    due_time: '10:00', task_type: 'call', comments: ''
  })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadData, setUploadData] = useState([])
  const [uploadErrors, setUploadErrors] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  const fetchAll = async () => {
    setLoading(true)
    const [enqRes, visRes, fuRes, chRes, progRes] = await Promise.all([
      supabase.from('enquiries').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('visit_bookings').select('*, enquiries(parent_name, child_name)').eq('school_id', schoolId).order('visit_date'),
      supabase.from('follow_ups').select('*, enquiries(parent_name, child_name, phone)').eq('school_id', schoolId).order('due_date'),
      supabase.from('profiles').select('*').eq('school_id', schoolId).eq('role', 'center_head'),
      supabase.from('curriculum_masters').select('*').eq('type', 'program').eq('school_id', schoolId).order('value')
    ])
    setEnquiries(enqRes.data || [])
    setVisits(visRes.data || [])
    setFollowUps(fuRes.data || [])
    setCenterHeads(chRes.data || [])
    setPrograms(progRes.data?.map(p => p.value) || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('enquiries').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await fetchAll()
    if (selectedEnquiry?.id === id) setSelectedEnquiry(prev => ({ ...prev, status }))
  }

  const assignEnquiry = async (id, assignedTo) => {
    await supabase.from('enquiries').update({ assigned_to: assignedTo || null }).eq('id', id)
    await fetchAll()
  }

  const addNote = async () => {
    if (!noteText.trim() || !selectedEnquiry) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('enquiry_notes').insert({
      school_id: schoolId, enquiry_id: selectedEnquiry.id,
      added_by: user.id, note: noteText
    })
    setNoteText('')
    fetchEnquiryNotes(selectedEnquiry.id)
  }

  const [enquiryNotes, setEnquiryNotes] = useState([])
  const fetchEnquiryNotes = async (enquiryId) => {
    const { data } = await supabase.from('enquiry_notes').select('*, profiles(full_name)').eq('enquiry_id', enquiryId).order('created_at', { ascending: false })
    setEnquiryNotes(data || [])
  }

  const addFollowUp = async () => {
    if (!selectedEnquiry || !followUpForm.due_date) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('follow_ups').insert({
      school_id: schoolId, enquiry_id: selectedEnquiry.id,
      assigned_to: selectedEnquiry.assigned_to || user.id,
      due_date: followUpForm.due_date, due_time: followUpForm.due_time,
      task_type: followUpForm.task_type, comments: followUpForm.comments,
      status: 'pending'
    })
    setFollowUpForm({ due_date: new Date().toISOString().split('T')[0], due_time: '10:00', task_type: 'call', comments: '' })
    await fetchAll()
  }

  const saveAddForm = async () => {
    if (!addForm.parent_name || !addForm.phone || !addForm.child_name) {
      alert('Please fill Parent Name, Phone and Child Name'); return
    }
    setSaving2(true)
    const { data: { user } } = await supabase.auth.getUser()
    const dob = addForm.child_dob ? new Date(addForm.child_dob) : null
    const now = new Date()
    const ageMonths = dob ? (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth()) : null
    const { data: newEnq } = await supabase.from('enquiries').insert({
      school_id: schoolId, ...addForm,
      child_dob: addForm.child_dob || null,
      child_age_years: ageMonths ? Math.floor(ageMonths / 12) : null,
      child_age_months: ageMonths,
      preferred_visit_date: addForm.preferred_visit_date || null,
      assigned_to: addForm.assigned_to || null,
      status: 'new'
    }).select().single()
    if (newEnq) {
      const dueDate = new Date()
      dueDate.setHours(dueDate.getHours() + 1)
      await supabase.from('follow_ups').insert({
        school_id: schoolId, enquiry_id: newEnq.id,
        assigned_to: addForm.assigned_to || null,
        due_date: dueDate.toISOString().split('T')[0],
        due_time: dueDate.toTimeString().slice(0, 5),
        task_type: 'call', status: 'pending'
      })
    }
    setShowAddForm(false)
    setAddForm({ parent_name: '', phone: '', email: '', child_name: '', child_dob: '', program: '', lead_source: 'walk-in', preferred_visit_date: '', notes: '', assigned_to: '' })
    await fetchAll()
    setSaving2(false)
  }

  const enquiryUrl = `${APP_URL}/enquiry?school=${schoolId}`
  const copyEnquiryLink = () => {
    navigator.clipboard.writeText(enquiryUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Parent Name': 'e.g. Priya Sharma',
        'Phone': 'e.g. 9876543210',
        'Email': 'e.g. priya@email.com',
        'Child Name': 'e.g. Aarav Sharma',
        'Child DOB': 'e.g. 2022-01-15',
        'Program': 'e.g. Nursery',
        'Lead Source': 'e.g. walk-in',
        'Notes': 'e.g. Interested in morning batch',
        'Preferred Visit Date': 'e.g. 2026-04-01'
      }
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Enquiries')
    XLSX.writeFile(wb, 'enquiry-template.xlsx')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws)
      console.log('Raw Excel data:', JSON.stringify(data[0])) // ADD THIS for debug
      // Validate and map data
      const mapped = data.map((row, index) => ({
        row: index + 2,
        parent_name: row['Parent Name'] || '',
        phone: String(row['Phone'] || '').trim(),
        email: row['Email'] || '',
        child_name: row['Child Name'] || '',
        child_dob: row['Child DOB'] || '',
        program: row['Program'] || '',
        lead_source: row['Lead Source'] || 'walk-in',
        notes: row['Notes'] || '',
        preferred_visit_date: row['Preferred Visit Date'] || ''
      }))
      // Validate
      const errors = []
      mapped.forEach(row => {
        if (!row.parent_name) errors.push(`Row ${row.row}: Parent Name is required`)
        if (!row.phone) errors.push(`Row ${row.row}: Phone is required`)
        if (!row.child_name) errors.push(`Row ${row.row}: Child Name is required`)
      })
      setUploadData(mapped)
      setUploadErrors(errors)
    }
    reader.readAsBinaryString(file)
  }

  const processUpload = async () => {
    if (uploadErrors.length > 0) { alert('Please fix errors before uploading'); return }
    setUploading(true)
    let imported = 0
    let skipped = 0
    const skippedList = []

    for (const row of uploadData) {
      // Check duplicate
      const existing = enquiries.find(e => e.phone === row.phone)
      if (existing) {
        skipped++
        skippedList.push(`${row.parent_name} (${row.phone}) - duplicate`)
        continue
      }
      // Calculate age
      const dob = row.child_dob ? new Date(row.child_dob) : null
      const now = new Date()
      const ageMonths = dob ? (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth()) : null
      // Insert
      const { data: newEnq } = await supabase.from('enquiries').insert({
        school_id: schoolId,
        parent_name: row.parent_name,
        phone: row.phone,
        email: row.email || null,
        child_name: row.child_name,
        child_dob: row.child_dob || null,
        child_age_years: ageMonths ? Math.floor(ageMonths / 12) : null,
        child_age_months: ageMonths,
        program: row.program || null,
        lead_source: row.lead_source || 'walk-in',
        notes: row.notes || null,
        preferred_visit_date: row.preferred_visit_date || null,
        status: 'new'
      }).select().single()

      if (newEnq) {
        // Auto create follow-up
        const dueDate = new Date()
        dueDate.setHours(dueDate.getHours() + 1)
        await supabase.from('follow_ups').insert({
          school_id: schoolId,
          enquiry_id: newEnq.id,
          due_date: dueDate.toISOString().split('T')[0],
          due_time: dueDate.toTimeString().slice(0, 5),
          task_type: 'call',
          status: 'pending'
        })
        imported++
      }
    }

    setUploadResult({ imported, skipped, skippedList })
    setUploading(false)
    await fetchAll()
  }

  const filteredEnquiries = enquiries.filter(e => {
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    const matchSource = filterSource === 'all' || e.lead_source === filterSource
    const matchProgram = filterProgram === 'all' || e.program === filterProgram
    const matchSearch = !search || e.parent_name?.toLowerCase().includes(search.toLowerCase()) || e.child_name?.toLowerCase().includes(search.toLowerCase()) || e.phone?.includes(search)
    return matchStatus && matchSource && matchProgram && matchSearch
  })

  // Analytics
  const totalLeads = enquiries.length
  const todayLeads = enquiries.filter(e => e.created_at?.startsWith(new Date().toISOString().split('T')[0])).length
  const enrolled = enquiries.filter(e => e.status === 'enrolled').length
  const conversionRate = totalLeads > 0 ? Math.round((enrolled / totalLeads) * 100) : 0
  const pendingFollowUps = followUps.filter(f => f.status === 'pending').length
  const missedFollowUps = followUps.filter(f => f.status === 'pending' && new Date(`${f.due_date}T${f.due_time}`) < new Date()).length
  const todayVisits = visits.filter(v => v.visit_date === new Date().toISOString().split('T')[0]).length

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

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
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 11px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); white-space: nowrap; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); cursor: pointer; }
        .pipeline-col { min-width: 200px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 14px; }
        .pipeline-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; }
        .pipeline-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-1px); }
        @media (max-width: 768px) { .sidebar { display: none; } .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <div className="sidebar">
        <div className="logo">Intelli<span>Gen</span></div>
        {[
          { href: '/admin', label: 'Dashboard', icon: '⊞' },
          { href: '/admin/students', label: 'Students', icon: '👶' },
          { href: '/admin/staff', label: 'Staff', icon: '👩‍🏫' },
          { href: '/admin/admissions', label: 'Admissions', icon: '📋' },
          { href: '/admin/enquiries', label: 'Enquiries CRM', icon: '🎯' },
          { href: '/admin/fees', label: 'Fees', icon: '💳' },
          { href: '/admin/attendance', label: 'Attendance', icon: '✅' },
          { href: '/admin/ptm', label: 'PTM', icon: '🤝' },
          { href: '/admin/messages', label: 'Messages', icon: '💬' },
          { href: '/admin/reports', label: 'Reports', icon: '📈' },
        ].map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${item.href === '/admin/enquiries' ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
          </Link>
        ))}
      </div>

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🎯 Enquiries CRM</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>{schoolName}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={copyEnquiryLink} className="btn-secondary">
              {copied ? '✅ Copied!' : '🔗 Copy Enquiry Link'}
            </button>
            <a href={enquiryUrl} target='_blank' rel='noreferrer' className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              👁️ Preview Form
            </a>
            <button onClick={() => { setShowUploadModal(true); setUploadData([]); setUploadErrors([]); setUploadResult(null) }} className="btn-secondary">📤 Upload Excel</button>
            <button onClick={() => setShowAddForm(true)} className="btn-primary">+ Add Enquiry</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total Leads', value: totalLeads, color: '#38bdf8' },
            { label: 'Today', value: todayLeads, color: '#a78bfa' },
            { label: 'Enrolled', value: enrolled, color: '#10b981' },
            { label: 'Conversion', value: `${conversionRate}%`, color: '#34d399' },
            { label: "Today's Visits", value: todayVisits, color: '#f59e0b' },
            { label: 'Pending Tasks', value: pendingFollowUps, color: '#38bdf8' },
            { label: 'Missed Tasks', value: missedFollowUps, color: '#f87171' },
          ].map(item => (
            <div key={item.label} className="card" style={{ padding: '14px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>{item.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Missed follow-ups alert */}
        {missedFollowUps > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#f87171', fontWeight: '600' }}>🚨 {missedFollowUps} missed follow-up{missedFollowUps > 1 ? 's' : ''}!</div>
            <button onClick={() => setView('list')} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>View Now</button>
          </div>
        )}

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['pipeline', '📊 Pipeline'], ['list', '📋 List'], ['visits', '🏫 Visits'], ['analytics', '📈 Analytics']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {/* Filters */}
        {(view === 'list' || view === 'pipeline') && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input placeholder='Search name, phone...' value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '8px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
              <option value='all'>All Status</option>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              style={{ padding: '8px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
              <option value='all'>All Sources</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
              style={{ padding: '8px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
              <option value='all'>All Programs</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '8px 0' }}>{filteredEnquiries.length} leads</span>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* PIPELINE VIEW */}
            {view === 'pipeline' && (
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px' }}>
                {LEAD_STATUSES.map(status => {
                  const statusEnquiries = filteredEnquiries.filter(e => e.status === status)
                  return (
                    <div key={status} className="pipeline-col" style={{ minWidth: '220px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="badge" style={{ background: statusColor[status]?.bg, color: statusColor[status]?.color }}>{status}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: '600' }}>{statusEnquiries.length}</span>
                      </div>
                      {statusEnquiries.map(e => (
                        <div key={e.id} className="pipeline-card" onClick={() => { setSelectedEnquiry(e); fetchEnquiryNotes(e.id); setShowDetailModal(true) }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>{e.parent_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '12px', marginBottom: '4px' }}>{e.child_name} · {e.program || '—'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>{e.phone}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{new Date(e.created_at).toLocaleDateString()}</span>
                            {e.is_duplicate && <span style={{ fontSize: '10px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: '4px' }}>DUP</span>}
                          </div>
                          <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: sourceColor[e.lead_source]?.bg, color: sourceColor[e.lead_source]?.color }}>{e.lead_source}</span>
                          </div>
                        </div>
                      ))}
                      {statusEnquiries.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>No leads</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th>Child</th>
                      <th>Program</th>
                      <th>Phone</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Next Follow-up</th>
                      <th>Assigned To</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnquiries.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No enquiries found.</td></tr>
                    ) : filteredEnquiries.map(e => {
                      const nextFollowUp = followUps.filter(f => f.enquiry_id === e.id && f.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
                      const isMissed = nextFollowUp && new Date(`${nextFollowUp.due_date}T${nextFollowUp.due_time}`) < new Date()
                      return (
                        <tr key={e.id} onClick={() => { setSelectedEnquiry(e); fetchEnquiryNotes(e.id); setShowDetailModal(true) }}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{e.parent_name}</div>
                            {e.is_duplicate && <div style={{ color: '#f59e0b', fontSize: '11px' }}>⚠️ Duplicate</div>}
                          </td>
                          <td style={{ color: '#a78bfa' }}>{e.child_name}</td>
                          <td>{e.program || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span>{e.phone}</span>
                              <a href={`tel:${e.phone}`} onClick={ev => ev.stopPropagation()} style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞</a>
                              <a href={`https://wa.me/${e.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer' onClick={ev => ev.stopPropagation()} style={{ color: '#34d399', fontSize: '12px', textDecoration: 'none' }}>💬</a>
                            </div>
                          </td>
                          <td><span className="badge" style={{ background: sourceColor[e.lead_source]?.bg, color: sourceColor[e.lead_source]?.color }}>{e.lead_source}</span></td>
                          <td>
                            <select value={e.status} onChange={ev => { ev.stopPropagation(); updateStatus(e.id, ev.target.value) }}
                              onClick={ev => ev.stopPropagation()}
                              style={{ padding: '4px 8px', background: statusColor[e.status]?.bg, border: 'none', borderRadius: '20px', color: statusColor[e.status]?.color, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ color: isMissed ? '#f87171' : 'rgba(255,255,255,0.6)', fontWeight: isMissed ? '600' : '400' }}>
                            {nextFollowUp ? `${nextFollowUp.due_date} ${nextFollowUp.due_time}` : '—'}
                            {isMissed && <div style={{ fontSize: '11px', color: '#f87171' }}>🚨 Missed!</div>}
                          </td>
                          <td>
                            <select value={e.assigned_to || ''} onChange={ev => { ev.stopPropagation(); assignEnquiry(e.id, ev.target.value) }}
                              onClick={ev => ev.stopPropagation()}
                              style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
                              <option value=''>Unassigned</option>
                              {centerHeads.map(ch => <option key={ch.id} value={ch.id}>{ch.full_name}</option>)}
                            </select>
                          </td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                          <td onClick={ev => ev.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <a href={`tel:${e.phone}`} style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '11px', textDecoration: 'none' }}>📞</a>
                              <a href={`https://wa.me/${e.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer' style={{ padding: '4px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', fontSize: '11px', textDecoration: 'none' }}>💬</a>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISITS VIEW */}
            {view === 'visits' && (
              <>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '16px' }}>🏫 Scheduled Visits</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Parent</th>
                        <th>Child</th>
                        <th>Visit Date</th>
                        <th>Time Slot</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.3)' }}>No visits scheduled.</td></tr>
                      ) : visits.map(v => (
                        <tr key={v.id}>
                          <td style={{ fontWeight: '600' }}>{v.enquiries?.parent_name}</td>
                          <td style={{ color: '#a78bfa' }}>{v.enquiries?.child_name}</td>
                          <td>{v.visit_date}</td>
                          <td style={{ color: '#38bdf8', fontWeight: '600' }}>{v.slot_time}</td>
                          <td>
                            <select value={v.status} onChange={async e => {
                              await supabase.from('visit_bookings').update({ status: e.target.value }).eq('id', v.id)
                              if (e.target.value === 'completed') {
                                await supabase.from('enquiries').update({ status: 'visit_completed' }).eq('id', v.enquiry_id)
                              }
                              await fetchAll()
                            }}
                              style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                              {['scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <a href={`tel:${enquiries.find(e => e.id === v.enquiry_id)?.phone}`}
                                style={{ padding: '4px 8px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '11px', textDecoration: 'none' }}>📞</a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ANALYTICS VIEW */}
            {view === 'analytics' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {LEAD_STATUSES.map(status => {
                    const count = enquiries.filter(e => e.status === status).length
                    const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
                    return (
                      <div key={status} className="card" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span className="badge" style={{ background: statusColor[status]?.bg, color: statusColor[status]?.color }}>{status}</span>
                          <span style={{ fontWeight: '700', color: statusColor[status]?.color }}>{count}</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: statusColor[status]?.color, borderRadius: '4px', width: `${pct}%` }} />
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>{pct}% of total</div>
                      </div>
                    )
                  })}
                </div>

                {/* Source breakdown */}
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '14px' }}>📊 Lead Sources</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {LEAD_SOURCES.map(source => {
                    const count = enquiries.filter(e => e.lead_source === source).length
                    return (
                      <div key={source} className="card" style={{ padding: '14px' }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: sourceColor[source]?.color }}>{count}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{source}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Program breakdown */}
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '14px' }}>📚 Program Interest</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                  {programs.map(prog => {
                    const count = enquiries.filter(e => e.program === prog).length
                    return (
                      <div key={prog} className="card" style={{ padding: '14px' }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: '#a78bfa' }}>{count}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{prog}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedEnquiry && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{selectedEnquiry.parent_name}</h3>
                <div style={{ color: '#a78bfa', fontSize: '14px' }}>{selectedEnquiry.child_name} · {selectedEnquiry.program || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <a href={`tel:${selectedEnquiry.phone}`} style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📞 Call</a>
                <a href={`https://wa.me/${selectedEnquiry.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer' style={{ padding: '7px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34d399', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>💬 WhatsApp</a>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {[
                { label: 'Phone', value: selectedEnquiry.phone },
                { label: 'Email', value: selectedEnquiry.email || '—' },
                { label: 'Child DOB', value: selectedEnquiry.child_dob || '—' },
                { label: 'Age', value: selectedEnquiry.child_age_years ? `${selectedEnquiry.child_age_years}y ${selectedEnquiry.child_age_months % 12}m` : '—' },
                { label: 'Lead Source', value: selectedEnquiry.lead_source },
                { label: 'Created', value: new Date(selectedEnquiry.created_at).toLocaleString() },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {selectedEnquiry.notes && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Notes</div>
                <div style={{ fontSize: '13px' }}>{selectedEnquiry.notes}</div>
              </div>
            )}

            {/* Status Update */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Update Status</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {LEAD_STATUSES.map(status => (
                  <button key={status} onClick={() => updateStatus(selectedEnquiry.id, status)}
                    style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${selectedEnquiry.status === status ? statusColor[status]?.color : 'rgba(255,255,255,0.1)'}`, background: selectedEnquiry.status === status ? statusColor[status]?.bg : 'transparent', color: selectedEnquiry.status === status ? statusColor[status]?.color : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Assign */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Assign To</label>
              <select value={selectedEnquiry.assigned_to || ''} onChange={e => { assignEnquiry(selectedEnquiry.id, e.target.value); setSelectedEnquiry(prev => ({ ...prev, assigned_to: e.target.value })) }}
                style={{ ...inputStyle, marginBottom: 0 }}>
                <option value=''>Unassigned</option>
                {centerHeads.map(ch => <option key={ch.id} value={ch.id}>{ch.full_name}</option>)}
              </select>
            </div>

            {/* Follow-up */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '10px', fontSize: '14px' }}>📅 Add Follow-up Task</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type='date' value={followUpForm.due_date} onChange={e => setFollowUpForm({ ...followUpForm, due_date: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
                <input type='time' value={followUpForm.due_time} onChange={e => setFollowUpForm({ ...followUpForm, due_time: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <select value={followUpForm.task_type} onChange={e => setFollowUpForm({ ...followUpForm, task_type: e.target.value })} style={{ ...inputStyle, marginBottom: '8px' }}>
                <option value='call'>📞 Call Parent</option>
                <option value='confirm_visit'>🏫 Confirm Visit</option>
                <option value='follow_up'>🔄 Follow Up</option>
                <option value='send_info'>📧 Send Info</option>
              </select>
              <input value={followUpForm.comments} onChange={e => setFollowUpForm({ ...followUpForm, comments: e.target.value })} placeholder='Comments...' style={{ ...inputStyle, marginBottom: '8px' }} />
              <button onClick={addFollowUp} className="btn-primary" style={{ width: '100%' }}>+ Add Task</button>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>📝 Notes</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder='Add a note...'
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button onClick={addNote} className="btn-primary" style={{ padding: '10px 16px' }}>Add</button>
              </div>
              {enquiryNotes.map(note => (
                <div key={note.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', marginBottom: '4px' }}>{note.note}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{note.profiles?.full_name} · {new Date(note.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Follow-up history */}
            {followUps.filter(f => f.enquiry_id === selectedEnquiry.id).length > 0 && (
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>📋 Follow-up Tasks</div>
                {followUps.filter(f => f.enquiry_id === selectedEnquiry.id).map(f => {
                  const isMissed = f.status === 'pending' && new Date(`${f.due_date}T${f.due_time}`) < new Date()
                  return (
                    <div key={f.id} style={{ background: isMissed ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMissed ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '8px', padding: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{f.task_type} · {f.due_date} {f.due_time}</div>
                        {f.comments && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{f.comments}</div>}
                        {isMissed && <div style={{ color: '#f87171', fontSize: '11px' }}>🚨 Missed!</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: f.status === 'completed' ? 'rgba(16,185,129,0.15)' : isMissed ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: f.status === 'completed' ? '#34d399' : isMissed ? '#f87171' : '#fbbf24' }}>{f.status}</span>
                        {f.status === 'pending' && (
                          <button onClick={async () => {
                            await supabase.from('follow_ups').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', f.id)
                            await fetchAll()
                          }}
                            style={{ padding: '3px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', cursor: 'pointer', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>✅ Done</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowDetailModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Enquiry Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>➕ Add Enquiry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Parent Name *</label>
                <input value={addForm.parent_name} onChange={e => setAddForm({ ...addForm, parent_name: e.target.value })} placeholder='Parent Name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Phone *</label>
                <input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder='+91 98765 43210' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Child Name *</label>
                <input value={addForm.child_name} onChange={e => setAddForm({ ...addForm, child_name: e.target.value })} placeholder='Child Name' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Child DOB</label>
                <input type='date' value={addForm.child_dob} onChange={e => setAddForm({ ...addForm, child_dob: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Program</label>
                <select value={addForm.program} onChange={e => setAddForm({ ...addForm, program: e.target.value })} style={inputStyle}>
                  <option value=''>-- Select --</option>
                  {programs.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Lead Source</label>
                <select value={addForm.lead_source} onChange={e => setAddForm({ ...addForm, lead_source: e.target.value })} style={inputStyle}>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email</label>
                <input type='email' value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder='email@example.com' style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Assign To</label>
                <select value={addForm.assigned_to} onChange={e => setAddForm({ ...addForm, assigned_to: e.target.value })} style={inputStyle}>
                  <option value=''>Unassigned</option>
                  {centerHeads.map(ch => <option key={ch.id} value={ch.id}>{ch.full_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Notes</label>
                <input value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder='Any notes...' style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveAddForm} disabled={saving2} className="btn-primary">{saving2 ? 'Saving...' : 'Add Enquiry'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Excel Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>📤 Upload Enquiries from Excel</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '20px' }}>Upload multiple enquiries at once using an Excel file</p>

            {!uploadResult ? (
              <>
                {/* Download Template */}
                <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '6px', fontSize: '14px' }}>Step 1: Download Template</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '10px' }}>Download the template, fill in your data and upload it back.</div>
                  <button onClick={downloadTemplate} className="btn-secondary">⬇️ Download Excel Template</button>
                </div>

                {/* Upload File */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Step 2: Upload Filled File</div>
                  <input type='file' accept='.xlsx,.xls,.csv' onChange={handleFileUpload}
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '10px', display: 'block' }} />
                </div>

                {/* Preview */}
                {uploadData.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>
                      📋 Preview — {uploadData.length} rows found
                      {uploadErrors.length > 0 && <span style={{ color: '#f87171', fontSize: '13px', marginLeft: '8px' }}>({uploadErrors.length} errors)</span>}
                    </div>

                    {/* Errors */}
                    {uploadErrors.length > 0 && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                        <div style={{ color: '#f87171', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>❌ Please fix these errors:</div>
                        {uploadErrors.map((err, i) => <div key={i} style={{ color: '#fca5a5', fontSize: '12px' }}>{err}</div>)}
                      </div>
                    )}

                    {/* Duplicate warnings */}
                    {uploadData.filter(row => enquiries.find(e => e.phone === row.phone)).length > 0 && (
                      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                        <div style={{ color: '#fbbf24', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>⚠️ Duplicates will be skipped:</div>
                        {uploadData.filter(row => enquiries.find(e => e.phone === row.phone)).map((row, i) => (
                          <div key={i} style={{ color: '#fcd34d', fontSize: '12px' }}>{row.parent_name} ({row.phone})</div>
                        ))}
                      </div>
                    )}

                    {/* Preview table */}
                    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                            {['Parent', 'Phone', 'Child', 'Program', 'Source'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {uploadData.slice(0, 5).map((row, i) => {
                            const isDup = enquiries.find(e => e.phone === row.phone)
                            return (
                              <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', opacity: isDup ? 0.5 : 1 }}>
                                <td style={{ padding: '8px 12px', fontSize: '12px' }}>{row.parent_name} {isDup && <span style={{ color: '#fbbf24', fontSize: '10px' }}>DUP</span>}</td>
                                <td style={{ padding: '8px 12px', fontSize: '12px' }}>{row.phone}</td>
                                <td style={{ padding: '8px 12px', fontSize: '12px' }}>{row.child_name}</td>
                                <td style={{ padding: '8px 12px', fontSize: '12px' }}>{row.program || '—'}</td>
                                <td style={{ padding: '8px 12px', fontSize: '12px' }}>{row.lead_source}</td>
                              </tr>
                            )
                          })}
                          {uploadData.length > 5 && (
                            <tr><td colSpan={5} style={{ padding: '8px 12px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>...and {uploadData.length - 5} more rows</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancel</button>
                  {uploadData.length > 0 && uploadErrors.length === 0 && (
                    <button onClick={processUpload} disabled={uploading} className="btn-primary">
                      {uploading ? '⏳ Importing...' : `📤 Import ${uploadData.filter(row => !enquiries.find(e => e.phone === row.phone)).length} Enquiries`}
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* Upload Result */
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '8px' }}>Import Complete!</div>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#10b981', fontWeight: '700', fontSize: '28px' }}>{uploadResult.imported}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Imported</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#f59e0b', fontWeight: '700', fontSize: '28px' }}>{uploadResult.skipped}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Skipped (Duplicates)</div>
                  </div>
                </div>
                {uploadResult.skippedList.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '16px', textAlign: 'left' }}>
                    <div style={{ color: '#fbbf24', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>⚠️ Skipped duplicates:</div>
                    {uploadResult.skippedList.map((s, i) => <div key={i} style={{ color: '#fcd34d', fontSize: '12px' }}>{s}</div>)}
                  </div>
                )}
                <button onClick={() => setShowUploadModal(false)} className="btn-primary">✅ Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}