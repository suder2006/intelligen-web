'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [route, setRoute] = useState(null)
  const [stops, setStops] = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [tripLogs, setTripLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [markingStop, setMarkingStop] = useState(null)
  const [tripType, setTripType] = useState('morning')
  const [selectedDropTime, setSelectedDropTime] = useState('12:30')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [lastLocationSent, setLastLocationSent] = useState(null)
  const watchIdRef = useRef(null)
  const tripIdRef = useRef(null)
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role !== 'driver') { router.push('/login'); return }
    setProfile(prof)

    // Get driver's assigned route
    const { data: routeData } = await supabase.from('transport_routes')
      .select('*').eq('driver_profile_id', user.id).eq('is_active', true).single()
    setRoute(routeData)

    if (routeData) {
      // Get stops for this route
      const { data: stopsData } = await supabase.from('route_stops')
        .select('*, students(full_name, program, parent_name, parent_phone)')
        .eq('route_id', routeData.id)
        .order('stop_order')
      setStops(stopsData || [])

      // Check for active trip
      const { data: tripData } = await supabase.from('trips')
        .select('*').eq('route_id', routeData.id)
        .eq('status', 'active').single()
      if (tripData) {
        setActiveTrip(tripData)
        tripIdRef.current = tripData.id
        setTripType(tripData.trip_type)
        // Load trip stop logs
        await fetchTripLogs(tripData.id)
        // Resume GPS tracking
        startGPSTracking(tripData.id)
      }
    }
    setLoading(false)
  }

  const fetchTripLogs = async (tripId) => {
    const { data } = await supabase.from('trip_stop_logs')
      .select('*').eq('trip_id', tripId)
    setTripLogs(data || [])
  }

  const startGPSTracking = (tripId) => {
    if (!navigator.geolocation) { setLocationError('GPS not available'); return }
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed } = position.coords
        setCurrentLocation({ lat: latitude, lng: longitude, speed })
        setLastLocationSent(new Date())
        // Save to vehicle_locations
        await supabase.from('vehicle_locations').insert({
          trip_id: tripId,
          route_id: route?.id,
          school_id: profile?.school_id,
          latitude,
          longitude,
          speed: speed || 0,
          timestamp: new Date().toISOString()
        })
      },
      (error) => setLocationError('Could not get location. Please enable GPS.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
  }

  const stopGPSTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const startTrip = async () => {
    if (!route) return
    setStarting(true)
    const { data: trip } = await supabase.from('trips').insert({
      school_id: profile.school_id,
      route_id: route.id,
      trip_type: tripType,
      trip_time: tripType === 'morning' ? 'morning' : selectedDropTime,
      status: 'active',
      started_at: new Date().toISOString()
    }).select().single()

    if (trip) {
      setActiveTrip(trip)
      tripIdRef.current = trip.id
      startGPSTracking(trip.id)

      // Notify all parents on this route
      const parentIds = []
      for (const stop of stops) {
        const { data: ps } = await supabase.from('parent_students')
          .select('parent_id').eq('student_id', stop.student_id)
        if (ps) parentIds.push(...ps.map(p => p.parent_id))
      }
      if (parentIds.length > 0) {
        try {
          await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: [...new Set(parentIds)],
              title: '🚌 Van has started!',
              body: `${route.name} is on the way. Track live in IntelliGen.`,
              url: '/parent',
              data: { type: 'transport' }
            })
          })
        } catch (e) { console.log('Push error:', e) }
      }
    }
    setStarting(false)
  }

  const endTrip = async () => {
    if (!confirm('End this trip?')) return
    setEnding(true)
    stopGPSTracking()
    await supabase.from('trips').update({
      status: 'completed',
      ended_at: new Date().toISOString()
    }).eq('id', activeTrip.id)
    setActiveTrip(null)
    tripIdRef.current = null
    setTripLogs([])
    setCurrentLocation(null)
    setEnding(false)
  }

  const markStop = async (stop, status) => {
    if (!activeTrip) return
    setMarkingStop(stop.id)

    // Save to trip_stop_logs
    await supabase.from('trip_stop_logs').insert({
      trip_id: activeTrip.id,
      stop_id: stop.id,
      student_id: stop.student_id,
      status,
      timestamp: new Date().toISOString()
    })

    // Also save to transport_logs (for existing system)
    const eventType = tripType === 'morning' ? 'morning_pickup' : 'home_drop'
    if (status === 'picked_up' || status === 'dropped') {
      await supabase.from('transport_logs').insert({
        school_id: profile.school_id,
        student_id: stop.student_id,
        route_id: route.id,
        event_type: eventType,
        event_time: new Date().toISOString(),
        marked_by: user.id,
        method: 'driver_app',
        parent_notified: false
      })

      // Notify parent
      const { data: ps } = await supabase.from('parent_students')
        .select('parent_id').eq('student_id', stop.student_id)
      if (ps && ps.length > 0) {
        const msgMap = {
          morning_pickup: `🌅 ${stop.students?.full_name} has boarded the van!\n🚌 ${route.vehicle_number || ''}\n👨‍✈️ ${route.driver_name || ''}`,
          home_drop: `🏠 ${stop.students?.full_name} has been dropped safely at home.\n✅ Please confirm receipt in the app.`
        }
        try {
          await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: ps.map(p => p.parent_id),
              title: tripType === 'morning' ? '🚌 Child Boarded Van' : '🏠 Child Dropped Home',
              body: msgMap[eventType],
              url: '/parent',
              data: { type: 'transport' }
            })
          })
        } catch (e) { console.log('Push error:', e) }
      }
    }

    await fetchTripLogs(activeTrip.id)
    setMarkingStop(null)
  }

const isStopDone = (stopId) => tripLogs.some(l => l.stop_id === stopId)
  const getStopStatus = (stopId) => tripLogs.find(l => l.stop_id === stopId)?.status

  // Filter stops based on trip type
  const activeStops = tripType === 'morning'
    ? [...stops].sort((a, b) => a.stop_order - b.stop_order)
    : [...stops].filter(s => s.drop_time?.startsWith(selectedDropTime))
        .sort((a, b) => a.stop_order - b.stop_order)

  const completedStops = activeStops.filter(s => isStopDone(s.id)).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
        <div style={{ color: 'rgba(255,255,255,0.4)' }}>Loading driver portal...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 12px; padding: 14px 24px; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; width: 100%; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: '700', fontSize: '18px' }}>🚌 Driver Portal</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{profile?.full_name}</div>
        </div>
        <button onClick={async () => { stopGPSTracking(); await supabase.auth.signOut(); router.push('/login') }}
          style={{ padding: '7px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
          🚪 Sign Out
        </button>
      </div>

      <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>

        {/* No route assigned */}
        {!route && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No Route Assigned</div>
            <div style={{ fontSize: '14px' }}>Please contact admin to assign you to a route.</div>
          </div>
        )}

        {route && (
          <>
            {/* Route Info */}
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(56,189,248,0.05))', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', fontSize: '18px', color: '#38bdf8', marginBottom: '8px' }}>🚌 {route.name}</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {route.vehicle_number && <span>🚌 {route.vehicle_number}</span>}
                {route.morning_pickup_time && <span>🌅 Morning: {route.morning_pickup_time}</span>}
                
              </div>
            </div>

            {/* GPS Status */}
            <div style={{ background: currentLocation ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${currentLocation ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: currentLocation ? '#34d399' : '#fbbf24' }}>
                  {currentLocation ? '📡 GPS Active' : '📡 GPS Inactive'}
                </div>
                {currentLocation && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '2px' }}>
                    {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                    {currentLocation.speed > 0 && ` · ${(currentLocation.speed * 3.6).toFixed(0)} km/h`}
                  </div>
                )}
                {locationError && <div style={{ color: '#f87171', fontSize: '12px' }}>{locationError}</div>}
                {lastLocationSent && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>Last sent: {lastLocationSent.toLocaleTimeString()}</div>}
              </div>
              <div style={{ fontSize: '24px' }}>{currentLocation ? '🟢' : '🔴'}</div>
            </div>

            {/* No active trip — Start Trip */}
            {!activeTrip && (
              <>
                <div className="card">
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '16px' }}>Start New Trip</div>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>Trip Type</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                      {[['morning', '🌅 Morning Pickup'], ['afternoon', '🏠 Afternoon Drop']].map(([type, label]) => (
                        <button key={type} onClick={() => setTripType(type)}
                          style={{ padding: '12px', borderRadius: '10px', border: `2px solid ${tripType === type ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: tripType === type ? 'rgba(56,189,248,0.15)' : 'transparent', color: tripType === type ? '#38bdf8' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '14px' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* Afternoon drop time selector */}
                    {tripType === 'afternoon' && (
                      <div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>Select Drop Time</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          {[['12:30', '12:30 PM'], ['14:30', '2:30 PM'], ['16:30', '4:30 PM']].map(([time, label]) => {
                            const studentsForTime = stops.filter(s => s.drop_time?.startsWith(time))
                            if (studentsForTime.length === 0) return null
                            return (
                              <button key={time} onClick={() => setSelectedDropTime(time)}
                                style={{ padding: '10px 8px', borderRadius: '10px', border: `2px solid ${selectedDropTime === time ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`, background: selectedDropTime === time ? 'rgba(167,139,250,0.15)' : 'transparent', color: selectedDropTime === time ? '#a78bfa' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '13px', textAlign: 'center' }}>
                                {label}
                                <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.7 }}>{studentsForTime.length} students</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stop Preview */}
                      <div style={{ marginBottom: '16px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>
                      {activeStops.length} students for this trip:
                    </div>
                    {activeStops.length === 0 && (
                      <div style={{ color: '#f87171', fontSize: '13px', padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', marginBottom: '10px' }}>
                        ⚠️ No students assigned to this drop time. Check Manage Stops.
                      </div>
                    )}
                    {activeStops.map((stop, idx) => (
                      <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#38bdf8', flexShrink: 0 }}>{idx + 1}</div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>{stop.students?.full_name}</div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                            {stop.address || 'No address set'}
                            {tripType === 'morning' && stop.expected_pickup_time && ` · 🌅 ${stop.expected_pickup_time}`}
                            {tripType === 'afternoon' && stop.drop_time && ` · 🏠 ${stop.drop_time?.startsWith('12:30') ? '12:30 PM' : stop.drop_time?.startsWith('14:30') ? '2:30 PM' : '4:30 PM'}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={startTrip} disabled={starting} className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', fontSize: '18px' }}>
                    {starting ? '⏳ Starting...' : '🚀 Start Trip'}
                  </button>
                </div>
              </>
            )}

            {/* Active Trip */}
            {activeTrip && (
              <>
                {/* Trip Progress */}
                <div className="card" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '16px', color: '#34d399' }}>
                        🚌 Trip Active — {tripType === 'morning' ? '🌅 Morning' : '🏠 Afternoon'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '2px' }}>
                        Started: {new Date(activeTrip.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                      <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#34d399', fontWeight: '700', fontSize: '22px' }}>{completedStops}/{activeStops.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>stops done</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px', width: `${activeStops.length > 0 ? (completedStops / activeStops.length) * 100 : 0}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>

                {/* Stop List */}
                <div style={{ marginBottom: '20px' }}>
                  {activeStops.map((stop, idx) => {
                    const done = isStopDone(stop.id)
                    const status = getStopStatus(stop.id)
                    const isNext = !done && activeStops.slice(0, idx).every(s => isStopDone(s.id))
                    return (
                      <div key={stop.id} style={{ background: done ? 'rgba(16,185,129,0.06)' : isNext ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)', border: `2px solid ${done ? 'rgba(16,185,129,0.3)' : isNext ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '16px', padding: '16px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          {/* Stop number */}
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: done ? 'linear-gradient(135deg, #10b981, #34d399)' : isNext ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px', color: '#fff', flexShrink: 0 }}>
                            {done ? '✅' : idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '2px' }}>{stop.students?.full_name}</div>
                            <div style={{ color: '#a78bfa', fontSize: '13px', marginBottom: '2px' }}>{stop.students?.program}</div>
                            {stop.address && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '4px' }}>📍 {stop.address}</div>}
                            {stop.students?.parent_phone && (
                              <a href={`tel:${stop.students.parent_phone}`} style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none' }}>📞 Call Parent</a>
                            )}
                            {done && (
                              <div style={{ marginTop: '6px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: status === 'not_available' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: status === 'not_available' ? '#f87171' : '#34d399' }}>
                                  {status === 'picked_up' ? '✅ Picked Up' : status === 'dropped' ? '✅ Dropped' : '❌ Not Available'}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Action buttons */}
                          {!done && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                              <button
                                onClick={() => markStop(stop, tripType === 'morning' ? 'picked_up' : 'dropped')}
                                disabled={markingStop === stop.id}
                                style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                                {markingStop === stop.id ? '⏳...' : tripType === 'morning' ? '✅ Picked Up' : '✅ Dropped'}
                              </button>
                              <button
                                onClick={() => markStop(stop, 'not_available')}
                                disabled={markingStop === stop.id}
                                style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                                ❌ Not Available
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Next stop indicator */}
                        {isNext && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(56,189,248,0.1)', borderRadius: '8px', color: '#38bdf8', fontSize: '12px', fontWeight: '600' }}>
                            ⬆️ Current Stop — Mark when {tripType === 'morning' ? 'child boards' : 'child is dropped'}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* School stop */}
                  <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: completedStops === activeStops.length ? 'linear-gradient(135deg, #10b981, #34d399)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      🏫
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#34d399' }}>School</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Final destination</div>
                    </div>
                  </div>
                </div>

                {/* End Trip */}
                <button onClick={endTrip} disabled={ending}
                  style={{ width: '100%', padding: '14px', background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#f87171', fontWeight: '700', fontSize: '16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {ending ? '⏳ Ending...' : '🛑 End Trip'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}