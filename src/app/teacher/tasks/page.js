'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const STATUSES = ['Not Started', 'In Progress', 'Completed']

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

export default function StaffTasksPage() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(null) // task id being saved
  const [editingRemarks, setEditingRemarks] = useState(null) // task id
  const [remarkText, setRemarkText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [showOverdue, setShowOverdue] = useState(false)
  const [view, setView] = useState('pending') // pending | completed | all
  const router = useRouter()

  const today = new Date()
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase.from('profiles')
      .select('*').eq('id', user.id).single()
    setProfile(prof)

    await fetchTasks(user.id)
    setLoading(false)
  }

  const fetchTasks = async (userId) => {
    const { data: { user } } = await supabase.auth.getUser()
    const uid = userId || user.id
    const { data } = await supabase.from('tasks')
      .select('*, assigned_by_profile:assigned_by(full_name)')
      .eq('assigned_to', uid)
      .eq('is_deleted', false)
      .order('due_date')
    setTasks(data || [])
  }

  const isOverdue = (task) => {
    if (task.status === 'Completed') return false
    if (!task.due_date) return false
    return new Date(task.due_date + 'T12:00:00') < new Date(today.toDateString())
  }

  const getMonthTasks = () => {
    const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
    return tasks.filter(t =>
      t.date_assigned?.startsWith(monthStr) ||
      t.due_date?.startsWith(monthStr)
    )
  }

  const getFilteredTasks = () => {
    let filtered = getMonthTasks()

    if (view === 'pending') filtered = filtered.filter(t => t.status !== 'Completed')
    if (view === 'completed') filtered = filtered.filter(t => t.status === 'Completed')

    if (filterStatus) filtered = filtered.filter(t => t.status === filterStatus)
    if (filterPriority) filtered = filtered.filter(t => t.priority === filterPriority)
    if (showOverdue) filtered = filtered.filter(t => isOverdue(t))

    return filtered
  }

  const updateStatus = async (task, newStatus) => {
    setSaving(task.id)
    const updateData = {
      status: newStatus,
      date_completed: newStatus === 'Completed'
        ? today.toISOString().split('T')[0]
        : null,
      updated_at: new Date().toISOString()
    }
    await supabase.from('tasks').update(updateData).eq('id', task.id)
    await fetchTasks()
    setSaving(null)
  }

  const saveRemarks = async (task) => {
    setSaving(task.id)
    await supabase.from('tasks').update({
      remarks: remarkText,
      updated_at: new Date().toISOString()
    }).eq('id', task.id)
    setEditingRemarks(null)
    setRemarkText('')
    await fetchTasks()
    setSaving(null)
  }

  const filteredTasks = getFilteredTasks()
  const monthTasks = getMonthTasks()

  // Stats
  const stats = {
    total: monthTasks.length,
    notStarted: monthTasks.filter(t => t.status === 'Not Started').length,
    inProgress: monthTasks.filter(t => t.status === 'In Progress').length,
    completed: monthTasks.filter(t => t.status === 'Completed').length,
    overdue: monthTasks.filter(t => isOverdue(t)).length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .view-tab { padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .task-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 16px; margin-bottom: 10px; transition: background 0.15s; }
        .task-card:hover { background: rgba(255,255,255,0.06); }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 600px) { .content { padding: 16px !important; } }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px' }}>
            Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
          </div>
          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>
            ✅ My Tasks
          </span>
        </div>
        <button onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          ← Back
        </button>
      </div>

      <div className="content" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Welcome */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>👋 My Tasks</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
            Tasks assigned to you — update status and add remarks
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
              {[
                { label: 'Total', value: stats.total, color: '#38bdf8' },
                { label: 'Not Started', value: stats.notStarted, color: '#94a3b8' },
                { label: 'In Progress', value: stats.inProgress, color: '#38bdf8' },
                { label: 'Completed', value: stats.completed, color: '#10b981' },
                { label: 'Overdue', value: stats.overdue, color: '#ef4444' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: item.color }}>{item.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Month Navigator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                  else setViewMonth(m => m - 1)
                }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', color: '#fff', cursor: 'pointer' }}>← Prev</button>
                <div style={{ fontSize: '16px', fontWeight: '700', minWidth: '150px', textAlign: 'center' }}>
                  {MONTHS[viewMonth]} {viewYear}
                </div>
                <button onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
                  else setViewMonth(m => m + 1)
                }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 12px', color: '#fff', cursor: 'pointer' }}>Next →</button>
                <button onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()) }}
                  style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', padding: '7px 12px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px' }}>
                  Today
                </button>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* View Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
              {[['pending', '⏳ Pending'], ['completed', '✅ Completed'], ['all', '📋 All']].map(([v, l]) => (
                <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterStatus ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                <option value=''>📊 All Status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: filterPriority ? '#38bdf8' : 'rgba(255,255,255,0.5)', fontSize: '12px', outline: 'none' }}>
                <option value=''>🎯 All Priority</option>
                {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <button onClick={() => setShowOverdue(!showOverdue)}
                style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${showOverdue ? '#f87171' : 'rgba(255,255,255,0.1)'}`, background: showOverdue ? 'rgba(239,68,68,0.15)' : 'transparent', color: showOverdue ? '#f87171' : 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer' }}>
                🚨 Overdue
              </button>

              {(filterStatus || filterPriority || showOverdue) && (
                <button onClick={() => { setFilterStatus(''); setFilterPriority(''); setShowOverdue(false) }}
                  style={{ padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Task List */}
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                  {view === 'completed' ? '🎉' : '✅'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                  {view === 'completed' ? 'No completed tasks yet' : 'No pending tasks!'}
                </div>
                <div style={{ fontSize: '14px' }}>
                  {view === 'completed' ? 'Complete tasks to see them here.' : 'You\'re all caught up! 🎉'}
                </div>
              </div>
            ) : filteredTasks.map(task => {
              const overdue = isOverdue(task)
              const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['Not Started']
              const priorityStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS['Medium']
              const isEditingThis = editingRemarks === task.id
              const isSavingThis = saving === task.id

              return (
                <div key={task.id} className="task-card"
                  style={{ borderColor: overdue ? 'rgba(239,68,68,0.25)' : task.status === 'Completed' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)' }}>

                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      {/* Title + badges */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>{task.item}</span>
                        {overdue && (
                          <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                            🚨 Overdue
                          </span>
                        )}
                        {task.is_carried_forward && (
                          <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                            ↩️ Carried Forward
                          </span>
                        )}
                        {task.recurrence_type !== 'None' && (
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>
                            🔄 {task.recurrence_type}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {task.description && (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '6px', lineHeight: '1.5' }}>
                          {task.description}
                        </div>
                      )}

                      {/* Meta info */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                        <span>📅 Assigned: {task.date_assigned}</span>
                        <span style={{ color: overdue ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                          🗓️ Due: {task.due_date}
                        </span>
                        {task.date_completed && (
                          <span style={{ color: '#34d399' }}>✅ Completed: {task.date_completed}</span>
                        )}
                        <span>👤 By: {task.assigned_by_profile?.full_name || 'Admin'}</span>
                      </div>
                    </div>

                    {/* Right: badges + status */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="badge" style={{ background: priorityStyle.bg, color: priorityStyle.color }}>
                          {task.priority}
                        </span>
                        <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {task.status}
                        </span>
                      </div>

                      {/* Status dropdown */}
                      {task.status !== 'Completed' && (
                        <select value={task.status}
                          onChange={e => updateStatus(task, e.target.value)}
                          disabled={isSavingThis}
                          style={{ padding: '5px 10px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}

                      {/* Mark Complete button */}
                      {task.status !== 'Completed' && (
                        <button onClick={() => updateStatus(task, 'Completed')}
                          disabled={isSavingThis}
                          style={{ padding: '5px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                          {isSavingThis ? '⏳...' : '✅ Mark Complete'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remarks section */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    {isEditingThis ? (
                      <div>
                        <textarea
                          value={remarkText}
                          onChange={e => setRemarkText(e.target.value)}
                          placeholder='Add your remarks here...'
                          rows={3}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => { setEditingRemarks(null); setRemarkText('') }}
                            className="btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
                            Cancel
                          </button>
                          <button onClick={() => saveRemarks(task)}
                            disabled={isSavingThis}
                            style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                            {isSavingThis ? '⏳ Saving...' : '💾 Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          {task.remarks ? (
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontStyle: 'italic' }}>
                              💬 {task.remarks}
                            </div>
                          ) : (
                            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
                              No remarks added
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => { setEditingRemarks(task.id); setRemarkText(task.remarks || '') }}
                          style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                          ✏️ {task.remarks ? 'Edit' : 'Add'} Remarks
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}