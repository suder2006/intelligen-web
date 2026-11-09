'use client'

export const BMI_COLORS = {
  Underweight: '#f59e0b',
  Normal: '#10b981',
  Overweight: '#f97316',
  Obese: '#ef4444',
}

export const fieldLabelStyle = { color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }

// Dark overlay dialog used by the growth page's Add Entry and Bulk Upload.
export function GrowthModal({ title, onClose, busy, maxWidth = '460px', children }) {
  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px', width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ color: '#fff', fontWeight: '700', fontSize: '18px' }}>{title}</div>
          <button onClick={onClose} disabled={busy} aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
