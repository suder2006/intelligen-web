'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function SchoolPrivacyPolicy() {
  const params = useParams()
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSchool = async () => {
      const { data } = await supabase
        .from('schools')
        .select('name, school_address, school_contact_email, slug, primary_color, policy_privacy')
        .eq('slug', params.slug)
        .single()
      setSchool(data)
      setLoading(false)
    }
    if (params.slug) fetchSchool()
  }, [params.slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>
      Loading...
    </div>
  )

  if (!school) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif' }}>
      School not found.
    </div>
  )

  const color = school.primary_color || '#38bdf8'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: "'DM Sans', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <a href='/landing' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>← Back to IntelliGen</a>
          <div style={{ fontSize: '26px', fontWeight: '700', color: color, marginBottom: '6px' }}>{school.name}</div>
          <h1 style={{ fontSize: '30px', fontWeight: '700', marginBottom: '6px' }}>🔒 Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Last updated: June 2025</p>
        </div>

        {school.policy_privacy ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '28px' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: '1.9', whiteSpace: 'pre-line' }}>
              {school.policy_privacy}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
            Privacy policy not yet published by this school.
          </div>
        )}

        <div style={{ marginTop: '32px', padding: '16px', background: `${color}10`, border: `1px solid ${color}20`, borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>© 2025 {school.name}</div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`/school/${school.slug}/terms`} style={{ color: color, fontSize: '13px' }}>Terms & Conditions</a>
            <a href={`/school/${school.slug}/refund`} style={{ color: color, fontSize: '13px' }}>Refund Policy</a>
          </div>
        </div>
      </div>
    </div>
  )
}