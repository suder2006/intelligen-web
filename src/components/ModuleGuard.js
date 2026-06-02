'use client'
import { useState } from 'react'
import { useModuleAccess } from '@/hooks/useModuleAccess'

export default function ModuleGuard({ moduleId, children }) {
  const { status, passwordError, unlock } = useModuleAccess(moduleId)
  const [input, setInput] = useState('')

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
      </div>
    )
  }

  if (status === 'restricted') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '40px 36px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontWeight: '700', fontSize: '20px', color: '#fff', marginBottom: '8px' }}>Access Restricted</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '28px' }}>
            This module is protected. Enter the access password to continue.
          </div>
          <input
            type='password'
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && unlock(input)}
            placeholder='Enter access password'
            autoFocus
            style={{
              width: '100%', padding: '14px 16px',
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${passwordError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '10px', color: '#fff', fontSize: '16px',
              outline: 'none', marginBottom: '8px',
              fontFamily: "'DM Sans', sans-serif",
              textAlign: 'center', letterSpacing: '4px'
            }}
          />
          {passwordError && (
            <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{passwordError}</div>
          )}
          {!passwordError && <div style={{ height: '21px', marginBottom: '12px' }} />}
          <button
            onClick={() => unlock(input)}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontWeight: '700', fontSize: '15px',
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
            }}>
            🔓 Unlock Module
          </button>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', marginTop: '16px' }}>
            Contact your school admin for the password
          </div>
        </div>
      </div>
    )
  }

  return children
}