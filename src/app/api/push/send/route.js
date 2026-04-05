import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  try {
    const { userIds, title, body, url, icon } = await request.json()
    if (!userIds || userIds.length === 0) {
      return Response.json({ success: true, sent: 0 })
    }

    // Get subscriptions for these users
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', userIds)

    if (!subs || subs.length === 0) {
      return Response.json({ success: true, sent: 0, message: 'No subscriptions found' })
    }

    const results = await Promise.allSettled(
      subs.map(s =>
        webpush.sendNotification(s.subscription, JSON.stringify({
          title, body, url: url || '/',
          icon: icon || '/icon-192.png'
        }))
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    return Response.json({ success: true, sent, failed })
  } catch (error) {
    console.error('Push error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}