'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role === 'super_admin') router.push('/super-admin')
      else if (profile?.role === 'school_admin') router.push('/admin')
      else if (profile?.role === 'teacher') router.push('/teacher')
      else if (profile?.role === 'parent') router.push('/parent')
      else if (profile?.role === 'center_head') router.push('/center-head')
      else if (profile?.role === 'driver') router.push('/driver')
    }
    setLoading(false)
  }
  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setError('Please enter your email address'); return }
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: 'https://intelligenapp.com/reset-password'
    })
    if (error) setError(error.message)
    else setForgotSent(true)
    setForgotLoading(false)
  }
  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'super_admin') router.push('/super-admin')
    else if (profile?.role === 'school_admin') router.push('/admin')
    else if (profile?.role === 'teacher') router.push('/teacher')
    else if (profile?.role === 'parent') router.push('/parent')
    else if (profile?.role === 'center_head') router.push('/center-head')
    else if (profile?.role === 'driver') router.push('/driver')
    else router.push('/admin')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>Intelli<span style={{ color: '#38bdf8' }}>Gen</span></div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>
      </div>
    </div>
  )
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      padding: '20px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 48px; width: 100%; max-width: 440px; }
        .logo { font-family: 'Playfair Display', serif; font-size: 32px; color: #fff; letter-spacing: -1px; margin-bottom: 8px; }
        .logo span { color: #38bdf8; }
        .subtitle { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 40px; }
        .label { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500; margin-bottom: 8px; display: block; }
        .input { width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px 16px; color: #fff; font-size: 15px; outline: none; transition: all 0.2s; margin-bottom: 20px; font-family: 'DM Sans', sans-serif; }
        .input:focus { border-color: #38bdf8; background: rgba(56,189,248,0.08); }
        .input::placeholder { color: rgba(255,255,255,0.3); }
        .btn { width: 100%; background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 12px; padding: 15px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(14,165,233,0.4); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; padding: 12px 16px; border-radius: 10px; font-size: 14px; margin-bottom: 20px; }
        .divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 28px 0; }
        .roles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .role-badge { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4); }
        .role-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px; }
      `}</style>

      <div className="login-card">
        <div className="logo">Intelli<span>Gen</span></div>
        <div className="subtitle">Preschool Management Platform</div>

        {error && <div className="error">⚠️ {error}</div>}

        <label className="label">Email Address</label>
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <button className="btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In to IntelliGen →'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={() => setShowForgot(true)}
            style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600' }}>
            🔐 Forgot Password?
          </button>
        </div>

        <hr className="divider" />
        <div style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '12px', textAlign: 'center'}}>Platform Roles</div>
        {/* Forgot Password Modal */}
        {showForgot && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}
            onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); setError('') }}>
            <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '420px', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}>
              {!forgotSent ? (
                <>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔐</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Forgot Password</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '24px' }}>Enter your email and we'll send you a reset link.</div>
                  <input className="input"
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                  />
                  <button className="btn" onClick={handleForgotPassword} disabled={forgotLoading} style={{ marginBottom: '12px' }}>
                    {forgotLoading ? '⏳ Sending...' : 'Send Reset Link →'}
                  </button>
                  <button onClick={() => { setShowForgot(false); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Email Sent!</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                    Check your inbox for the password reset link. Click the link to set a new password.
                  </div>
                  <button className="btn" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}>
                    Back to Login
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="roles">
          <div className="role-badge"><span className="role-dot" style={{background:'#f59e0b'}}></span>Super Admin</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#10b981'}}></span>School Admin</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#38bdf8'}}></span>Teacher</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#a78bfa'}}></span>Parent</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#34d399'}}></span>Center Head</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#f59e0b'}}></span>Driver</div>
        </div>
      </div>
    </div>
  )
}