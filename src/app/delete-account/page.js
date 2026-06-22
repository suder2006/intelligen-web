export default function DeleteAccountPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', 
      fontFamily: 'sans-serif', color: '#fff', 
      display: 'flex', alignItems: 'center', 
      justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', 
          marginBottom: '12px' }}>Request Account Deletion</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', 
          fontSize: '15px', lineHeight: '1.8', marginBottom: '24px' }}>
          To request deletion of your account and associated data, 
          please send an email to us. We will process your request 
          within 30 days.
        </p>
        <a href="mailto:getintelligen@gmail.com?subject=Account Deletion Request&body=Please delete my account and all associated data. My registered email is: "
          style={{ display: 'inline-block', padding: '14px 28px',
            background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            borderRadius: '10px', color: '#fff', fontWeight: '700',
            fontSize: '15px', textDecoration: 'none' }}>
          📧 Email Us to Delete Account
        </a>
        <p style={{ color: 'rgba(255,255,255,0.3)', 
          fontSize: '13px', marginTop: '20px' }}>
          intelliGen · intelligenapp.com<br/>
          getintelligen@gmail.com
        </p>
      </div>
    </div>
  )
}