'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const CATEGORIES = {
  transport: { label: 'Transport', emoji: '🚌' },
  teacher: { label: 'Teacher', emoji: '👩‍🏫' },
  fees: { label: 'Fees', emoji: '💰' },
  nutrition: { label: 'Nutrition', emoji: '🍱' },
  curriculum: { label: 'Curriculum', emoji: '📚' },
  facility: { label: 'Facility', emoji: '🏫' },
  appreciation: { label: 'Appreciation', emoji: '⭐' },
  other: { label: 'Other', emoji: '💬' },
}

const PRIORITIES = {
  urgent: { label: 'Urgent', color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' },
  normal: { label: 'Normal', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)' },
  suggestion: { label: 'Suggestion', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.3)' },
}

const STATUSES = {
  open: { label: 'Open', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  in_progress: { label: 'In Progress', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)' },
  resolved: { label: 'Resolved', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
}

export default function AdminFeedbackPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [feedbacks, setFeedbacks] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (schoolId) fetchFeedbacks() }, [schoolId])

  const fetchFeedbacks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    setFeedbacks(data || [])
    setLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('feedback').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    if (selectedFeedback?.id === id) setSelectedFeedback(prev => ({ ...prev, status }))
  }

  const submitReply = async () => {
    if (!reply.trim()) { alert('Please write a reply!'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('feedback').update({
        admin_reply: reply.trim(),
        replied_by: user.id,
        replied_at: new Date().toISOString(),
        status: 'resolved',
        updated_at: new Date().toISOString()
      }).eq('id', selectedFeedback.id)

      setFeedbacks(prev => prev.map(f => f.id === selectedFeedback.id ? {
        ...f, admin_reply: reply.trim(), status: 'resolved',
        replied_at: new Date().toISOString()
      } : f))
      setSelectedFeedback(prev => ({
        ...prev, admin_reply: reply.trim(),
        status: 'resolved', replied_at: new Date().toISOString()
      }))
      setReply('')
      alert('✅ Reply sent! Feedback marked as resolved.')
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  const filtered = feedbacks.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false
    if (filterCategory !== 'all' && f.category !== filterCategory) return false
    if (filterPriority !== 'all' && f.priority !== filterPriority) return false
    return true
  })

  const stats = {
    total: feedbacks.length,
    urgent: feedbacks.filter(f => f.priority === 'urgent' && f.status !== 'resolved').length,
    open: feedbacks.filter(f => f.status === 'open').length,
    in_progress: feedbacks.filter(f => f.status === 'in_progress').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    padding: '10px 14px', color: '#fff', fontSize: '13px',
    outline: 'none', fontFamily: "'DM Sans', sans-serif"
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; }
        .btn { border: none; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>💬 Parent Feedback</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
            View and respond to parent feedback
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total', value: stats.total, color: '#fff' },
            { label: 'Urgent', value: stats.urgent, color: '#f87171' },
            { label: 'Open', value: stats.open, color: '#fbbf24' },
            { label: 'In Progress', value: stats.in_progress, color: '#38bdf8' },
            { label: 'Resolved', value: stats.resolved, color: '#34d399' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedFeedback ? '1fr 1fr' : '1fr', gap: '20px' }}>

          {/* Feedback list */}
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value='all'>All Status</option>
                <option value='open'>Open</option>
                <option value='in_progress'>In Progress</option>
                <option value='resolved'>Resolved</option>
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value='all'>All Categories</option>
                {Object.entries(CATEGORIES).map(([id, cat]) => (
                  <option key={id} value={id}>{cat.emoji} {cat.label}</option>
                ))}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                <option value='all'>All Priorities</option>
                <option value='urgent'>🔴 Urgent</option>
                <option value='normal'>🟡 Normal</option>
                <option value='suggestion'>🟢 Suggestion</option>
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                <div>No feedback found</div>
              </div>
            ) : filtered.map(fb => {
              const cat = CATEGORIES[fb.category] || CATEGORIES.other
              const pri = PRIORITIES[fb.priority] || PRIORITIES.normal
              const status = STATUSES[fb.status] || STATUSES.open
              const isSelected = selectedFeedback?.id === fb.id

              return (
                <div key={fb.id}
                  onClick={() => { setSelectedFeedback(fb); setReply(fb.admin_reply || '') }}
                  style={{
                    background: isSelected ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSelected ? 'rgba(56,189,248,0.3)' : fb.priority === 'urgent' && fb.status !== 'resolved' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '14px', padding: '14px', marginBottom: '8px', cursor: 'pointer'
                  }}>

                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>
                        {fb.parent_name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{fb.parent_name || 'Parent'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                          {fb.student_name} · {new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: pri.bg, color: pri.color, border: `1px solid ${pri.border}`, padding: '2px 8px', borderRadius: '20px' }}>
                        {pri.label}
                      </span>
                      <span style={{ fontSize: '11px', background: status.bg, color: status.color, padding: '2px 8px', borderRadius: '20px' }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Category */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px' }}>{cat.emoji}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{cat.label}</span>
                  </div>

                  {/* Message */}
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6' }}>
                    {fb.message.length > 100 ? fb.message.substring(0, 100) + '...' : fb.message}
                  </div>

                  {/* Reply indicator */}
                  {fb.admin_reply && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#34d399' }}>
                      ✅ Replied
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Feedback detail */}
          {selectedFeedback && (() => {
            const cat = CATEGORIES[selectedFeedback.category] || CATEGORIES.other
            const pri = PRIORITIES[selectedFeedback.priority] || PRIORITIES.normal
            const status = STATUSES[selectedFeedback.status] || STATUSES.open

            return (
              <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '20px' }}>
                {/* Close button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontWeight: '700', fontSize: '16px' }}>Feedback Details</span>
                  <button className="btn" onClick={() => setSelectedFeedback(null)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px' }}>
                    ✕ Close
                  </button>
                </div>

                {/* Parent info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', color: '#38bdf8' }}>
                    {selectedFeedback.parent_name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{selectedFeedback.parent_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{selectedFeedback.student_name}</div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '20px' }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{ fontSize: '13px', background: pri.bg, color: pri.color, border: `1px solid ${pri.border}`, padding: '4px 12px', borderRadius: '20px' }}>
                    {pri.label}
                  </span>
                  <span style={{ fontSize: '13px', background: status.bg, color: status.color, padding: '4px 12px', borderRadius: '20px' }}>
                    {status.label}
                  </span>
                </div>

                {/* Date */}
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '12px' }}>
                  📅 {new Date(selectedFeedback.created_at).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </div>

                {/* Message */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>MESSAGE:</div>
                  <div style={{ color: '#fff', fontSize: '14px', lineHeight: '1.7' }}>{selectedFeedback.message}</div>
                </div>

                {/* Status actions */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>UPDATE STATUS:</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Object.entries(STATUSES).map(([id, s]) => (
                      <button key={id} className="btn"
                        onClick={() => updateStatus(selectedFeedback.id, id)}
                        style={{
                          flex: 1, background: selectedFeedback.status === id ? s.bg : 'rgba(255,255,255,0.04)',
                          color: selectedFeedback.status === id ? s.color : 'rgba(255,255,255,0.4)',
                          border: `1px solid ${selectedFeedback.status === id ? s.color : 'rgba(255,255,255,0.1)'}`,
                          fontSize: '12px', padding: '7px'
                        }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Previous reply */}
                {selectedFeedback.admin_reply && (
                  <div style={{ background: 'rgba(52,211,153,0.08)', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div style={{ color: '#34d399', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>✅ Your Previous Reply:</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6' }}>{selectedFeedback.admin_reply}</div>
                  </div>
                )}

                {/* Reply box */}
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                    {selectedFeedback.admin_reply ? 'UPDATE REPLY:' : 'REPLY TO PARENT:'}
                  </div>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Write your response to parent..."
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }}
                  />
                  <button className="btn"
                    onClick={submitReply}
                    disabled={saving}
                    style={{ width: '100%', background: '#38bdf8', color: '#0f172a', padding: '12px', fontSize: '14px' }}>
                    {saving ? '⏳ Sending...' : '📤 Send Reply & Mark Resolved'}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}