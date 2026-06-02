'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useModuleAccess(moduleId) {
  const [status, setStatus] = useState('loading')
  const [schoolPassword, setSchoolPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => { checkAccess() }, [moduleId])

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('allowed'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!profile) { setStatus('allowed'); return }

      const { data: school } = await supabase
        .from('schools')
        .select('module_access_password')
        .eq('id', profile.school_id)
        .single()

      setSchoolPassword(school?.module_access_password || '')

      const { data: restriction } = await supabase
        .from('sub_admin_restrictions')
        .select('restricted_modules')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!restriction) {
        setStatus('allowed')
        return
      }

      if (restriction.restricted_modules?.includes(moduleId)) {
        setStatus('restricted')
      } else {
        setStatus('allowed')
      }
    } catch (e) {
      setStatus('allowed')
    }
  }

  const unlock = (input) => {
    if (!input) { setPasswordError('Please enter the password'); return false }
    if (!schoolPassword) { setPasswordError('No password set. Contact admin.'); return false }
    if (input === schoolPassword) {
      setStatus('allowed')
      setPasswordError('')
      return true
    } else {
      setPasswordError('❌ Incorrect password. Try again.')
      return false
    }
  }

  return { status, passwordError, unlock }
}