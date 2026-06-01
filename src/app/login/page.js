'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
    else router.push('/admin')
    setLoading(false)
  }

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

        <hr className="divider" />
        <div style={{color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '12px', textAlign: 'center'}}>Platform Roles</div>
        <div className="roles">
          <div className="role-badge"><span className="role-dot" style={{background:'#f59e0b'}}></span>Super Admin</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#10b981'}}></span>School Admin</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#38bdf8'}}></span>Teacher</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#a78bfa'}}></span>Parent</div>
          <div className="role-badge"><span className="role-dot" style={{background:'#34d399'}}></span>Center Head</div>
        </div>
      </div>
    </div>
  )
}