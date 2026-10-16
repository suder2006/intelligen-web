export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  serviceClient,
  authorizeVehicleAccess,
  getVehicleStream,
  extractFlvUrls,
  playerUrl
} from '@/lib/livepin'

// Live dashcam stream URLs for one Livepin vehicle. vehicle_id is the vehicle
// number stored on the route (e.g. TN23DP8800).
// GET ?school_id=&vehicle_id=  →  { urls: [flv...], player_url }
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams
    const schoolId = params.get('school_id')
    const vehicleId = (params.get('vehicle_id') || '').trim()

    const supabase = serviceClient()
    const auth = await authorizeVehicleAccess(supabase, request, schoolId, vehicleId, 'camera')
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const json = await getVehicleStream(auth.creds, vehicleId)
    const urls = extractFlvUrls(json)
    if (urls.length === 0) {
      return NextResponse.json({ error: 'The camera is offline right now. Try again when the bus is running.' }, { status: 404 })
    }
    return NextResponse.json({ vehicle_id: vehicleId, urls, player_url: playerUrl(urls) })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
