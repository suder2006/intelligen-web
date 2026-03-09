'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BlocksPage() {
  const router = useRouter()
  const [blocks, setBlocks] = useState([])
  const [form, setForm] = useState({ name: '', academic_year: '', start_date: '', end_date: '' })
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchBlocks() }, [])

  async function fetchBlocks() {
    const { data } = await supabase.from('curriculum_blocks').select('*').order('start_date')
    setBlocks(data || [])
  }

  async function save() {
    if (!form.name || !form.academic_year || !form.start_date || !form.end_date) { alert('Please fill all fields'); return }
    setLoading(true)
    if (editing) {
      await supabase.from('curriculum_blocks').update(form).eq('id', editing)
    } else {
      await supabase.from('curriculum_blocks').insert(form)
    }
    setForm({ name: '', academic_year: '', start_date: '', end_date: '' })
    setEditing(null)
    await fetchBlocks()
    setLoading(false)
  }

  async function deleteBlock(id) {
    if (!confirm('Delete this block?')) return
    await supabase.from('curriculum_blocks').delete().eq('id', id)
    fetchBlocks()
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📅 Curriculum Blocks</h1>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', marginBottom: '24px' }}>
          <h3 style={{ color: '#38bdf8', marginBottom: '16px' }}>{editing ? 'Edit Block' : 'Add New Block'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Block Name</label>
              <input placeholder='e.g. Block 1' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Academic Year</label>
              <input placeholder='e.g. 2025-2026' value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>Start Date</label>
              <input type='date' value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '13px' }}>End Date</label>
              <input type='date' value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                style={{ width: '100%', marginTop: '6px', padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={loading}
              style={{ padding: '10px 24px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Saving...' : editing ? '✏️ Update Block' : '➕ Add Block'}
            </button>
            {editing && <button onClick={() => { setEditing(null); setForm({ name: '', academic_year: '', start_date: '', end_date: '' }) }}
              style={{ padding: '10px 24px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>}
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#94a3b8', marginBottom: '16px' }}>All Blocks ({blocks.length})</h3>
          {blocks.length === 0 && <p style={{ color: '#475569' }}>No blocks created yet.</p>}
          {blocks.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', backgroundColor: '#0f172a', borderRadius: '10px', marginBottom: '8px', border: '1px solid #334155' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#38bdf8' }}>{b.name}</div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>{b.academic_year} · {b.start_date} → {b.end_date}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setEditing(b.id); setForm({ name: b.name, academic_year: b.academic_year, start_date: b.start_date, end_date: b.end_date }) }}
                  style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✏️</button>
                <button onClick={() => deleteBlock(b.id)}
                  style={{ padding: '6px 12px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}