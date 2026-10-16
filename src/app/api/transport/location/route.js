export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  serviceClient,
  authorizeVehicleAccess,
  credentialsFrom,
  livepinGet,
  normalizeLocation,
  LIVEPIN_PATHS
} from '@/lib/livepin'

// Current GPS position of one Livepin vehicle.
// GET ?school_id=&vehicle_id=  →  { lat, lng, speed, status, address, updated_at }
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams
    const schoolId = params.get('school_id')
    const vehicleId = (params.get('vehicle_id') || '').trim()

    const supabase = serviceClient()
    const auth = await authorizeVehicleAccess(supabase, request, schoolId, vehicleId, 'gps')
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const json = await livepinGet(credentialsFrom(auth.integration), LIVEPIN_PATHS.location(vehicleId))
    const location = normalizeLocation(json)
    if (location.lat === null || location.lng === null) {
      return NextResponse.json({ error: 'Livepin returned no position for this vehicle yet' }, { status: 404 })
    }
    return NextResponse.json({ vehicle_id: vehicleId, ...location })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
