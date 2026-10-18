import { supabase } from '@/lib/supabase'

// Permanently deletes moments (storage files and DB rows) through
// /api/moments/delete. Throws with the server's message on any failure.
export async function deleteMoments(ids) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/moments/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: JSON.stringify({ moment_ids: ids })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) throw new Error(body.error || `Delete failed (${res.status})`)
  return body
}
