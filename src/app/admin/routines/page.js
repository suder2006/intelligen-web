'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'

const ROUTINE_TYPES = [
  { id: 'morning', label: 'Morning Routine', emoji: '🌅' },
  { id: 'evening', label: 'Evening Routine', emoji: '🌙' },
  { id: 'mealtime', label: 'Mealtime Routine', emoji: '🍽️' },
  { id: 'bath', label: 'Bath Time Routine', emoji: '🛁' },
  { id: 'school_prep', label: 'School Preparation', emoji: '🏫' },
  { id: 'custom', label: 'Custom Routine', emoji: '⭐' },
]

const DEFAULT_STEPS = {
  morning: [
    { title: 'Wake Up', emoji: '🌞', order_index: 1 },
    { title: 'Wash Face', emoji: '🚿', order_index: 2 },
    { title: 'Brush Teeth', emoji: '🪥', order_index: 3 },
    { title: 'Bath Time', emoji: '🛁', order_index: 4 },
    { title: 'Get Dressed', emoji: '👕', order_index: 5 },
    { title: 'Prayer', emoji: '🙏', order_index: 6 },
    { title: 'Breakfast', emoji: '🍳', order_index: 7 },
    { title: 'Drink Water', emoji: '💧', order_index: 8 },
    { title: 'Pack School Bag', emoji: '🎒', order_index: 9 },
    { title: 'Wear Shoes', emoji: '👟', order_index: 10 },
    { title: 'Go to School', emoji: '🚌', order_index: 11 },
  ],
  evening: [
    { title: 'Reach Home', emoji: '🏠', order_index: 1 },
    { title: 'Remove Shoes', emoji: '👟', order_index: 2 },
    { title: 'Freshen Up', emoji: '🚿', order_index: 3 },
    { title: 'Change Clothes', emoji: '👕', order_index: 4 },
    { title: 'Evening Snack', emoji: '🍎', order_index: 5 },
    { title: 'Play Time', emoji: '🏃', order_index: 6 },
    { title: 'Homework / Activity', emoji: '📚', order_index: 7 },
    { title: 'Dinner', emoji: '🍽️', order_index: 8 },
    { title: 'Drink Milk / Water', emoji: '💧', order_index: 9 },
    { title: 'Brush Teeth', emoji: '🪥', order_index: 10 },
    { title: 'Change to Pyjamas', emoji: '🌙', order_index: 11 },
    { title: 'Story Time', emoji: '📖', order_index: 12 },
    { title: 'Prayer', emoji: '🙏', order_index: 13 },
    { title: 'Sleep Time', emoji: '😴', order_index: 14 },
  ],
  mealtime: [
    { title: 'Wash Hands', emoji: '🧼', order_index: 1 },
    { title: 'Sit at Table', emoji: '🪑', order_index: 2 },
    { title: 'Say Thanks / Prayer', emoji: '🙏', order_index: 3 },
    { title: 'Eat Food', emoji: '🍽️', order_index: 4 },
    { title: 'Drink Water', emoji: '💧', order_index: 5 },
    { title: 'Wash Hands Again', emoji: '🧼', order_index: 6 },
    { title: 'Rinse Mouth', emoji: '🪥', order_index: 7 },
  ],
  bath: [
    { title: 'Remove Clothes', emoji: '👕', order_index: 1 },
    { title: 'Wet Body', emoji: '🚿', order_index: 2 },
    { title: 'Apply Soap / Shampoo', emoji: '🧴', order_index: 3 },
    { title: 'Rinse Well', emoji: '🚿', order_index: 4 },
    { title: 'Dry with Towel', emoji: '🧸', order_index: 5 },
    { title: 'Wear Clothes', emoji: '👕', order_index: 6 },
    { title: 'Comb Hair', emoji: '💆', order_index: 7 },
  ],
  school_prep: [
    { title: 'Pack Books', emoji: '📚', order_index: 1 },
    { title: 'Pack Notebook', emoji: '📓', order_index: 2 },
    { title: 'Pack Pencil Box', emoji: '✏️', order_index: 3 },
    { title: 'Pack Lunch Box', emoji: '🍱', order_index: 4 },
    { title: 'Pack Water Bottle', emoji: '💧', order_index: 5 },
    { title: 'Close School Bag', emoji: '🎒', order_index: 6 },
    { title: 'Wear Shoes', emoji: '👟', order_index: 7 },
    { title: 'Say Bye to Family', emoji: '😊', order_index: 8 },
  ],
  custom: [],
}

export default function AdminRoutinesPage() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [routines, setRoutines] = useState([])
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [steps, setSteps] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(null)
  const [newRoutine, setNewRoutine] = useState({ name: '', type: 'morning', emoji: '🌅', description: '' })
  const [newStep, setNewStep] = useState({ title: '', emoji: '', youtube_url: '', duration_minutes: '' })
  const [editingStep, setEditingStep] = useState(null)

  useEffect(() => { if (schoolId) fetchRoutines() }, [schoolId])

  const fetchRoutines = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('routine_templates')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at')
    setRoutines(data || [])
    setLoading(false)
  }

  const fetchSteps = async (routineId) => {
    const { data } = await supabase
      .from('routine_template_steps')
      .select('*')
      .eq('routine_id', routineId)
      .order('order_index')
    setSteps(data || [])
  }

  const createRoutine = async () => {
    if (!newRoutine.name) { alert('Please enter routine name'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: routine, error } = await supabase
        .from('routine_templates')
        .insert({
          school_id: schoolId,
          name: newRoutine.name,
          type: newRoutine.type,
          emoji: newRoutine.emoji,
          description: newRoutine.description,
          created_by: user.id,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error

      // Insert default steps for this type
      const defaultSteps = DEFAULT_STEPS[newRoutine.type] || []
      if (defaultSteps.length > 0) {
        await supabase.from('routine_template_steps').insert(
          defaultSteps.map(s => ({ ...s, routine_id: routine.id }))
        )
      }

      setShowCreateModal(false)
      setNewRoutine({ name: '', type: 'morning', emoji: '🌅', description: '' })
      await fetchRoutines()
      setSelectedRoutine(routine)
      await fetchSteps(routine.id)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSaving(false)
  }

  const addStep = async () => {
    if (!newStep.title) { alert('Please enter step title'); return }
    setSaving(true)
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order_index)) : 0
    const { error } = await supabase.from('routine_template_steps').insert({
      routine_id: selectedRoutine.id,
      title: newStep.title,
      emoji: newStep.emoji || '⭐',
      youtube_url: newStep.youtube_url || null,
      duration_minutes: newStep.duration_minutes ? parseInt(newStep.duration_minutes) : null,
      order_index: maxOrder + 1
    })
    if (!error) {
      setNewStep({ title: '', emoji: '', youtube_url: '', duration_minutes: '' })
      setShowAddStep(false)
      await fetchSteps(selectedRoutine.id)
    }
    setSaving(false)
  }

  const updateStep = async (stepId, updates) => {
    await supabase.from('routine_template_steps').update(updates).eq('id', stepId)
    await fetchSteps(selectedRoutine.id)
    setEditingStep(null)
  }

  const deleteStep = async (stepId) => {
    if (!confirm('Delete this step?')) return
    await supabase.from('routine_template_steps').delete().eq('id', stepId)
    await fetchSteps(selectedRoutine.id)
  }

  const uploadStepImage = async (stepId, file) => {
    setUploadingImage(stepId)
    try {
      const ext = file.name.split('.').pop()
      const path = `${schoolId}/${stepId}.${ext}`

      // Compress image
      const compressed = await compressImage(file)

      const { error } = await supabase.storage
        .from('routine-images')
        .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })

      if (error) throw error

      const { data } = supabase.storage.from('routine-images').getPublicUrl(path)
      await updateStep(stepId, { image_url: data.publicUrl })
    } catch (e) {
      alert('Upload error: ' + e.message)
    }
    setUploadingImage(null)
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new window.Image()
      img.onload = () => {
        const MAX = 400
        let { width, height } = img
        if (width > height) {
          if (width > MAX) { height = (height * MAX) / width; width = MAX }
        } else {
          if (height > MAX) { width = (width * MAX) / height; height = MAX }
        }
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const moveStep = async (stepId, direction) => {
    const idx = steps.findIndex(s => s.id === stepId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === steps.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = steps[idx]
    const swap = steps[swapIdx]

    await supabase.from('routine_template_steps').update({ order_index: swap.order_index }).eq('id', current.id)
    await supabase.from('routine_template_steps').update({ order_index: current.order_index }).eq('id', swap.id)
    await fetchSteps(selectedRoutine.id)
  }

  const toggleRoutineActive = async (routine) => {
    await supabase.from('routine_templates').update({ is_active: !routine.is_active }).eq('id', routine.id)
    await fetchRoutines()
    if (selectedRoutine?.id === routine.id) {
      setSelectedRoutine(prev => ({ ...prev, is_active: !prev.is_active }))
    }
  }

  const deleteRoutine = async (routine) => {
    if (!confirm(`Delete "${routine.name}"? This cannot be undone.`)) return
    await supabase.from('routine_templates').delete().eq('id', routine.id)
    setSelectedRoutine(null)
    setSteps([])
    await fetchRoutines()
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: '10px'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .btn-primary { background: linear-gradient(135deg, #a78bfa, #8b5cf6); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 6px 12px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🔄 Routine Builder</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>
              Create visual daily routines for children · With photos and YouTube links
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            ➕ Create Routine
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>

            {/* Routine list */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px' }}>
                Routines ({routines.length})
              </div>
              {routines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔄</div>
                  <div style={{ fontSize: '13px' }}>No routines yet</div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>Click "Create Routine" to start</div>
                </div>
              ) : routines.map(r => (
                <div key={r.id}
                  onClick={() => { setSelectedRoutine(r); fetchSteps(r.id) }}
                  style={{
                    padding: '12px 14px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
                    background: selectedRoutine?.id === r.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedRoutine?.id === r.id ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    opacity: r.is_active ? 1 : 0.5
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: selectedRoutine?.id === r.id ? '#a78bfa' : '#fff', fontWeight: '600', fontSize: '13px' }}>
                        {r.name}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
                        {ROUTINE_TYPES.find(t => t.id === r.type)?.label || r.type}
                        {!r.is_active && ' · Inactive'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Routine details */}
            {selectedRoutine ? (
              <div>
                {/* Routine header */}
                <div className="card" style={{ borderColor: 'rgba(167,139,250,0.2)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '36px' }}>{selectedRoutine.emoji}</span>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>{selectedRoutine.name}</div>
                        <div style={{ color: '#a78bfa', fontSize: '13px' }}>
                          {ROUTINE_TYPES.find(t => t.id === selectedRoutine.type)?.label}
                        </div>
                        {selectedRoutine.description && (
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px' }}>
                            {selectedRoutine.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => toggleRoutineActive(selectedRoutine)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: selectedRoutine.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                          color: selectedRoutine.is_active ? '#34d399' : 'rgba(255,255,255,0.5)',
                          fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif"
                        }}>
                        {selectedRoutine.is_active ? '✅ Active' : '⏸️ Inactive'}
                      </button>
                      <button className="btn-danger" onClick={() => deleteRoutine(selectedRoutine)}>🗑️ Delete</button>
                    </div>
                  </div>
                </div>

                {/* Steps header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: '14px' }}>
                    Steps ({steps.length})
                  </div>
                  <button onClick={() => setShowAddStep(true)} className="btn-secondary" style={{ fontSize: '13px', padding: '7px 14px' }}>
                    ➕ Add Step
                  </button>
                </div>

                {/* Steps list */}
                {steps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                    No steps yet. Click "Add Step" to begin!
                  </div>
                ) : steps.map((step, idx) => (
                  <div key={step.id} className="card" style={{ borderColor: 'rgba(167,139,250,0.1)' }}>
                    {editingStep === step.id ? (
                      // Edit mode
                      <div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                          <input
                            placeholder="Emoji"
                            defaultValue={step.emoji}
                            id={`emoji-${step.id}`}
                            style={{ ...inputStyle, width: '80px', marginBottom: 0 }}
                          />
                          <input
                            placeholder="Step title"
                            defaultValue={step.title}
                            id={`title-${step.id}`}
                            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                          />
                        </div>
                        <input
                          placeholder="YouTube URL (optional)"
                          defaultValue={step.youtube_url || ''}
                          id={`youtube-${step.id}`}
                          style={inputStyle}
                        />
                        <input
                          placeholder="Duration in minutes (optional)"
                          defaultValue={step.duration_minutes || ''}
                          id={`duration-${step.id}`}
                          type="number"
                          style={inputStyle}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}
                            onClick={() => updateStep(step.id, {
                              emoji: document.getElementById(`emoji-${step.id}`).value,
                              title: document.getElementById(`title-${step.id}`).value,
                              youtube_url: document.getElementById(`youtube-${step.id}`).value || null,
                              duration_minutes: document.getElementById(`duration-${step.id}`).value ? parseInt(document.getElementById(`duration-${step.id}`).value) : null
                            })}>
                            ✅ Save
                          </button>
                          <button className="btn-secondary" style={{ fontSize: '12px', padding: '7px 14px' }}
                            onClick={() => setEditingStep(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                        {/* Step number */}
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#a78bfa', fontWeight: '700', fontSize: '12px' }}>{idx + 1}</span>
                        </div>

                        {/* Image */}
                        <div style={{ flexShrink: 0 }}>
                          {step.image_url ? (
                            <img src={step.image_url} style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                              {step.emoji}
                            </div>
                          )}
                          <label style={{ display: 'block', marginTop: '4px', cursor: 'pointer' }}>
                            <div style={{ fontSize: '10px', color: '#a78bfa', textAlign: 'center', fontWeight: '600' }}>
                              {uploadingImage === step.id ? '⏳' : '📷 Photo'}
                            </div>
                            <input type='file' accept='image/*' style={{ display: 'none' }}
                              onChange={e => e.target.files[0] && uploadStepImage(step.id, e.target.files[0])} />
                          </label>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '18px' }}>{step.emoji}</span>
                            <span style={{ color: '#fff', fontWeight: '600', fontSize: '15px' }}>{step.title}</span>
                            {step.duration_minutes && (
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>· {step.duration_minutes} min</span>
                            )}
                          </div>
                          {step.youtube_url && (
                            <a href={step.youtube_url} target="_blank" rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171', fontSize: '12px', textDecoration: 'none', background: 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: '20px' }}>
                              ▶️ YouTube Video
                            </a>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>
                            ↑
                          </button>
                          <button onClick={() => moveStep(step.id, 'down')} disabled={idx === steps.length - 1}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>
                            ↓
                          </button>
                          <button onClick={() => setEditingStep(step.id)}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>
                            ✏️
                          </button>
                          <button onClick={() => deleteStep(step.id)} className="btn-danger" style={{ width: '28px', height: '28px', padding: 0, fontSize: '12px' }}>
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add step inline */}
                {showAddStep && (
                  <div className="card" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
                    <div style={{ color: '#a78bfa', fontWeight: '700', fontSize: '14px', marginBottom: '12px' }}>➕ New Step</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input placeholder="Emoji" value={newStep.emoji} onChange={e => setNewStep({ ...newStep, emoji: e.target.value })}
                        style={{ ...inputStyle, width: '80px' }} />
                      <input placeholder="Step title *" value={newStep.title} onChange={e => setNewStep({ ...newStep, title: e.target.value })}
                        style={{ ...inputStyle, flex: 1 }} />
                    </div>
                    <input placeholder="YouTube URL (optional)" value={newStep.youtube_url} onChange={e => setNewStep({ ...newStep, youtube_url: e.target.value })}
                      style={inputStyle} />
                    <input placeholder="Duration in minutes (optional)" value={newStep.duration_minutes} onChange={e => setNewStep({ ...newStep, duration_minutes: e.target.value })}
                      type="number" style={inputStyle} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={addStep} disabled={saving} className="btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                        {saving ? '⏳' : '✅ Add Step'}
                      </button>
                      <button onClick={() => { setShowAddStep(false); setNewStep({ title: '', emoji: '', youtube_url: '', duration_minutes: '' }) }}
                        className="btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔄</div>
                <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px' }}>Select a routine</div>
                <div style={{ fontSize: '13px' }}>Choose from the left or create a new routine</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Routine Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '20px' }}>🔄 Create Routine</div>

            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Routine Type</label>
            <select value={newRoutine.type}
              onChange={e => {
                const type = ROUTINE_TYPES.find(t => t.id === e.target.value)
                setNewRoutine({ ...newRoutine, type: e.target.value, emoji: type?.emoji || '⭐' })
              }}
              style={inputStyle}>
              {ROUTINE_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
              ))}
            </select>

            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Routine Name *</label>
            <input placeholder="e.g. Shawn's Morning Routine"
              value={newRoutine.name}
              onChange={e => setNewRoutine({ ...newRoutine, name: e.target.value })}
              style={inputStyle} />

            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Emoji</label>
            <input placeholder="e.g. 🌅"
              value={newRoutine.emoji}
              onChange={e => setNewRoutine({ ...newRoutine, emoji: e.target.value })}
              style={{ ...inputStyle, width: '100px' }} />

            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description (optional)</label>
            <input placeholder="e.g. Daily morning routine for school days"
              value={newRoutine.description}
              onChange={e => setNewRoutine({ ...newRoutine, description: e.target.value })}
              style={inputStyle} />

            <div style={{ background: 'rgba(167,139,250,0.08)', borderRadius: '10px', padding: '12px', marginBottom: '16px', border: '1px solid rgba(167,139,250,0.2)' }}>
              <div style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>✨ Default steps included!</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                {DEFAULT_STEPS[newRoutine.type]?.length || 0} default steps will be added automatically. You can edit, add or remove steps after creating.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={createRoutine} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                {saving ? '⏳ Creating...' : '✅ Create Routine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}