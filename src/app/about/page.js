export default function AboutIntelliGen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href='/landing' style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '700', textDecoration: 'none', color: '#fff' }}>
          Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
        </a>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href='/landing' style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>Home</a>
          <a href='/privacy-policy' style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>Privacy</a>
          <a href='/terms' style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>Terms</a>
          <a href='/refund-policy' style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textDecoration: 'none' }}>Refund</a>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '48px', fontWeight: '700', marginBottom: '16px' }}>
            Intelli<span style={{ color: '#38bdf8' }}>Gen</span>
          </div>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.7', maxWidth: '600px', margin: '0 auto' }}>
            A modern school management platform built for preschools and early childhood education centres.
          </p>
        </div>

        {/* About Section */}
        <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', padding: '40px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#38bdf8', marginBottom: '16px' }}>Who We Are</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '16px', lineHeight: '1.8', marginBottom: '16px' }}>
            IntelliGen is a Software-as-a-Service (SaaS) platform designed exclusively for preschools, daycare centres, and early childhood education institutions. We provide schools with the digital tools they need to manage students, staff, fees, attendance, communication, and more — all in one place.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '16px', lineHeight: '1.8' }}>
            Our platform empowers school administrators, teachers, and parents with seamless digital experiences — from fee payments and daily diary notes to transport tracking and curriculum planning.
          </p>
        </div>

        {/* What We Do */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>What We Do</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {[
              { icon: '💳', title: 'Fee Management', desc: 'Digital invoicing, online payments via UPI and payment gateways, installment tracking and refund management.' },
              { icon: '✅', title: 'Attendance Tracking', desc: 'Digital attendance for students and staff, with real-time reports and absence notifications.' },
              { icon: '📔', title: 'Daily Diary', desc: 'Teachers send daily notes on food, activities, and behaviour directly to parents.' },
              { icon: '🚌', title: 'Transport Tracking', desc: 'Real-time bus tracking with instant parent notifications when children board or arrive.' },
              { icon: '📸', title: 'Classroom Moments', desc: 'Share photos of classroom activities with parents securely through the parent portal.' },
              { icon: '📊', title: 'Progress Reports', desc: 'Digital skill assessments and term reports shared with parents in one click.' },
              { icon: '💬', title: 'Parent Communication', desc: 'Direct messaging between teachers and parents, with push notifications.' },
              { icon: '📅', title: 'Event Calendar', desc: 'School event management with staff notifications and holiday tracking.' },
              { icon: '🤝', title: 'PTM Scheduling', desc: 'Parents book Parent-Teacher Meeting slots online — no back-and-forth calls.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{item.icon}</div>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{item.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Info */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '32px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#34d399', marginBottom: '14px' }}>💳 Payment Processing</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8', marginBottom: '12px' }}>
            IntelliGen provides an integrated payment gateway for schools to collect fees from parents. Payments are processed securely via GetePay and are credited directly to the respective school's merchant account.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', lineHeight: '1.8' }}>
            IntelliGen acts as a technology service provider and does not hold or process funds on behalf of schools. Each school manages their own merchant account and fee collections.
          </p>
        </div>

        {/* Schools using IntelliGen */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px' }}>🏫 Schools Using IntelliGen</h2>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '6px' }}>Time Kids Preschool — Anna Nagar, Chennai</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>
              2731, 7th Cross Street, 12th Main Rd, Y Block, Anna Nagar, Chennai, Tamil Nadu 600040
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href='/school/timekids-annanagar/about' style={{ padding: '6px 14px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '8px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>About School</a>
              <a href='/school/timekids-annanagar/privacy' style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
              <a href='/school/timekids-annanagar/terms' style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>Terms</a>
              <a href='/school/timekids-annanagar/refund' style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textDecoration: 'none' }}>Refund Policy</a>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '32px', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '16px' }}>📞 Contact Us</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            {[
              ['🏢 Platform', 'IntelliGen — School Management SaaS'],
              ['🌐 Website', 'intelligenapp.com'],
              ['✉️ Email', 'getintelligen@gmail.com'],
              ['📞 Phone', '+91 99620 48869'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', minWidth: '120px' }}>{label}</span>
                <span style={{ color: '#fff', fontSize: '14px' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '12px' }}>© 2025 IntelliGen. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href='/privacy-policy' style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
            <a href='/terms' style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
            <a href='/refund-policy' style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Refund Policy</a>
            <a href='/landing' style={{ color: '#38bdf8', fontSize: '13px', textDecoration: 'none' }}>Home</a>
          </div>
        </div>
      </div>
    </div>
  )
}