'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function useSchool() {
  const [schoolId, setSchoolId] = useState(null)
  const [schoolName, setSchoolName] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof) { router.push('/'); return }
      setProfile(prof)
      setSchoolId(prof.school_id)
      if (prof.school_id) {
        const { data: school } = await supabase.from('schools').select('name, primary_color').eq('id', prof.school_id).single()
        setSchoolName(school?.name || 'My School')
      }
      setLoading(false)
    }
    init()
  }, [])

  return { schoolId, schoolName, profile, loading }
}