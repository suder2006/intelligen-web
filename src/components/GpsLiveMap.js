'use client'
import { useEffect, useRef, useState } from 'react'

// Live map for the admin Transport → GPS Integration tab: one marker per
// Livepin vehicle, labelled with its vehicle number, with speed / status /
// last update in a popup. Markers move in place on refresh so the admin's
// pan and zoom are kept. If the Maps JavaScript API cannot load for this key,
// it falls back to the Embed API used by the Live Tracking tab.

const GOOGLE_MAPS_API_KEY = 'AIzaSyAkK4Tr8r6339Pm4WDJL5e6wQA5h2yZzvI'

let mapsPromise = null
function loadGoogleMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    // Google calls this instead of failing the script when the key is not
    // allowed to use the JavaScript API.
    window.gm_authFailure = () => reject(new Error('Maps JavaScript API not authorised for this key'))
    window.__gpsLiveMapReady = () => resolve(window.google.maps)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=__gpsLiveMapReady`
    script.async = true
    script.onerror = () => reject(new Error('Could not load Google Maps'))
    document.head.appendChild(script)
  }).catch(e => { mapsPromise = null; throw e })
  return mapsPromise
}

const STATUS_COLORS = { RUNNING: '#10b981', IDLE: '#f59e0b', STOPPED: '#ef4444' }

function popupHtml(v) {
  const color = STATUS_COLORS[v.status] || '#64748b'
  const updated = v.updatedAt ? new Date(v.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  return `<div style="font-family:'DM Sans',sans-serif;color:#0f172a;min-width:170px">
    <div style="font-weight:700;font-size:14px;margin-bottom:4px">🚌 ${esc(v.vehicleNo)}</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:6px">${esc(v.routeNames)}</div>
    <div style="font-size:12px;margin-bottom:2px"><b style="color:${color}">${esc(v.status)}</b> · ${Math.round(v.speed || 0)} km/h</div>
    ${v.address ? `<div style="font-size:12px;color:#475569;margin-bottom:2px">📍 ${esc(v.address)}</div>` : ''}
    <div style="font-size:11px;color:#94a3b8">Updated ${updated}</div>
  </div>`
}

// vehicles: [{ vehicleNo, lat, lng, speed, status, address, updatedAt, routeNames }]
export default function GpsLiveMap({ vehicles, selected, onSelect, height = 460 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const infoRef = useRef(null)
  const fittedRef = useRef('')
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then(maps => {
      if (cancelled || !containerRef.current || mapRef.current) return
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: 13.0827, lng: 80.2707 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      })
      infoRef.current = new maps.InfoWindow()
      setReady(true)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  // Add, move, update and remove markers to match the latest locations.
  useEffect(() => {
    if (!ready) return
    const maps = window.google.maps
    const map = mapRef.current
    const seen = new Set()
    for (const v of vehicles) {
      seen.add(v.vehicleNo)
      const position = { lat: v.lat, lng: v.lng }
      const color = STATUS_COLORS[v.status] || '#64748b'
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        labelOrigin: new maps.Point(0, -2.6)
      }
      const label = { text: v.vehicleNo, color: '#0f172a', fontSize: '12px', fontWeight: '700', className: 'gps-marker-label' }
      let marker = markersRef.current[v.vehicleNo]
      if (!marker) {
        marker = new maps.Marker({ map, position, icon, label, title: v.vehicleNo })
        marker.addListener('click', () => onSelect?.(v.vehicleNo))
        markersRef.current[v.vehicleNo] = marker
      } else {
        marker.setPosition(position)
        marker.setIcon(icon)
        marker.setLabel(label)
      }
      marker.__vehicle = v
    }
    for (const [no, marker] of Object.entries(markersRef.current)) {
      if (!seen.has(no)) { marker.setMap(null); delete markersRef.current[no] }
    }

    // Fit to all vehicles only when the set of vehicles changes, not on every
    // refresh, so the admin's own pan and zoom survive the 30s update.
    const key = vehicles.map(v => v.vehicleNo).sort().join(',')
    if (key && key !== fittedRef.current) {
      fittedRef.current = key
      if (vehicles.length === 1) {
        map.setCenter({ lat: vehicles[0].lat, lng: vehicles[0].lng })
        map.setZoom(15)
      } else {
        const bounds = new maps.LatLngBounds()
        vehicles.forEach(v => bounds.extend({ lat: v.lat, lng: v.lng }))
        map.fitBounds(bounds, 60)
      }
    }

    const sel = selected && markersRef.current[selected]
    if (sel && infoRef.current) {
      infoRef.current.setContent(popupHtml(sel.__vehicle))
      if (infoRef.current.__for !== selected) {
        infoRef.current.open({ map, anchor: sel })
        infoRef.current.__for = selected
      }
    }
  }, [ready, vehicles, selected, onSelect])

  // Selecting a vehicle from the table pans to it and opens its popup.
  useEffect(() => {
    if (!ready || !selected) return
    const marker = markersRef.current[selected]
    if (!marker) return
    mapRef.current.panTo(marker.getPosition())
    infoRef.current.setContent(popupHtml(marker.__vehicle))
    infoRef.current.open({ map: mapRef.current, anchor: marker })
    infoRef.current.__for = selected
  }, [ready, selected])

  if (failed) {
    const v = vehicles.find(x => x.vehicleNo === selected) || vehicles[0]
    if (!v) return null
    return (
      <iframe
        key={`${v.vehicleNo}-${v.lat}-${v.lng}`}
        width="100%"
        height={height}
        style={{ border: 'none', display: 'block' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${v.lat},${v.lng}&zoom=15`}
      />
    )
  }

  return (
    <>
      <style>{`.gps-marker-label { background: #fff; padding: 2px 6px; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.35); }`}</style>
      <div ref={containerRef} style={{ width: '100%', height: `${height}px`, background: '#1e293b' }} />
    </>
  )
}
