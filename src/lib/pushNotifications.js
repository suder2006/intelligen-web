const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerPushNotifications(supabase, userId, schoolId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported')
      return false
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Push permission denied')
      return false
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    // Save to database
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      school_id: schoolId,
      subscription: subscription.toJSON(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })

    return true
  } catch (error) {
    console.error('Push registration error:', error)
    return false
  }
}

export async function sendPushToUsers(userIds, title, body, url = '/') {
  try {
    // Get subscriptions from API
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, title, body, url })
    })
    return await response.json()
  } catch (error) {
    console.error('Send push error:', error)
    return { success: false }
  }
}