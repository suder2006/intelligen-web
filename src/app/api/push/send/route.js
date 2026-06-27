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
    const { userIds, title, body, url, icon, tokens, data } = await request.json()

    // ─── Expo push (mobile app) ───────────────────────────────
    if (tokens && tokens.length > 0) {
      const messages = tokens.map(token => ({
        to: token,
        title,
        body,
        sound: 'default',
        data: { ...(data || {}), url: url || '/' }
      }))

      const expoResponse = await fetch(
        'https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        body: JSON.stringify(messages)
      })

      const expoResult = await expoResponse.json()
      console.log('Expo push result:', expoResult)
      return Response.json({ success: true, expo: expoResult })
    }

    // ─── Web push (browser/PWA) ───────────────────────────────
    if (!userIds || userIds.length === 0) {
      return Response.json({ success: true, sent: 0 })
    }

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription, expo_token')
      .in('user_id', userIds)

    if (!subs || subs.length === 0) {
      return Response.json({ 
        success: true, sent: 0, 
        message: 'No subscriptions found' 
      })
    }

    // Send web push to browser subscribers
    const webSubs = subs.filter(s => s.subscription)
    const webResults = await Promise.allSettled(
      webSubs.map(s =>
        webpush.sendNotification(
          s.subscription,
          JSON.stringify({
            title, body,
            url: url || '/',
            icon: icon || '/icon-192.png'
          })
        )
      )
    )

    // Send Expo push to mobile subscribers
    const expoTokens = subs
      .map(s => s.expo_token)
      .filter(t => t && t.startsWith('ExponentPushToken'))

    let expoResult = null
    if (expoTokens.length > 0) {
      const messages = expoTokens.map(token => ({
        to: token,
        title,
        body,
        sound: 'default',
        data: { ...(data || {}), url: url || '/' }
      }))

      const expoResponse = await fetch(
        'https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(messages)
      })
      expoResult = await expoResponse.json()
      console.log('Expo push result:', expoResult)
    }

    const sent = webResults.filter(r => r.status === 'fulfilled').length
    const failed = webResults.filter(r => r.status === 'rejected').length

    return Response.json({ 
      success: true, 
      webPush: { sent, failed },
      expoPush: expoResult
    })

  } catch (error) {
    console.error('Push error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}