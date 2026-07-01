'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSchool } from '@/hooks/useSchool'
import AdminSidebar from '@/components/AdminSidebar'

const STATUSES = ['Not Started', 'In Progress', 'Completed']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const RECURRENCE_TYPES = ['None', 'Daily', 'Weekly', 'Monthly']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const STATUS_COLORS = {
  'Not Started': { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'In Progress': { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  'Completed': { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
}

const PRIORITY_COLORS = {
  'Low': { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'Medium': { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  'High': { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  'Urgent': { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

export default function TasksPage() {
  const today = new Date()
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState([])
  const [staff, setStaff] = useState([])
  const [profile, setProfile] = useState(null)
  const [view, setView] = useState('list') // list | dashboard
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadForm, setDownloadForm] = useState({
    type: 'month',
    month: today.toISOString().slice(0, 7),
    from_date: today.toISOString().split('T')[0],
    to_date: today.toISOString().split('T')[0],
    assigned_to: '',
    status: '',
    priority: '',
    overdue: false,
    recurring: '',
    carried_forward: false,
  })

  // Month navigation
  
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  // Filters
  const [filterAssignedTo, setFilterAssignedTo] = useState('')
  const [filterAssignedBy, setFilterAssignedBy] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)
  const [filterCarriedForward, setFilterCarriedForward] = useState(false)
  const [filterRecurring, setFilterRecurring] = useState('')
  const [searchText, setSearchText] = useState('')

  // Carry forward form
  const [cfForm, setCfForm] = useState({ due_date: '', assigned_to: '' })

  const [form, setForm] = useState({
    date_assigned: today.toISOString().split('T')[0],
    assigned_to: '',
    item: '',
    description: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started',
    remarks: '',
    recurrence_type: 'None',
    repeat_days: [],
    repeat_until: '',
  })

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  useEffect(() => { if (schoolId) loadData() }, [schoolId])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    // Load staff + admin (not parents, not drivers)
    const { data: staffData } = await supabase.from('profiles')
      .select('id, full_name, role')
      .eq('school_id', schoolId)
      .in('role', ['teacher', 'admin', 'staff', 'school_admin'])
      .order('full_name')
    setStaff(staffData || [])

    await fetchTasks()
    setLoading(false)
  }

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks')
      .select('*, assigned_by_profile:assigned_by(full_name), assigned_to_profile:assigned_to(full_name)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('due_date')
    setTasks(data || [])
  }

  const isOverdue = (task) => {
    if (task.status === 'Completed') return false
    if (!task.due_date) return false
    return new Date(task.due_date) < new Date(new Date().toDateString())
  }

  const getMonthTasks = () => {
    const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    return tasks.filter(t => t.date_assigned?.startsWith(monthStr) || t.due_date?.startsWith(monthStr))
  }

  const getFilteredTasks = () => {
    let filtered = getMonthTasks()

    if (filterAssignedTo) filtered = filtered.filter(t => t.assigned_to === filterAssignedTo)
    if (filterAssignedBy) filtered = filtered.filter(t => t.assigned_by === filterAssignedBy)
    if (filterStatus) filtered = filtered.filter(t => t.status === filterStatus)
    if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority)
    if (filterOverdue) filtered = filtered.filter(t => isOverdue(t))
    if (filterCarriedForward) filtered = filtered.filter(t => t.is_carried_forward)
    if (filterRecurring === 'recurring') filtered = filtered.filter(t => t.recurrence_type !== 'None')
    if (filterRecurring === 'non-recurring') filtered = filtered.filter(t => t.recurrence_type === 'None')
    if (searchText) {
      const s = searchText.toLowerCase()
      filtered = filtered.filter(t =>
        t.item?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s) ||
        t.assigned_to_profile?.full_name?.toLowerCase().includes(s) ||
        t.remarks?.toLowerCase().includes(s)
      )
    }
    return filtered
  }

  const generateRecurringDates = (form) => {
  const dates = []
  const start = new Date(form.date_assigned + 'T12:00:00')
  const end = new Date(form.repeat_until + 'T12:00:00')

  const formatDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  if (form.recurrence_type === 'Daily') {
    let cur = new Date(start)
    while (cur <= end) {
      if (cur.getDay() !== 0) dates.push(formatDate(cur))
      cur.setDate(cur.getDate() + 1)
    }
  } else if (form.recurrence_type === 'Weekly') {
    const dayMap = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 }
    let cur = new Date(start)
    while (cur <= end) {
      const dayNum = cur.getDay()
      const dayName = Object.keys(dayMap).find(k => dayMap[k] === dayNum)
      if (dayName && form.repeat_days.includes(dayName)) {
        dates.push(formatDate(cur))
      }
      cur.setDate(cur.getDate() + 1)
    }
  } else if (form.recurrence_type === 'Monthly') {
    let cur = new Date(start)
    while (cur <= end) {
      if (cur.getDay() !== 0) {
        dates.push(formatDate(cur))
      } else {
        // Sunday → move to Monday
        const next = new Date(cur)
        next.setDate(next.getDate() + 1)
        dates.push(formatDate(next))
      }
      cur.setMonth(cur.getMonth() + 1)
    }
  }
  return dates
}

  const saveTask = async () => {
    if (!form.assigned_to || !form.item || !form.due_date) {
      alert('Please fill Assigned To, Item and Due Date'); return
    }
    if (form.recurrence_type !== 'None' && !form.repeat_until) {
      alert('Please set Repeat Until date for recurring tasks'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (editingTask) {
      // Update existing task
      const updateData = {
        assigned_to: form.assigned_to,
        item: form.item,
        description: form.description,
        due_date: form.due_date,
        priority: form.priority,
        status: form.status,
        remarks: form.remarks,
        date_completed: form.status === 'Completed' ? (editingTask.date_completed || today.toISOString().split('T')[0]) : null,
        updated_at: new Date().toISOString()
      }
      await supabase.from('tasks').update(updateData).eq('id', editingTask.id)
    } else {
      // Create new task(s)
      if (form.recurrence_type !== 'None') {
        const dates = generateRecurringDates(form)
        if (dates.length === 0) { alert('No valid dates generated. Check dates and recurrence settings.'); setSaving(false); return }
        if (!confirm(`This will create ${dates.length} task instances. Proceed?`)) { setSaving(false); return }

        const groupId = crypto.randomUUID()
        const taskRows = dates.map(date => ({
          school_id: schoolId,
          date_assigned: date,
          assigned_by: user.id,
          assigned_to: form.assigned_to,
          item: form.item,
          description: form.description,
          due_date: date,
          priority: form.priority,
          status: 'Not Started',
          remarks: form.remarks,
          recurrence_type: form.recurrence_type,
          repeat_days: form.repeat_days,
          repeat_until: form.repeat_until,
          recurrence_group_id: groupId,
          is_carried_forward: false,
          is_deleted: false
        }))
        await supabase.from('tasks').insert(taskRows)
      } else {
        await supabase.from('tasks').insert({
          school_id: schoolId,
          date_assigned: form.date_assigned,
          assigned_by: user.id,
          assigned_to: form.assigned_to,
          item: form.item,
          description: form.description,
          due_date: form.due_date,
          priority: form.priority,
          status: 'Not Started',
          remarks: form.remarks,
          recurrence_type: 'None',
          is_carried_forward: false,
          is_deleted: false
        })
      }
    }

    setShowForm(false)
    setEditingTask(null)
    resetForm()
    await fetchTasks()
    setSaving(false)
  }

  const updateTaskStatus = async (task, newStatus) => {
    const updateData = {
      status: newStatus,
      date_completed: newStatus === 'Completed' ? today.toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString()
    }
    await supabase.from('tasks').update(updateData).eq('id', task.id)
    await fetchTasks()
  }

  const deleteTask = async (task, deleteAll = false) => {
    if (deleteAll && task.recurrence_group_id) {
      await supabase.from('tasks').update({ is_deleted: true }).eq('recurrence_group_id', task.recurrence_group_id)
        .gte('due_date', task.due_date)
    } else {
      await supabase.from('tasks').update({ is_deleted: true }).eq('id', task.id)
    }
    setShowDeleteConfirm(null)
    await fetchTasks()
  }

  const carryForward = async () => {
    if (!cfForm.due_date) { alert('Please select new due date'); return }
    const task = showCarryForwardModal
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('tasks').insert({
      school_id: schoolId,
      date_assigned: today.toISOString().split('T')[0],
      assigned_by: user.id,
      assigned_to: cfForm.assigned_to || task.assigned_to,
      item: task.item,
      description: task.description,
      due_date: cfForm.due_date,
      priority: task.priority,
      status: 'Not Started',
      remarks: task.remarks,
      recurrence_type: 'None',
      is_carried_forward: true,
      carried_forward_from: task.id,
      is_deleted: false
    })

    setShowCarryForwardModal(null)
    setCfForm({ due_date: '', assigned_to: '' })
    await fetchTasks()
    alert('✅ Task carried forward successfully!')
  }

  const resetForm = () => setForm({
    date_assigned: today.toISOString().split('T')[0],
    assigned_to: '',
    item: '',
    description: '',
    due_date: '',
    priority: 'Medium',
    status: 'Not Started',
    remarks: '',
    recurrence_type: 'None',
    repeat_days: [],
    repeat_until: '',
  })

  const openEdit = (task) => {
    setEditingTask(task)
    setForm({
      date_assigned: task.date_assigned,
      assigned_to: task.assigned_to,
      item: task.item,
      description: task.description || '',
      due_date: task.due_date,
      priority: task.priority || 'Medium',
      status: task.status,
      remarks: task.remarks || '',
      recurrence_type: task.recurrence_type || 'None',
      repeat_days: task.repeat_days || [],
      repeat_until: task.repeat_until || '',
    })
    setShowForm(true)
  }

  const filteredTasks = getFilteredTasks()
  const monthTasks = getMonthTasks()
  const dashStats = {
    total: monthTasks.length,
    notStarted: monthTasks.filter(t => t.status === 'Not Started').length,
    inProgress: monthTasks.filter(t => t.status === 'In Progress').length,
    completed: monthTasks.filter(t => t.status === 'Completed').length,
    overdue: monthTasks.filter(t => isOverdue(t)).length,
    carriedForward: monthTasks.filter(t => t.is_carried_forward).length,
  }

  const exportCSV = (headers, rows, filename) => {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const downloadTasks = () => {
  // Filter by date
  let filtered = [...tasks]

  if (downloadForm.type === 'month') {
    filtered = filtered.filter(t =>
      t.date_assigned?.startsWith(downloadForm.month) ||
      t.due_date?.startsWith(downloadForm.month)
    )
  } else {
    const from = new Date(downloadForm.from_date + 'T00:00:00')
    const to = new Date(downloadForm.to_date + 'T23:59:59')
    // Max 6 months check
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
    if (diffMonths > 6) { alert('Maximum date range is 6 months!'); return }
    filtered = filtered.filter(t => {
      const due = new Date(t.due_date + 'T12:00:00')
      return due >= from && due <= to
    })
  }

  // Apply filters
  if (downloadForm.assigned_to) filtered = filtered.filter(t => t.assigned_to === downloadForm.assigned_to)
  if (downloadForm.status) filtered = filtered.filter(t => t.status === downloadForm.status)
  if (downloadForm.priority) filtered = filtered.filter(t => t.priority === downloadForm.priority)
  if (downloadForm.overdue) filtered = filtered.filter(t => isOverdue(t))
  if (downloadForm.carried_forward) filtered = filtered.filter(t => t.is_carried_forward)
  if (downloadForm.recurring === 'recurring') filtered = filtered.filter(t => t.recurrence_type !== 'None')
  if (downloadForm.recurring === 'non-recurring') filtered = filtered.filter(t => t.recurrence_type === 'None')

  if (filtered.length === 0) { alert('No tasks found for selected filters!'); return }

  const headers = [
    'Date Assigned', 'Assigned By', 'Assigned To', 'Item', 'Description',
    'Due Date', 'Date Completed', 'Priority', 'Status', 'Remarks',
    'Recurrence', 'Carried Forward', 'Carried Forward From', 'Overdue'
  ]

  const rows = filtered.map(t => [
    t.date_assigned || '',
    t.assigned_by_profile?.full_name || '',
    t.assigned_to_profile?.full_name || '',
    t.item || '',
    t.description || '',
    t.due_date || '',
    t.date_completed || '',
    t.priority || '',
    t.status || '',
    t.remarks || '',
    t.recurrence_type || 'None',
    t.is_carried_forward ? 'Yes' : 'No',
    t.carried_forward_from || '',
    isOverdue(t) ? 'Yes' : 'No',
  ])

  const filename = downloadForm.type === 'month'
    ? `Tasks_${downloadForm.month}.csv`
    : `Tasks_${downloadForm.from_date}_to_${downloadForm.to_date}.csv`

  exportCSV(headers, rows, filename)
  setShowDownloadModal(false)
}  
  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none',
    fontFamily: "'DM Sans', sans-serif", marginBottom: '12px'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); border-radius: 10px; padding: 9px 18px; color: #f87171; font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 12px; }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; }
        .view-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .filter-chip { padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.5); font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .filter-chip.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .task-row { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px 16px; margin-bottom: 8px; transition: background 0.15s; }
        .task-row:hover { background: rgba(255,255,255,0.06); }
        .overdue-badge { background: rgba(239,68,68,0.15); color: #f87171; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        .cf-badge { background: rgba(167,139,250,0.15); color: #a78bfa; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>✅ Task Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Assign and track tasks for staff and admin</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowDownloadModal(true)}
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '10px 20px', color: '#34d399', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            📥 Download
          </button>
          <button className="btn-primary" onClick={() => { resetForm(); setEditingTask(null); setShowForm(true) }}>
            + New Task
          </button>
        </div>  
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[['list', '📋 Task List'], ['dashboard', '📊 Dashboard']].map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {/* Month Navigator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => {
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
              else setViewMonth(m => m - 1)
            }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 14px', color: '#fff', cursor: 'pointer' }}>← Prev</button>
            <div style={{ fontSize: '18px', fontWeight: '700', minWidth: '160px', textAlign: 'center' }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button onClick={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
              else setViewMonth(m => m + 1)
            }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 14px', color: '#fff', cursor: 'pointer' }}>Next →</button>
            <button onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()) }}
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', padding: '7px 14px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>
              Today
            </button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <>
            {/* DASHBOARD VIEW */}
            {view === 'dashboard' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                  {[
                    { label: 'Total Tasks', value: dashStats.total, color: '#38bdf8' },
                    { label: 'Not Started', value: dashStats.notStarted, color: '#94a3b8' },
                    { label: 'In Progress', value: dashStats.inProgress, color: '#38bdf8' },
                    { label: 'Completed', value: dashStats.completed, color: '#10b981' },
                    { label: 'Overdue', value: dashStats.overdue, color: '#ef4444' },
                    { label: 'Carried Forward', value: dashStats.carriedForward, color: '#a78bfa' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: item.color }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Staff-wise summary */}
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '14px' }}>👩‍🏫 Staff-wise Task Status</h3>
                {staff.map(s => {
                  const staffTasks = monthTasks.filter(t => t.assigned_to === s.id)
                  if (staffTasks.length === 0) return null
                  const done = staffTasks.filter(t => t.status === 'Completed').length
                  const overdue = staffTasks.filter(t => isOverdue(t)).length
                  const pct = Math.round((done / staffTasks.length) * 100)
                  return (
                    <div key={s.id} className="card" style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{s.full_name}</div>
                          <div style={{ color: '#a78bfa', fontSize: '12px' }}>{s.role}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                          <span style={{ color: '#94a3b8' }}>{staffTasks.length} total</span>
                          <span style={{ color: '#34d399' }}>{done} done</span>
                          {overdue > 0 && <span style={{ color: '#f87171' }}>{overdue} overdue</span>}
                        </div>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '4px', width: `${pct}%`, background: pct === 100 ? '#10b981' : pct >= 50 ? '#38bdf8' : '#f59e0b' }} />
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
              <>
                {/* Search */}
                <input placeholder='🔍 Search by item, description, assigned to, remarks...'
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', marginBottom: '14px' }} />

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {/* Assigned To */}
                  <select value={filterAssignedTo} onChange={e => setFilterAssignedTo(e.target.value)}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterAssignedTo ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                    <option value=''>👤 All Assignees</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>

                  {/* Status */}
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterStatus ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                    <option value=''>📊 All Status</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* Priority */}
                  <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterPriority ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                    <option value=''>🎯 All Priority</option>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  {/* Recurring */}
                  <select value={filterRecurring} onChange={e => setFilterRecurring(e.target.value)}
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterRecurring ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                    <option value=''>🔄 All Types</option>
                    <option value='recurring'>Recurring</option>
                    <option value='non-recurring'>Non-Recurring</option>
                  </select>

                  <button className={`filter-chip ${filterOverdue ? 'active' : ''}`}
                    onClick={() => setFilterOverdue(!filterOverdue)}>
                    🚨 Overdue
                  </button>
                  <button className={`filter-chip ${filterCarriedForward ? 'active' : ''}`}
                    onClick={() => setFilterCarriedForward(!filterCarriedForward)}>
                    ↩️ Carried Forward
                  </button>

                  {(filterAssignedTo || filterStatus || filterPriority || filterOverdue || filterCarriedForward || filterRecurring || searchText) && (
                    <button onClick={() => { setFilterAssignedTo(''); setFilterStatus(''); setFilterPriority(''); setFilterOverdue(false); setFilterCarriedForward(false); setFilterRecurring(''); setSearchText('') }}
                      style={{ padding: '5px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '20px', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
                      ✕ Clear
                    </button>
                  )}
                </div>

                {/* Task List */}
                {filteredTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                    <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No tasks found</div>
                    <div style={{ fontSize: '14px' }}>Click "+ New Task" to create one.</div>
                  </div>
                ) : filteredTasks.map(task => {
                  const overdue = isOverdue(task)
                  const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['Not Started']
                  const priorityStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Medium']
                  return (
                    <div key={task.id} className="task-row"
                      style={{ borderColor: overdue ? 'rgba(239,68,68,0.25)' : task.is_carried_forward ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        
                        {/* Left: Task info */}
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '15px' }}>{task.item}</span>
                            {overdue && <span className="overdue-badge">🚨 Overdue</span>}
                            {task.is_carried_forward && <span className="cf-badge">↩️ Carried Forward</span>}
                            {task.recurrence_type !== 'None' && (
                              <span style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>
                                🔄 {task.recurrence_type}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '6px' }}>{task.description}</div>
                          )}
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                            <span>👤 {task.assigned_to_profile?.full_name || 'Unknown'}</span>
                            <span>📅 Assigned: {task.date_assigned}</span>
                            <span style={{ color: overdue ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                              🗓️ Due: {task.due_date}
                            </span>
                            {task.date_completed && <span style={{ color: '#34d399' }}>✅ Done: {task.date_completed}</span>}
                            <span>By: {task.assigned_by_profile?.full_name || 'Admin'}</span>
                          </div>
                          {task.remarks && (
                            <div style={{ marginTop: '6px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontStyle: 'italic' }}>
                              💬 {task.remarks}
                            </div>
                          )}
                        </div>

                        {/* Right: Status + Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span className="badge" style={{ background: priorityStyle.bg, color: priorityStyle.color }}>
                              {task.priority}
                            </span>
                            <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                              {task.status}
                            </span>
                          </div>

                          {/* Quick status change */}
                          <select value={task.status}
                            onChange={e => updateTaskStatus(task, e.target.value)}
                            style={{ padding: '4px 8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => openEdit(task)}
                              style={{ padding: '4px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px' }}>
                              ✏️ Edit
                            </button>
                            {task.status !== 'Completed' && (
                              <button onClick={() => { setShowCarryForwardModal(task); setCfForm({ due_date: '', assigned_to: task.assigned_to }) }}
                                style={{ padding: '4px 10px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px' }}>
                                ↩️ Carry
                              </button>
                            )}
                            <button onClick={() => setShowDeleteConfirm(task)}
                              style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {/* Task Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingTask(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
              {editingTask ? '✏️ Edit Task' : '✅ New Task'}
            </h3>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date Assigned *</label>
            <input type='date' value={form.date_assigned} onChange={e => setForm({ ...form, date_assigned: e.target.value })} style={inputStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Assigned To *</label>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={inputStyle}>
              <option value=''>-- Select Staff / Admin --</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
            </select>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Item *</label>
            <input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })}
              placeholder='Task title / item...' style={inputStyle} />

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder='Detailed description...' rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Due Date *</label>
                <input type='date' value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Remarks</label>
            <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
              placeholder='Optional remarks...' style={inputStyle} />

            {/* Recurrence - only for new tasks */}
            {!editingTask && (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Recurrence</label>
                <select value={form.recurrence_type} onChange={e => setForm({ ...form, recurrence_type: e.target.value, repeat_days: [] })} style={inputStyle}>
                  {RECURRENCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {form.recurrence_type === 'Weekly' && (
                  <>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Select Days (Sunday excluded)</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      {WEEKDAYS.map(day => (
                        <button key={day} type='button'
                          onClick={() => {
                            const days = form.repeat_days.includes(day)
                              ? form.repeat_days.filter(d => d !== day)
                              : [...form.repeat_days, day]
                            setForm({ ...form, repeat_days: days })
                          }}
                          style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${form.repeat_days.includes(day) ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: form.repeat_days.includes(day) ? 'rgba(56,189,248,0.15)' : 'transparent', color: form.repeat_days.includes(day) ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer' }}>
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {form.recurrence_type === 'Daily' && (
                  <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    ℹ️ Task will repeat Monday to Saturday. Sundays are automatically skipped.
                  </div>
                )}

                {form.recurrence_type !== 'None' && (
                  <>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Repeat Until *</label>
                    <input type='date' value={form.repeat_until} onChange={e => setForm({ ...form, repeat_until: e.target.value })} style={inputStyle} />
                  </>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => { setShowForm(false); setEditingTask(null) }} className="btn-secondary">Cancel</button>
              <button onClick={saveTask} disabled={saving} className="btn-primary">
                {saving ? '⏳ Saving...' : editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carry Forward Modal */}
      {showCarryForwardModal && (
        <div className="modal-overlay" onClick={() => setShowCarryForwardModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>↩️ Carry Forward Task</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>
              {showCarryForwardModal.item}
            </p>
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              ℹ️ Original task will remain in history. A new task will be created.
            </div>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>New Due Date *</label>
            <input type='date' value={cfForm.due_date} onChange={e => setCfForm({ ...cfForm, due_date: e.target.value })} style={inputStyle} />
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Assigned To (change if needed)</label>
            <select value={cfForm.assigned_to} onChange={e => setCfForm({ ...cfForm, assigned_to: e.target.value })} style={inputStyle}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCarryForwardModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={carryForward}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #a78bfa, #c4b5fd)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                ↩️ Carry Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>🗑️ Delete Task</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>
              {showDeleteConfirm.item}
            </p>
            {showDeleteConfirm.recurrence_group_id ? (
              <>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '16px' }}>
                  This is a recurring task. What would you like to delete?
                </p>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <button onClick={() => deleteTask(showDeleteConfirm, false)}
                    style={{ padding: '10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', color: '#fbbf24', cursor: 'pointer', fontSize: '14px' }}>
                    Delete Only This Task
                  </button>
                  <button onClick={() => deleteTask(showDeleteConfirm, true)}
                    style={{ padding: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', cursor: 'pointer', fontSize: '14px' }}>
                    Delete This + All Future Tasks
                  </button>
                  <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '20px' }}>
                  Are you sure? This task will be soft deleted (history preserved).
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
                  <button onClick={() => deleteTask(showDeleteConfirm, false)} className="btn-danger">🗑️ Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Download Modal */}
      {showDownloadModal && (
        <div className="modal-overlay" onClick={() => setShowDownloadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>📥 Download Task Report</h3>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[['month', '📅 By Month'], ['range', '📆 Date Range']].map(([v, l]) => (
                <button key={v} onClick={() => setDownloadForm({ ...downloadForm, type: v })}
                  style={{ flex: 1, padding: '9px', borderRadius: '10px', border: `1px solid ${downloadForm.type === v ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: downloadForm.type === v ? 'rgba(56,189,248,0.15)' : 'transparent', color: downloadForm.type === v ? '#38bdf8' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Month or Range */}
            {downloadForm.type === 'month' ? (
              <>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Month</label>
                <input type='month' value={downloadForm.month}
                  onChange={e => setDownloadForm({ ...downloadForm, month: e.target.value })}
                  style={inputStyle} />
              </>
            ) : (
              <>
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '12px', color: '#fbbf24' }}>
                  ⚠️ Maximum date range is 6 months
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>From Date</label>
                    <input type='date' value={downloadForm.from_date}
                      onChange={e => setDownloadForm({ ...downloadForm, from_date: e.target.value })}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>To Date</label>
                    <input type='date' value={downloadForm.to_date}
                      onChange={e => setDownloadForm({ ...downloadForm, to_date: e.target.value })}
                      style={inputStyle} />
                  </div>
                </div>
              </>
            )}

            {/* Filters */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', marginBottom: '14px' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '10px' }}>
                Filters (optional)
              </div>

              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Assigned To</label>
              <select value={downloadForm.assigned_to}
                onChange={e => setDownloadForm({ ...downloadForm, assigned_to: e.target.value })}
                style={inputStyle}>
                <option value=''>All Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Status</label>
                  <select value={downloadForm.status}
                    onChange={e => setDownloadForm({ ...downloadForm, status: e.target.value })}
                    style={inputStyle}>
                    <option value=''>All Status</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Priority</label>
                  <select value={downloadForm.priority}
                    onChange={e => setDownloadForm({ ...downloadForm, priority: e.target.value })}
                    style={inputStyle}>
                    <option value=''>All Priority</option>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  ['overdue', '🚨 Overdue Only', downloadForm.overdue],
                  ['carried_forward', '↩️ Carried Forward Only', downloadForm.carried_forward],
                ].map(([key, label, val]) => (
                  <button key={key}
                    onClick={() => setDownloadForm({ ...downloadForm, [key]: !val })}
                    style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${val ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: val ? 'rgba(56,189,248,0.15)' : 'transparent', color: val ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    {label}
                  </button>
                ))}
                <select value={downloadForm.recurring}
                  onChange={e => setDownloadForm({ ...downloadForm, recurring: e.target.value })}
                  style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                  <option value=''>All Types</option>
                  <option value='recurring'>Recurring Only</option>
                  <option value='non-recurring'>Non-Recurring Only</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDownloadModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={downloadTasks}
                style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
                📥 Download CSV
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}