'use client'
import { useEffect, useRef } from 'react'

export default function LiveMap({ vanLocation, homeLocation }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const vanMarkerRef = useRef(null)
  const homeMarkerRef = useRef(null)

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
      const center = vanLocation
        ? [vanLocation.lat, vanLocation.lng]
        : homeLocation
          ? [homeLocation.lat, homeLocation.lng]
          : [13.0827, 80.2707]

      const map = L.map(mapRef.current).setView(center, 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      // Van marker (bus icon)
      const vanIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1">🚌</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })

      // Home marker
      const homeIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1">🏠</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })

      if (vanLocation) {
        vanMarkerRef.current = L.marker([vanLocation.lat, vanLocation.lng], { icon: vanIcon })
          .addTo(map).bindPopup('🚌 School Van')
      }

      if (homeLocation) {
        homeMarkerRef.current = L.marker([homeLocation.lat, homeLocation.lng], { icon: homeIcon })
          .addTo(map).bindPopup('🏠 Your Home')
      }

      // Fit bounds if both markers exist
      if (vanLocation && homeLocation) {
        const bounds = L.latLngBounds(
          [vanLocation.lat, vanLocation.lng],
          [homeLocation.lat, homeLocation.lng]
        )
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        vanMarkerRef.current = null
        homeMarkerRef.current = null
      }
    }
  }, [])

// Update van marker when location changes
  useEffect(() => {
    if (!vanLocation || !mapInstanceRef.current) return
    import('leaflet').then(L => {
      const vanIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1">🚌</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
      if (vanMarkerRef.current) {
        // Move existing marker
        vanMarkerRef.current.setLatLng([vanLocation.lat, vanLocation.lng])
        // Pan map to follow van
        mapInstanceRef.current.panTo([vanLocation.lat, vanLocation.lng], { animate: true })
      } else {
        vanMarkerRef.current = L.marker([vanLocation.lat, vanLocation.lng], { icon: vanIcon })
          .addTo(mapInstanceRef.current).bindPopup('🚌 School Van')
        mapInstanceRef.current.setView([vanLocation.lat, vanLocation.lng], 15)
      }
    })
  }, [vanLocation?.lat, vanLocation?.lng])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '250px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }} />
  )
}