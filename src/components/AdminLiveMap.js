'use client'
import { useEffect, useRef } from 'react'

export default function AdminLiveMap({ trips, locations }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    import('leaflet').then(L => {
      if (mapInstanceRef.current) return

      // Default center: Chennai
      const map = L.map(mapRef.current).setView([13.0827, 80.2707], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      // Add markers for each van
      const bounds = []
      trips.forEach(trip => {
        const loc = locations[trip.id]
        if (!loc) return
        const lat = parseFloat(loc.latitude)
        const lng = parseFloat(loc.longitude)

        const vanIcon = L.divIcon({
          html: `<div style="background:#0ea5e9;border:2px solid #38bdf8;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚌</div>`,
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })

        const marker = L.marker([lat, lng], { icon: vanIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:160px">
              <div style="font-weight:700;margin-bottom:4px">🚌 ${trip.transport_routes?.name}</div>
              ${trip.transport_routes?.vehicle_number ? `<div>🚌 ${trip.transport_routes.vehicle_number}</div>` : ''}
              ${trip.transport_routes?.profiles?.full_name ? `<div>👨‍✈️ ${trip.transport_routes.profiles.full_name}</div>` : ''}
              <div style="color:#666;font-size:11px;margin-top:4px">
                ${loc.speed > 0 ? `Speed: ${(loc.speed * 3.6).toFixed(0)} km/h` : 'Stationary'}
              </div>
              <div style="color:#666;font-size:11px">
                Last update: ${new Date(loc.timestamp).toLocaleTimeString()}
              </div>
            </div>
          `)

        markersRef.current[trip.id] = marker
        bounds.push([lat, lng])
      })

      if (bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 15)
        } else {
          map.fitBounds(bounds, { padding: [50, 50] })
        }
      }

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
      }
    }
  }, [])

// Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current) return
    import('leaflet').then(L => {
      trips.forEach(trip => {
        const loc = locations[trip.id]
        if (!loc) return
        const lat = parseFloat(loc.latitude)
        const lng = parseFloat(loc.longitude)
        const marker = markersRef.current[trip.id]
        if (marker) {
          // Update existing marker position
          marker.setLatLng([lat, lng])
          marker.setPopupContent(`
            <div style="font-family:sans-serif;min-width:160px">
              <div style="font-weight:700;margin-bottom:4px">🚌 ${trip.transport_routes?.name}</div>
              ${trip.transport_routes?.vehicle_number ? `<div>🚌 ${trip.transport_routes.vehicle_number}</div>` : ''}
              ${trip.transport_routes?.profiles?.full_name ? `<div>👨‍✈️ ${trip.transport_routes.profiles.full_name}</div>` : ''}
              <div style="color:#666;font-size:11px;margin-top:4px">
                ${loc.speed > 0 ? `Speed: ${(parseFloat(loc.speed) * 3.6).toFixed(0)} km/h` : 'Stationary'}
              </div>
              <div style="color:#666;font-size:11px">
                Last update: ${new Date(loc.timestamp).toLocaleTimeString()}
              </div>
            </div>
          `)
        } else if (mapInstanceRef.current) {
          // Create new marker if doesn't exist
          const vanIcon = L.divIcon({
            html: `<div style="background:#0ea5e9;border:2px solid #38bdf8;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚌</div>`,
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          })
          const newMarker = L.marker([lat, lng], { icon: vanIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<div style="font-family:sans-serif"><div style="font-weight:700">🚌 ${trip.transport_routes?.name}</div></div>`)
          markersRef.current[trip.id] = newMarker
        }
      })
    })
  }, [locations, trips])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '500px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }} />
  )
}