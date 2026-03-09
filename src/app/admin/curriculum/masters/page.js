'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const TYPES = [
  { key: 'program', label: '🏫 Programs' },
  { key: 'activity', label: '🎯 Activities' },
  { key: 'activity_category', label: '📂 Categories' },
  { key: 'activity_type', label: '🔖 Activity Types' },
]

export default function MastersPage() {
  const router = useRouter()
  const [masters, setMasters] = useState([])
  const [activeType, setActiveType] = useState('program')
  const [newValue, setNewValue] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchMasters() }, [])

  async function fetchMasters() {
    const { data } = await supabase.from('curriculum_masters').select('*').order('type').order('value')
    setMasters(data || [])
  }

  async function addItem() {
    if (!newValue.trim()) return
    setLoading(true)
    await supabase.from('curriculum_masters').insert({ type: activeType, value: newValue.trim() })
    setNewValue('')
    await fetchMasters()
    setLoading(false)
  }

  async function deleteItem(id) {
    await supabase.from('curriculum_masters').delete().eq('id', id)
    fetchMasters()
  }

  const filtered = masters.filter(m => m.type === activeType)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '24px', color: '#fff' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>📋 Master Lists</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t.key} onClick={() => setActiveType(t.key)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: activeType === t.key ? '#38bdf8' : '#1e293b', color: activeType === t.key ? '#0f172a' : '#94a3b8' }}>
              {t.label} ({masters.filter(m => m.type === t.key).length})
            </button>
          ))}
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input placeholder={`Add new ${activeType}...`} value={newValue} onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              style={{ flex: 1, padding: '10px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px' }} />
            <button onClick={addItem} disabled={loading}
              style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              ➕ Add
            </button>
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: '#94a3b8', marginBottom: '16px' }}>{TYPES.find(t => t.key === activeType)?.label} ({filtered.length})</h3>
          {filtered.length === 0 && <p style={{ color: '#475569' }}>No items yet. Add one above!</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {filtered.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{item.value}</span>
                <button onClick={() => deleteItem(item.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}