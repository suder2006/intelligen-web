'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const [form, setForm] = useState({ name: '', school: '', phone: '', email: '', city: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

const handleSubmit = async () => {
  if (!form.name || !form.school || !form.phone) { alert('Please fill in required fields'); return }
  setSubmitting(true)
  const { error } = await supabase.from('demo_requests').insert({
    name: form.name,
    school: form.school,
    phone: form.phone,
    email: form.email,
    city: form.city
  })
  if (error) { alert('Something went wrong. Please try again.'); setSubmitting(false); return }
  setSubmitted(true)
  setSubmitting(false)
}

  const features = [
    { icon: '✅', title: 'Attendance', desc: 'Mark student and staff attendance digitally. Real-time reports at your fingertips.' },
    { icon: '💳', title: 'Fee Management', desc: 'Send invoices, track payments, accept UPI. No more paper receipts.' },
    { icon: '📔', title: 'Daily Diary', desc: 'Teachers send daily notes — food, activity, behavior — straight to parents.' },
    { icon: '🚌', title: 'Transport Tracking', desc: 'Real-time bus tracking. Parents notified the moment their child boards or arrives.' },
    { icon: '📸', title: 'Classroom Moments', desc: 'Share photos of activities with parents instantly. Build trust every day.' },
    { icon: '💬', title: 'Parent Messaging', desc: 'Direct communication between teachers and parents. No WhatsApp groups needed.' },
    { icon: '📊', title: 'Progress Reports', desc: 'Digital skill assessments and term reports shared with parents in one click.' },
    { icon: '🤝', title: 'PTM Scheduling', desc: 'Parents book meeting slots online. No back-and-forth calls.' },
    { icon: '📅', title: 'Holiday Calendar', desc: 'Announce holidays, events and activities. Everyone stays informed.' },
  ]

  const portals = [
    { color: '#1e3a8a', light: '#dbeafe', icon: '👪', title: 'Parent Portal', points: ['Child attendance & fees', 'Daily diary notes', 'Transport live updates', 'Direct teacher messaging'] },
    { color: '#065f46', light: '#d1fae5', icon: '👩‍🏫', title: 'Teacher Portal', points: ['Mark attendance', 'Write diary entries', 'Transport marking', 'Student progress tracking'] },
    { color: '#78350f', light: '#fef3c7', icon: '🏫', title: 'Admin Portal', points: ['Full school dashboard', 'Fee management', 'Staff payroll', 'Enquiries & admissions'] },
  ]

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", background: '#fafaf8', color: '#1a1a1a', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(250,250,248,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.06); padding: 16px 40px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
        .logo .gen { color: #ea7211; }
        .logo .intelli { color: #1e3a8a; }
        .demo-btn { background: #1e3a8a; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .demo-btn:hover { background: #1e40af; transform: translateY(-1px); }
        .hero { min-height: 100vh; display: flex; align-items: center; padding: 120px 40px 80px; position: relative; overflow: hidden; }
        .hero-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #f0f4ff 0%, #fafaf8 50%, #fff7ed 100%); }
        .hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(30,58,138,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,138,0.04) 1px, transparent 1px); background-size: 60px 60px; }
        .hero-content { position: relative; max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .hero-tag { display: inline-block; background: #dbeafe; color: #1e3a8a; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 20px; margin-bottom: 24px; letter-spacing: 1px; text-transform: uppercase; }
        .hero-title { font-size: clamp(42px, 5vw, 72px); font-weight: 300; line-height: 1.1; letter-spacing: -1px; margin-bottom: 24px; }
        .hero-title strong { font-weight: 700; color: #1e3a8a; }
        .hero-title .orange { color: #ea7211; }
        .hero-sub { font-family: 'DM Sans', sans-serif; font-size: 17px; font-weight: 300; color: #555; line-height: 1.7; margin-bottom: 36px; }
        .hero-actions { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
        .btn-primary { background: #1e3a8a; color: #fff; border: none; padding: 14px 32px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-primary:hover { background: #1e40af; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(30,58,138,0.25); }
        .btn-secondary { background: transparent; color: #1e3a8a; border: 1.5px solid #1e3a8a; padding: 14px 32px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-secondary:hover { background: #f0f4ff; }
        .hero-visual { position: relative; }
        .phone-mockup { width: 240px; height: 480px; background: #0f172a; border-radius: 36px; border: 6px solid #1e293b; margin: 0 auto; position: relative; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.2); }
        .phone-notch { background: #1e293b; height: 28px; display: flex; align-items: center; justify-content: center; }
        .phone-notch-bar { width: 60px; height: 5px; background: #334155; border-radius: 3px; }
        .phone-content { padding: 12px; }
        .phone-header { background: #1e293b; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .phone-stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 8px; text-align: center; }
        .phone-card { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; padding: 8px; margin-bottom: 6px; }
        .phone-card2 { background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); border-radius: 8px; padding: 8px; }
        .floating-card { position: absolute; background: #fff; border-radius: 12px; padding: 12px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .section { padding: 100px 40px; max-width: 1200px; margin: 0 auto; }
        .section-tag { font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; color: #ea7211; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
        .section-title { font-size: clamp(32px, 4vw, 52px); font-weight: 300; letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 16px; }
        .section-title strong { font-weight: 700; }
        .section-sub { font-family: 'DM Sans', sans-serif; font-size: 16px; color: #666; line-height: 1.7; max-width: 600px; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; margin-top: 56px; }
        .feature-card { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 16px; padding: 28px; transition: all 0.3s; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.08); border-color: rgba(30,58,138,0.15); }
        .feature-icon { font-size: 32px; margin-bottom: 16px; }
        .feature-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #1a1a1a; }
        .feature-desc { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #666; line-height: 1.6; }
        .portals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
        .portal-card { border-radius: 20px; padding: 36px; position: relative; overflow: hidden; }
        .portal-icon { font-size: 36px; margin-bottom: 20px; }
        .portal-title { font-size: 24px; font-weight: 600; margin-bottom: 20px; }
        .portal-point { font-family: 'DM Sans', sans-serif; font-size: 14px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; gap: 8px; }
        .portal-point:last-child { border-bottom: none; }
        .form-section { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 100px 40px; }
        .form-inner { max-width: 700px; margin: 0 auto; text-align: center; }
        .form-title { font-size: clamp(32px, 4vw, 52px); font-weight: 300; color: #fff; letter-spacing: -0.5px; margin-bottom: 12px; }
        .form-title strong { font-weight: 700; color: #fbbf24; }
        .form-sub { font-family: 'DM Sans', sans-serif; font-size: 16px; color: rgba(255,255,255,0.6); margin-bottom: 48px; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .form-input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; }
        .form-input::placeholder { color: rgba(255,255,255,0.35); }
        .form-input:focus { border-color: rgba(251,191,36,0.5); }
        .form-submit { width: 100%; padding: 16px; background: #ea7211; color: #fff; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
        .form-submit:hover { background: #c2600e; transform: translateY(-1px); }
        .success-box { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 16px; padding: 40px; text-align: center; }
        .footer { background: #0f172a; color: rgba(255,255,255,0.5); padding: 40px; text-align: center; font-family: 'DM Sans', sans-serif; font-size: 13px; }
        .footer a { color: rgba(255,255,255,0.5); text-decoration: none; margin: 0 12px; }
        .footer a:hover { color: #fff; }
        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; background: #fff; border-radius: 20px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); margin-top: 80px; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 48px; font-weight: 700; color: #1e3a8a; line-height: 1; }
        .stat-label { font-family: 'DM Sans', sans-serif; font-size: 14px; color: #888; margin-top: 8px; }
        @media (max-width: 768px) {
          .hero-content { grid-template-columns: 1fr; gap: 40px; }
          .hero-visual { display: none; }
          .portals-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
          .stats-row { grid-template-columns: 1fr; }
          .nav { padding: 14px 20px; }
          .hero { padding: 100px 20px 60px; }
          .section { padding: 60px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="logo">
          <span className="intelli">intelli</span><span className="gen">Gen</span>
        </div>
        <button className="demo-btn" onClick={() => document.getElementById('demo-form').scrollIntoView({ behavior: 'smooth' })}>
          Request Demo
        </button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div>
            <div className="hero-tag">🎓 Preschool Management Platform</div>
            <h1 className="hero-title">
              Run your preschool <strong>smarter</strong>, not <span className="orange">harder</span>
            </h1>
            <p className="hero-sub">
              Everything your preschool needs — attendance, fees, diary, transport, 
              parent communication — in one beautiful platform.
            </p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={() => document.getElementById('demo-form').scrollIntoView({ behavior: 'smooth' })}>
                Request a Demo →
              </button>
              <button className="btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
                See Features
              </button>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="hero-visual">
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <div className="phone-mockup">
                <div className="phone-notch"><div className="phone-notch-bar" /></div>
                <div className="phone-content">
                  <div className="phone-header">
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700', fontFamily: 'DM Sans' }}>
                      <span style={{ color: '#93c5fd' }}>intelli</span><span style={{ color: '#fb923c' }}>Gen</span>
                    </div>
                    <div style={{ background: 'rgba(167,139,250,0.2)', color: '#c4b5fd', fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontFamily: 'DM Sans' }}>Parent</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                    <div className="phone-stat">
                      <div style={{ color: '#38bdf8', fontSize: '16px', fontWeight: '700', fontFamily: 'DM Sans' }}>92%</div>
                      <div style={{ color: '#475569', fontSize: '9px', fontFamily: 'DM Sans' }}>Attendance</div>
                    </div>
                    <div className="phone-stat">
                      <div style={{ color: '#f87171', fontSize: '16px', fontWeight: '700', fontFamily: 'DM Sans' }}>₹2,500</div>
                      <div style={{ color: '#475569', fontSize: '9px', fontFamily: 'DM Sans' }}>Fees Due</div>
                    </div>
                  </div>
                  <div className="phone-card">
                    <div style={{ color: '#fbbf24', fontSize: '9px', fontFamily: 'DM Sans', marginBottom: '3px' }}>📔 Diary Note</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'DM Sans', lineHeight: 1.4 }}>Arjun had a great day! Ate lunch well and participated actively.</div>
                  </div>
                  <div className="phone-card2">
                    <div style={{ color: '#38bdf8', fontSize: '9px', fontFamily: 'DM Sans', marginBottom: '3px' }}>🚌 Transport Update</div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', fontFamily: 'DM Sans', lineHeight: 1.4 }}>Arjun has arrived at school safely ✅</div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="floating-card" style={{ top: '20px', right: '-20px', fontFamily: 'DM Sans' }}>
                <div style={{ color: '#16a34a', fontWeight: '600', fontSize: '13px' }}>✅ Attendance Marked</div>
                <div style={{ color: '#888', fontSize: '11px' }}>18 students present</div>
              </div>
              <div className="floating-card" style={{ bottom: '60px', left: '-30px', fontFamily: 'DM Sans' }}>
                <div style={{ color: '#1e3a8a', fontWeight: '600', fontSize: '13px' }}>💬 New Message</div>
                <div style={{ color: '#888', fontSize: '11px' }}>From: Ms. Priya</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div style={{ padding: '0 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-value">3</div>
            <div className="stat-label">Powerful Portals</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">15+</div>
            <div className="stat-label">Features Built-in</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">100%</div>
            <div className="stat-label">Digital & Paperless</div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="section" id="features">
        <div className="section-tag">Everything you need</div>
        <h2 className="section-title">All your tools, <strong>one platform</strong></h2>
        <p className="section-sub">No more juggling WhatsApp groups, Excel sheets and paper registers. intelliGen brings everything together.</p>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PORTALS */}
      <section style={{ background: '#f8f8f6', padding: '100px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="section-tag">Three portals, one school</div>
          <h2 className="section-title">Built for <strong>everyone</strong> in your school</h2>
          <p className="section-sub">Separate portals for parents, teachers and admins — each designed for their specific needs.</p>
          <div className="portals-grid">
            {portals.map((p, i) => (
              <div key={i} className="portal-card" style={{ background: p.light }}>
                <div className="portal-icon">{p.icon}</div>
                <div className="portal-title" style={{ color: p.color }}>{p.title}</div>
                {p.points.map((pt, j) => (
                  <div key={j} className="portal-point" style={{ color: '#333' }}>
                    <span style={{ color: p.color, fontSize: '16px' }}>→</span> {pt}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO FORM */}
      <section className="form-section" id="demo-form">
        <div className="form-inner">
          {!submitted ? (
            <>
              <h2 className="form-title">Ready to <strong>transform</strong> your preschool?</h2>
              <p className="form-sub">Request a free demo. We'll set up your school and walk you through everything.</p>
              <div className="form-grid">
                <input className="form-input" placeholder="Your Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="form-input" placeholder="School Name *" value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} />
                <input className="form-input" placeholder="Phone Number *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input className="form-input" placeholder="Email Address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <input className="form-input" placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={{ marginBottom: '0' }} />
              <button className="form-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '⏳ Submitting...' : '🚀 Request Free Demo'}
              </button>
              <p style={{ fontFamily: 'DM Sans', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '16px' }}>
                No credit card required. We'll contact you within 24 hours.
              </p>
            </>
          ) : (
            <div className="success-box">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <div style={{ color: '#34d399', fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Thank you, {form.name}!</div>
              <div style={{ fontFamily: 'DM Sans', color: 'rgba(255,255,255,0.7)', fontSize: '16px' }}>
                We've received your request for <strong style={{ color: '#fff' }}>{form.school}</strong>.<br />
                Our team will contact you within 24 hours.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '700' }}>
            <span style={{ color: '#93c5fd' }}>intelli</span><span style={{ color: '#fb923c' }}>Gen</span>
          </span>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="mailto:hello@intelligenapp.in">Contact Us</a>
        </div>
        <div>© 2026 intelliGen. All rights reserved.</div>
      </footer>
    </div>
  )
}