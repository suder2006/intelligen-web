'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const LEAD_STATUSES = ['new', 'contacted', 'visit_booked', 'visit_completed', 'enrolled', 'closed']
const CALL_OUTCOMES = ['not_reachable', 'interested', 'not_interested', 'visit_scheduled', 'wrong_number']

const statusColor = {
  new: { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8' },
  contacted: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  visit_booked: { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  visit_completed: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  enrolled: { bg: 'rgba(16,185,129,0.25)', color: '#10b981' },
  closed: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
}

export default function CenterHeadPortal() {
  const [profile, setProfile] = useState(null)
  const [enquiries, setEnquiries] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [selectedEnquiry, setSelectedEnquiry] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [enquiryNotes, setEnquiryNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const router = useRouter()

  const [followUpForm, setFollowUpForm] = useState({
    due_date: new Date().toISOString().split('T')[0],
    due_time: '10:00', task_type: 'call', comments: ''
  })

  const [callOutcomeForm, setCallOutcomeForm] = useState({
    outcome: '', comments: '', follow_up_date: '', follow_up_time: '10:00'
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const [enqRes, fuRes, visRes] = await Promise.all([
      supabase.from('enquiries').select('*').eq('school_id', prof.school_id).order('created_at', { ascending: false }),
      supabase.from('follow_ups').select('*, enquiries(parent_name, child_name, phone, program)').eq('school_id', prof.school_id).order('due_date').order('due_time'),
      supabase.from('visit_bookings').select('*, enquiries(parent_name, child_name, phone)').eq('school_id', prof.school_id).order('visit_date')
    ])
    setEnquiries(enqRes.data || [])
    setFollowUps(fuRes.data || [])
    setVisits(visRes.data || [])
    setLoading(false)
  }

  const fetchEnquiryNotes = async (enquiryId) => {
    const { data } = await supabase.from('enquiry_notes').select('*, profiles(full_name)').eq('enquiry_id', enquiryId).order('created_at', { ascending: false })
    setEnquiryNotes(data || [])
  }

  const updateStatus = async (id, status) => {
    await supabase.from('enquiries').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
    if (selectedEnquiry?.id === id) setSelectedEnquiry(prev => ({ ...prev, status }))
  }

  const addNote = async () => {
    if (!noteText.trim() || !selectedEnquiry) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('enquiry_notes').insert({
      school_id: profile.school_id, enquiry_id: selectedEnquiry.id,
      added_by: user.id, note: noteText
    })
    setNoteText('')
    fetchEnquiryNotes(selectedEnquiry.id)
  }

  const addFollowUp = async () => {
    if (!selectedEnquiry || !followUpForm.due_date) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('follow_ups').insert({
      school_id: profile.school_id, enquiry_id: selectedEnquiry.id,
      assigned_to: user.id, due_date: followUpForm.due_date,
      due_time: followUpForm.due_time, task_type: followUpForm.task_type,
      comments: followUpForm.comments, status: 'pending'
    })
    setFollowUpForm({ due_date: new Date().toISOString().split('T')[0], due_time: '10:00', task_type: 'call', comments: '' })
    await loadData()
  }

  const completeFollowUp = async (followUpId, outcome, comments) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('follow_ups').update({
      status: 'completed', call_outcome: outcome,
      comments: comments, completed_at: new Date().toISOString()
    }).eq('id', followUpId)
    // Log to history
    await supabase.from('follow_up_history').insert({
      school_id: profile.school_id,
      enquiry_id: selectedEnquiry?.id,
      follow_up_id: followUpId,
      action_by: user.id,
      comments: comments, outcome: outcome
    })
    // Update enquiry status based on outcome
    if (outcome === 'interested' || outcome === 'visit_scheduled') {
      await supabase.from('enquiries').update({ status: 'contacted' }).eq('id', selectedEnquiry?.id)
    }
    // Schedule next follow-up if needed
    if (callOutcomeForm.follow_up_date) {
      await supabase.from('follow_ups').insert({
        school_id: profile.school_id, enquiry_id: selectedEnquiry?.id,
        assigned_to: user.id, due_date: callOutcomeForm.follow_up_date,
        due_time: callOutcomeForm.follow_up_time, task_type: 'follow_up',
        status: 'pending'
      })
    }
    setCallOutcomeForm({ outcome: '', comments: '', follow_up_date: '', follow_up_time: '10:00' })
    await loadData()
  }

  const today = new Date().toISOString().split('T')[0]
  const todayFollowUps = followUps.filter(f => f.due_date === today && f.status === 'pending')
  const missedFollowUps = followUps.filter(f => f.status === 'pending' && new Date(`${f.due_date}T${f.due_time}`) < new Date())
  const todayVisits = visits.filter(v => v.visit_date === today && v.status === 'scheduled')
  const newEnquiries = enquiries.filter(e => e.status === 'new')

  const filteredEnquiries = enquiries.filter(e => {
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    const matchSearch = !search || e.parent_name?.toLowerCase().includes(search.toLowerCase()) || e.child_name?.toLowerCase().includes(search.toLowerCase()) || e.phone?.includes(search)
    return matchStatus && matchSearch
  })

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }

  const tabs = [
    { id: 'today', label: "Today's Tasks", icon: '📋' },
    { id: 'enquiries', label: 'All Enquiries', icon: '🎯' },
    { id: 'visits', label: 'Visits', icon: '🏫' },
    { id: 'missed', label: `Missed (${missedFollowUps.length})`, icon: '🚨' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .header { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; }
        .logo span { color: #38bdf8; }
        .tabs { display: flex; gap: 4px; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .tab { padding: 9px 18px; border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; white-space: nowrap; transition: all 0.2s; }
        .tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .content { padding: 24px; max-width: 900px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 12px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
        .task-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px; margin-bottom: 10px; }
        .task-card.missed { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); }
        .task-card.urgent { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
        @media (max-width: 600px) { .content { padding: 16px; } .tabs { padding: 12px 16px; } }
      `}</style>

      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo">Intelli<span>Gen</span></div>
          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>🎯 Center Head</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          🚪 Sign Out
        </button>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="content">
        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* TODAY'S TASKS */}
            {activeTab === 'today' && (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>👋 Good day, {profile?.full_name}!</h1>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: "Today's Calls", value: todayFollowUps.length, color: '#38bdf8', icon: '📞' },
                    { label: "Today's Visits", value: todayVisits.length, color: '#a78bfa', icon: '🏫' },
                    { label: 'New Enquiries', value: newEnquiries.length, color: '#10b981', icon: '🎯' },
                    { label: 'Missed Tasks', value: missedFollowUps.length, color: '#f87171', icon: '🚨' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: item.color }}>{item.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Missed alert */}
                {missedFollowUps.length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
                    <div style={{ color: '#f87171', fontWeight: '600', marginBottom: '4px' }}>🚨 {missedFollowUps.length} missed follow-up{missedFollowUps.length > 1 ? 's' : ''}!</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Please action these immediately to avoid escalation.</div>
                  </div>
                )}

                {/* Today's calls */}
                {todayFollowUps.length > 0 && (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '12px', color: '#38bdf8' }}>📞 Today's Calls ({todayFollowUps.length})</div>
                    {todayFollowUps.map(fu => (
                      <div key={fu.id} className="task-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{fu.enquiries?.parent_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{fu.enquiries?.child_name} · {fu.enquiries?.program || '—'}</div>
                            <div style={{ color: '#38bdf8', fontSize: '13px', marginBottom: '4px' }}>📞 {fu.enquiries?.phone}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>⏰ {fu.due_time} · {fu.task_type}</div>
                            {fu.comments && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>{fu.comments}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <a href={`tel:${fu.enquiries?.phone}`}
                              style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📞 Call</a>
                            <a href={`https://wa.me/${fu.enquiries?.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer'
                              style={{ padding: '7px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34d399', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>💬 WhatsApp</a>
                            <button onClick={() => {
                              const enq = enquiries.find(e => e.id === fu.enquiry_id)
                              setSelectedEnquiry(enq)
                              fetchEnquiryNotes(enq.id)
                              setShowDetailModal(true)
                            }}
                              style={{ padding: '7px 12px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: '#a78bfa', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600' }}>📝 Update</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Today's visits */}
                {todayVisits.length > 0 && (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '12px', marginTop: '20px', color: '#a78bfa' }}>🏫 Today's Visits ({todayVisits.length})</div>
                    {todayVisits.map(v => (
                      <div key={v.id} className="task-card urgent">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{v.enquiries?.parent_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{v.enquiries?.child_name}</div>
                            <div style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600' }}>⏰ {v.slot_time}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a href={`tel:${v.enquiries?.phone}`}
                              style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>📞 Call</a>
                            <select value={v.status} onChange={async e => {
                              await supabase.from('visit_bookings').update({ status: e.target.value }).eq('id', v.id)
                              if (e.target.value === 'completed') {
                                await supabase.from('enquiries').update({ status: 'visit_completed' }).eq('id', v.enquiry_id)
                              }
                              await loadData()
                            }}
                              style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                              {['scheduled', 'completed', 'no_show', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* New enquiries */}
                {newEnquiries.length > 0 && (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '12px', marginTop: '20px', color: '#10b981' }}>🎯 New Enquiries ({newEnquiries.length})</div>
                    {newEnquiries.slice(0, 5).map(e => (
                      <div key={e.id} className="task-card" style={{ cursor: 'pointer' }}
                        onClick={() => { setSelectedEnquiry(e); fetchEnquiryNotes(e.id); setShowDetailModal(true) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ fontWeight: '700' }}>{e.parent_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px' }}>{e.child_name} · {e.program || '—'}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{e.phone} · {new Date(e.created_at).toLocaleString()}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a href={`tel:${e.phone}`} onClick={ev => ev.stopPropagation()}
                              style={{ padding: '6px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞</a>
                            <a href={`https://wa.me/${e.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer' onClick={ev => ev.stopPropagation()}
                              style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', fontSize: '12px', textDecoration: 'none' }}>💬</a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {todayFollowUps.length === 0 && todayVisits.length === 0 && newEnquiries.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                    <div>No tasks for today! All caught up.</div>
                  </div>
                )}
              </>
            )}

            {/* ALL ENQUIRIES */}
            {activeTab === 'enquiries' && (
              <>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <input placeholder='Search name, phone...' value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: '180px', padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }} />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '9px 12px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '13px' }}>
                    <option value='all'>All Status</option>
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '9px 0' }}>{filteredEnquiries.length} leads</span>
                </div>

                {filteredEnquiries.map(e => {
                  const nextFU = followUps.filter(f => f.enquiry_id === e.id && f.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
                  const isMissed = nextFU && new Date(`${nextFU.due_date}T${nextFU.due_time}`) < new Date()
                  return (
                    <div key={e.id} className="card" style={{ cursor: 'pointer', borderColor: isMissed ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)' }}
                      onClick={() => { setSelectedEnquiry(e); fetchEnquiryNotes(e.id); setShowDetailModal(true) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '15px' }}>{e.parent_name}</span>
                            <span className="badge" style={{ background: statusColor[e.status]?.bg, color: statusColor[e.status]?.color }}>{e.status}</span>
                            {e.is_duplicate && <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '4px' }}>DUP</span>}
                          </div>
                          <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{e.child_name} · {e.program || '—'}</div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📞 {e.phone}</span>
                            {nextFU && <span style={{ color: isMissed ? '#f87171' : '#38bdf8', fontSize: '12px', fontWeight: isMissed ? '600' : '400' }}>
                              {isMissed ? '🚨' : '📅'} Next: {nextFU.due_date} {nextFU.due_time}
                            </span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }} onClick={ev => ev.stopPropagation()}>
                          <a href={`tel:${e.phone}`}
                            style={{ padding: '6px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞</a>
                          <a href={`https://wa.me/${e.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer'
                            style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', fontSize: '12px', textDecoration: 'none' }}>💬</a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* VISITS */}
            {activeTab === 'visits' && (
              <>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '16px' }}>🏫 All Scheduled Visits</div>
                {visits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>No visits scheduled.</div>
                ) : visits.map(v => (
                  <div key={v.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>{v.enquiries?.parent_name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{v.enquiries?.child_name}</div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ color: '#38bdf8', fontWeight: '600' }}>📅 {v.visit_date}</span>
                          <span style={{ color: '#f59e0b', fontWeight: '600' }}>⏰ {v.slot_time}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <a href={`tel:${v.enquiries?.phone}`}
                          style={{ padding: '6px 10px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞</a>
                        <select value={v.status} onChange={async e => {
                          await supabase.from('visit_bookings').update({ status: e.target.value }).eq('id', v.id)
                          if (e.target.value === 'completed') {
                            await supabase.from('enquiries').update({ status: 'visit_completed' }).eq('id', v.enquiry_id)
                          }
                          await loadData()
                        }}
                          style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                          {['scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* MISSED */}
            {activeTab === 'missed' && (
              <>
                {missedFollowUps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                    <div>No missed follow-ups!</div>
                  </div>
                ) : (
                  <>
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
                      <div style={{ color: '#f87171', fontWeight: '600' }}>🚨 {missedFollowUps.length} missed follow-up{missedFollowUps.length > 1 ? 's' : ''} — Action immediately!</div>
                    </div>
                    {missedFollowUps.map(fu => (
                      <div key={fu.id} className="task-card missed">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>{fu.enquiries?.parent_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '4px' }}>{fu.enquiries?.child_name}</div>
                            <div style={{ color: '#f87171', fontSize: '13px', fontWeight: '600' }}>Was due: {fu.due_date} {fu.due_time}</div>
                            <div style={{ color: '#38bdf8', fontSize: '13px' }}>📞 {fu.enquiries?.phone}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <a href={`tel:${fu.enquiries?.phone}`}
                              style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📞 Call Now</a>
                            <button onClick={() => {
                              const enq = enquiries.find(e => e.id === fu.enquiry_id)
                              setSelectedEnquiry(enq)
                              fetchEnquiryNotes(enq.id)
                              setShowDetailModal(true)
                            }}
                              style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600' }}>✅ Mark Done</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedEnquiry && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{selectedEnquiry.parent_name}</h3>
                <div style={{ color: '#a78bfa', fontSize: '14px' }}>{selectedEnquiry.child_name} · {selectedEnquiry.program || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a href={`tel:${selectedEnquiry.phone}`} style={{ padding: '7px 12px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📞 Call</a>
                <a href={`https://wa.me/${selectedEnquiry.phone?.replace(/\D/g, '')}`} target='_blank' rel='noreferrer' style={{ padding: '7px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34d399', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>💬 WhatsApp</a>
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Update Status</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {LEAD_STATUSES.map(status => (
                  <button key={status} onClick={() => updateStatus(selectedEnquiry.id, status)}
                    style={{ padding: '5px 10px', borderRadius: '20px', border: `1px solid ${selectedEnquiry.status === status ? statusColor[status]?.color : 'rgba(255,255,255,0.1)'}`, background: selectedEnquiry.status === status ? statusColor[status]?.bg : 'transparent', color: selectedEnquiry.status === status ? statusColor[status]?.color : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Call Outcome */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: '#38bdf8', marginBottom: '10px', fontSize: '14px' }}>📞 Log Call Outcome</div>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Call Outcome *</label>
              <select value={callOutcomeForm.outcome} onChange={e => setCallOutcomeForm({ ...callOutcomeForm, outcome: e.target.value })} style={inputStyle}>
                <option value=''>-- Select Outcome --</option>
                {CALL_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input value={callOutcomeForm.comments} onChange={e => setCallOutcomeForm({ ...callOutcomeForm, comments: e.target.value })}
                placeholder='Comments...' style={inputStyle} />
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Schedule Next Follow-up (optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type='date' value={callOutcomeForm.follow_up_date} onChange={e => setCallOutcomeForm({ ...callOutcomeForm, follow_up_date: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
                <input type='time' value={callOutcomeForm.follow_up_time} onChange={e => setCallOutcomeForm({ ...callOutcomeForm, follow_up_time: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <button onClick={() => {
                const pendingFU = followUps.filter(f => f.enquiry_id === selectedEnquiry.id && f.status === 'pending')[0]
                if (pendingFU) completeFollowUp(pendingFU.id, callOutcomeForm.outcome, callOutcomeForm.comments)
              }} disabled={!callOutcomeForm.outcome} className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                ✅ Save Call Outcome
              </button>
            </div>

            {/* Add Follow-up */}
            <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '600', color: '#a78bfa', marginBottom: '10px', fontSize: '14px' }}>📅 Add Follow-up Task</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input type='date' value={followUpForm.due_date} onChange={e => setFollowUpForm({ ...followUpForm, due_date: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
                <input type='time' value={followUpForm.due_time} onChange={e => setFollowUpForm({ ...followUpForm, due_time: e.target.value })} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <select value={followUpForm.task_type} onChange={e => setFollowUpForm({ ...followUpForm, task_type: e.target.value })} style={inputStyle}>
                <option value='call'>📞 Call Parent</option>
                <option value='confirm_visit'>🏫 Confirm Visit</option>
                <option value='follow_up'>🔄 Follow Up</option>
              </select>
              <input value={followUpForm.comments} onChange={e => setFollowUpForm({ ...followUpForm, comments: e.target.value })} placeholder='Comments...' style={inputStyle} />
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
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>📋 Follow-up Tasks</div>
                {followUps.filter(f => f.enquiry_id === selectedEnquiry.id).map(f => {
                  const isMissed = f.status === 'pending' && new Date(`${f.due_date}T${f.due_time}`) < new Date()
                  return (
                    <div key={f.id} style={{ background: isMissed ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMissed ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '8px', padding: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{f.task_type} · {f.due_date} {f.due_time}</div>
                        {f.comments && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{f.comments}</div>}
                        {f.call_outcome && <div style={{ color: '#a78bfa', fontSize: '12px' }}>Outcome: {f.call_outcome}</div>}
                        {isMissed && <div style={{ color: '#f87171', fontSize: '11px' }}>🚨 Missed!</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: f.status === 'completed' ? 'rgba(16,185,129,0.15)' : isMissed ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: f.status === 'completed' ? '#34d399' : isMissed ? '#f87171' : '#fbbf24' }}>{f.status}</span>
                        {f.status === 'pending' && (
                          <button onClick={() => completeFollowUp(f.id, 'not_reachable', '')}
                            style={{ padding: '3px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', color: '#34d399', cursor: 'pointer', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>✅ Done</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDetailModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}