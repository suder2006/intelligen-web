'use client'
import { useEffect, useRef } from 'react'

export default function LiveMap({ vanLocation, homeLocation }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const vanMarkerRef = useRef(null)
  const homeMarkerRef = useRef(null)
  const LRef = useRef(null)
  // Always hold the latest props so the async map-init callback (and syncMarkers)
  // never work off a stale closure.
  const propsRef = useRef({ vanLocation, homeLocation })
  propsRef.current = { vanLocation, homeLocation }

  // Create or move the markers against the current map. Safe to call anytime:
  // it no-ops until both Leaflet and the map instance are ready, so init and
  // location updates share one path and no update is ever dropped.
  const syncMarkers = () => {
    const L = LRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return
    const { vanLocation, homeLocation } = propsRef.current

    if (homeLocation && !homeMarkerRef.current) {
      const homeIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1">🏠</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
      homeMarkerRef.current = L.marker([homeLocation.lat, homeLocation.lng], { icon: homeIcon })
        .addTo(map).bindPopup('🏠 Your Home')
    }

    if (!vanLocation) return
    const latlng = [vanLocation.lat, vanLocation.lng]
    if (vanMarkerRef.current) {
      // Move the existing marker so it visibly travels across the map.
      vanMarkerRef.current.setLatLng(latlng)
      // Only recenter when the van leaves the visible area — recentering on
      // every update would pin the marker to the middle and look frozen.
      if (!map.getBounds().contains(latlng)) {
        map.panTo(latlng, { animate: true })
      }
    } else {
      const vanIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1">🚌</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      })
      vanMarkerRef.current = L.marker(latlng, { icon: vanIcon })
        .addTo(map).bindPopup('🚌 School Van')
    }
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
      const { vanLocation, homeLocation } = propsRef.current
      const center = vanLocation
        ? [vanLocation.lat, vanLocation.lng]
        : homeLocation
          ? [homeLocation.lat, homeLocation.lng]
          : [13.0827, 80.2707]

      const map = L.map(mapRef.current).setView(center, 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      mapInstanceRef.current = map
      // Draw whatever location we already have.
      syncMarkers()

      // Frame both markers on first paint.
      if (vanLocation && homeLocation) {
        const bounds = L.latLngBounds(
          [vanLocation.lat, vanLocation.lng],
          [homeLocation.lat, homeLocation.lng]
        )
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        vanMarkerRef.current = null
        homeMarkerRef.current = null
      }
    }
  }, [])

  // Move the van marker whenever its location (or the home location) changes.
  useEffect(() => {
    syncMarkers()
  }, [vanLocation?.lat, vanLocation?.lng, homeLocation?.lat, homeLocation?.lng])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '250px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }} />
  )
}
