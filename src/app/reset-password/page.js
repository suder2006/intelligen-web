'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  // Supabase puts the recovery token in the URL (hash for implicit links,
  // ?code= for PKCE). detectSessionInUrl handles the hash form on its own,
  // so we just wait for the recovery session to land before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setReady(true)
      else if (event === 'INITIAL_SESSION') setReady(true)
    })

    const exchangeCode = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      if (hash.get('error_description')) {
        setError(hash.get('error_description'))
        setReady(true)
        return
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) setError('This reset link is invalid or has expired. Please request a new one.')
        setReady(true)
      }
    }
    exchangeCode()

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
    await supabase.auth.signOut()
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .page { min-height: 100vh; background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'DM Sans', sans-serif; }
        .card { width: 100%; max-width: 420px; text-align: center; }
        .logo { font-family: 'Playfair Display', serif; font-size: 38px; letter-spacing: -1px; margin-bottom: 8px; }
        .logo span:nth-child(1) { color: #ef4444; }
        .logo span:nth-child(2) { color: #f59e0b; }
        .logo span:nth-child(3) { color: #eab308; }
        .logo span:nth-child(4) { color: #22c55e; }
        .logo span:nth-child(5) { color: #14b8a6; }
        .logo span:nth-child(6) { color: #0ea5e9; }
        .logo span:nth-child(7) { color: #6366f1; }
        .logo span:nth-child(8) { color: #a855f7; }
        .logo span:nth-child(9) { color: #ec4899; }
        .logo span:nth-child(10) { color: #f43f5e; }
        .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .subtitle { color: #64748b; font-size: 14px; margin-bottom: 32px; line-height: 1.6; }
        .label { display: block; text-align: left; color: #334155; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .input { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; color: #0f172a; font-size: 16px; outline: none; transition: all 0.2s; margin-bottom: 20px; font-family: 'DM Sans', sans-serif; }
        .input:focus { border-color: #0ea5e9; background: #fff; box-shadow: 0 0 0 3px rgba(14,165,233,0.12); }
        .input::placeholder { color: #cbd5e1; }
        .btn { width: 100%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 12px; padding: 15px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(14,165,233,0.35); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px 16px; border-radius: 10px; font-size: 14px; margin-bottom: 20px; text-align: left; }
        .link { background: none; border: none; color: #0ea5e9; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; font-family: 'DM Sans', sans-serif; }
        .hint { color: #94a3b8; font-size: 12px; text-align: left; margin: -12px 0 20px; }
        @media (max-width: 480px) {
          .page { padding: 20px; align-items: flex-start; padding-top: 60px; }
          .logo { font-size: 32px; }
        }
      `}</style>

      <div className="card">
        <div className="logo">
          <span>i</span><span>n</span><span>t</span><span>e</span><span>l</span><span>l</span><span>i</span><span>G</span><span>e</span><span>n</span>
        </div>

        {done ? (
          <>
            <div style={{ fontSize: '48px', margin: '24px 0 16px' }}>✅</div>
            <div className="title">Password Updated!</div>
            <div className="subtitle">
              Your password has been changed. Redirecting you to the login page...
            </div>
            <button className="btn" onClick={() => router.push('/login')}>
              Go to Login →
            </button>
          </>
        ) : (
          <>
            <div className="subtitle" style={{ marginBottom: '32px' }}>Preschool Management Platform</div>
            <div className="title">Set a New Password</div>
            <div className="subtitle">Choose a new password for your account.</div>

            {error && <div className="error">⚠️ {error}</div>}

            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
            />
            <div className="hint">At least 6 characters</div>

            <label className="label">Confirm Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
            />

            <button className="btn" onClick={handleReset} disabled={saving || !ready}>
              {saving ? 'Updating...' : ready ? 'Reset Password →' : 'Verifying link...'}
            </button>

            <button className="link" onClick={() => router.push('/login')}>
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
