'use client'
import { useEffect, useRef } from 'react'

export default function AdminLiveMap({ trips, locations }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})
  const LRef = useRef(null)
  // Always hold the latest props so the async map-init callback (and syncMarkers)
  // never work off a stale closure.
  const propsRef = useRef({ trips, locations })
  propsRef.current = { trips, locations }

  const buildPopup = (trip, loc) => `
    <div style="font-family:sans-serif;min-width:160px">
      <div style="font-weight:700;margin-bottom:4px">🚌 ${trip.transport_routes?.name}</div>
      ${trip.transport_routes?.vehicle_number ? `<div>🚌 ${trip.transport_routes.vehicle_number}</div>` : ''}
      ${trip.transport_routes?.profiles?.full_name ? `<div>👨‍✈️ ${trip.transport_routes.profiles.full_name}</div>` : ''}
      <div style="color:#666;font-size:11px;margin-top:4px">
        ${parseFloat(loc.speed) > 0 ? `Speed: ${(parseFloat(loc.speed) * 3.6).toFixed(0)} km/h` : 'Stationary'}
      </div>
      <div style="color:#666;font-size:11px">
        Last update: ${new Date(loc.timestamp).toLocaleTimeString()}
      </div>
    </div>
  `

  // Create or move a marker per active trip against the current map. Safe to
  // call anytime: it no-ops until Leaflet and the map are ready, so init and
  // location updates share one path and no update is ever dropped.
  const syncMarkers = () => {
    const L = LRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return
    const { trips, locations } = propsRef.current

    const liveIds = new Set()
    trips.forEach(trip => {
      const loc = locations[trip.id]
      if (!loc) return
      const id = String(trip.id)
      liveIds.add(id)
      const lat = parseFloat(loc.latitude)
      const lng = parseFloat(loc.longitude)
      const existing = markersRef.current[id]
      if (existing) {
        existing.setLatLng([lat, lng])
        existing.setPopupContent(buildPopup(trip, loc))
      } else {
        const vanIcon = L.divIcon({
          html: `<div style="background:#0ea5e9;border:2px solid #38bdf8;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚌</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
        markersRef.current[id] = L.marker([lat, lng], { icon: vanIcon })
          .addTo(map)
          .bindPopup(buildPopup(trip, loc))
      }
    })

    // Drop markers for trips that are no longer live.
    Object.keys(markersRef.current).forEach(id => {
      if (!liveIds.has(id)) {
        map.removeLayer(markersRef.current[id])
        delete markersRef.current[id]
      }
    })
  }

  // Create the map exactly once.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || mapInstanceRef.current || !mapRef.current) return
      LRef.current = L

      // Default center: Chennai
      const map = L.map(mapRef.current).setView([13.0827, 80.2707], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      mapInstanceRef.current = map
      syncMarkers()

      // Frame all vans on first paint.
      const { trips, locations } = propsRef.current
      const bounds = trips
        .map(trip => locations[trip.id])
        .filter(Boolean)
        .map(loc => [parseFloat(loc.latitude), parseFloat(loc.longitude)])
      if (bounds.length === 1) {
        map.setView(bounds[0], 15)
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
      }
    }
  }, [])

  // Move markers whenever locations (or the set of trips) change.
  useEffect(() => {
    syncMarkers()
  }, [locations, trips])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '500px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }} />
  )
}
