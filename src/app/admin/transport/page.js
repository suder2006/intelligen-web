'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminSidebar from '@/components/AdminSidebar'
import { useSchool } from '@/hooks/useSchool'
import dynamic from 'next/dynamic'
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

export default function AdminTransportPage() {
  const { schoolId } = useSchool()
  const [view, setView] = useState('vehicles')
  const [loading, setLoading] = useState(true)

  // Data states
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [stops, setStops] = useState([])
  const [routes, setRoutes] = useState([])
  const [assignments, setAssignments] = useState([])
  const [requests, setRequests] = useState([])
  const [students, setStudents] = useState([])
  const [liveTrips, setLiveTrips] = useState([])
  const [liveLocations, setLiveLocations] = useState({})

  // Form states
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  // Vehicle form
  const [vehicleForm, setVehicleForm] = useState({
    name: '', registration_no: '', capacity: '', phone_number: '', status: 'active'
  })

  // Driver form
  const [driverForm, setDriverForm] = useState({
    name: '', phone: '', licence_number: '', licence_expiry: '', status: 'active', user_id: ''
  })

  // Stop form
  const [stopForm, setStopForm] = useState({
    name: '', address: '', latitude: '', longitude: '', landmark: '', status: 'active'
  })
  const [showStopMapPicker, setShowStopMapPicker] = useState(false)
  const [stopMapSearch, setStopMapSearch] = useState('')
  const [stopMapSearching, setStopMapSearching] = useState(false)
  const [stopPickedLocation, setStopPickedLocation] = useState(null)

  // Route form
  const [routeForm, setRouteForm] = useState({
    name: '', route_type: 'morning', vehicle_id: '', driver_id: '',
    departure_time: '07:55', arrival_time: '08:45',
    operating_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], status: 'active'
  })
  const [routeStops, setRouteStops] = useState([]) // stops added to route
  const [selectedRouteForStops, setSelectedRouteForStops] = useState(null)
  const [addingStopToRoute, setAddingStopToRoute] = useState(false)
  const [stopToAdd, setStopToAdd] = useState('')
  const [stopETA, setStopETA] = useState('')

  // Assignment form
  const [assignForm, setAssignForm] = useState({
    student_id: '', service_type: 'both',
    morning_route_id: '', morning_stop_id: '',
    afternoon_route_id: '', afternoon_stop_id: '',
    start_date: '', end_date: '', status: 'active'
  })

  // Request review
  const [reviewingRequest, setReviewingRequest] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewAction, setReviewAction] = useState('')

  const [liveInterval, setLiveInterval] = useState(null)

  const [dailyTrips, setDailyTrips] = useState([])
  const [tripChildren, setTripChildren] = useState([])
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [expandedTrip, setExpandedTrip] = useState(null)

  const [generatingTrips, setGeneratingTrips] = useState(false)
  const [showAddChildModal, setShowAddChildModal] = useState(null)
  const [addChildForm, setAddChildForm] = useState({ student_id: '', stop_id: '' })
  const [addingChild, setAddingChild] = useState(false)
  const [cancellingTrip, setCancellingTrip] = useState(null)

  useEffect(() => { if (schoolId) fetchAll() }, [schoolId])

  useEffect(() => {
    if (view === 'live') {
      fetchLiveData()
      const interval = setInterval(fetchLiveData, 15000)
      setLiveInterval(interval)
    } else {
      if (liveInterval) { clearInterval(liveInterval); setLiveInterval(null) }
    }
    return () => { if (liveInterval) clearInterval(liveInterval) }
  }, [view, schoolId])

  useEffect(() => {
  if (schoolId && view === 'trips') fetchDailyTrips(filterDate)
  }, [view, schoolId, filterDate])

  const fetchAll = async () => {
    setLoading(true)
    const [vRes, dRes, sRes, rRes, aRes, reqRes, stuRes] = await Promise.all([
      supabase.from('transport_vehicles').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('transport_staff').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('transport_stops').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('transport_routes').select('*, transport_vehicles(name, registration_no), transport_staff(name)').eq('school_id', schoolId).order('name'),
      supabase.from('transport_assignments').select('*, students(full_name, program), transport_routes!transport_assignments_morning_route_id_fkey(name), transport_stops!transport_assignments_morning_stop_id_fkey(name)').eq('school_id', schoolId).eq('status', 'active'),
      supabase.from('transport_requests').select('*, students(full_name, program), profiles(full_name, email)').eq('school_id', schoolId).order('created_at', { ascending: false }),
      supabase.from('students').select('*').eq('school_id', schoolId).eq('status', 'active').order('full_name')
    ])
    setVehicles(vRes.data || [])
    setDrivers(dRes.data || [])
    setStops(sRes.data || [])
    setRoutes(rRes.data || [])
    setAssignments(aRes.data || [])
    setRequests(reqRes.data || [])
    setStudents(stuRes.data || [])
    setLoading(false)
  }

  const fetchLiveData = async () => {
    if (!schoolId) return
    const { data: trips } = await supabase.from('transport_daily_trips')
      .select('*, transport_routes(name), transport_vehicles(name, registration_no), transport_staff(name)')
      .eq('school_id', schoolId).eq('status', 'in_progress')
      .eq('trip_date', new Date().toISOString().split('T')[0])
    setLiveTrips(trips || [])
    const locations = {}
    for (const trip of (trips || [])) {
      const { data: loc } = await supabase.from('transport_gps_locations')
        .select('*').eq('trip_id', trip.id)
        .order('timestamp', { ascending: false }).limit(1).maybeSingle()
      if (loc) locations[trip.id] = loc
    }
    setLiveLocations(locations)
  }

  const fetchDailyTrips = async (date) => {
  const { data } = await supabase.from('transport_daily_trips')
    .select('*, transport_routes(name, route_type), transport_vehicles(name, registration_no), transport_staff(name)')
    .eq('school_id', schoolId)
    .eq('trip_date', date)
    .order('scheduled_start')
  setDailyTrips(data || [])
  setTripChildren([])
  setExpandedTrip(null)
}

const fetchTripChildren = async (tripId) => {
  const { data } = await supabase.from('transport_trip_children')
    .select('*, students(full_name, program), transport_stops(name)')
    .eq('trip_id', tripId)
  setTripChildren(prev => [
    ...prev.filter(tc => tc.trip_id !== tripId),
    ...(data || [])
  ])
}

const generateTrips = async () => {
  if (!filterDate) return
  setGeneratingTrips(true)
  try {
    const date = new Date(filterDate + 'T12:00:00')
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayName = dayNames[date.getDay()]
    const { data: routes } = await supabase.from('transport_routes')
      .select('*, transport_vehicles(*), transport_staff(*)')
      .eq('school_id', schoolId).eq('status', 'active')
    if (!routes || routes.length === 0) { alert('No active routes found!'); setGeneratingTrips(false); return }
    const eligibleRoutes = routes.filter(r => r.operating_days?.includes(dayName))
    if (eligibleRoutes.length === 0) { alert(`No routes scheduled for ${dayName} (${filterDate}).`); setGeneratingTrips(false); return }
    let tripsCreated = 0
    let childrenAdded = 0
    for (const route of eligibleRoutes) {
      const { data: existing } = await supabase.from('transport_daily_trips')
        .select('id').eq('route_id', route.id).eq('trip_date', filterDate).maybeSingle()
      if (existing) continue
      const { data: trip } = await supabase.from('transport_daily_trips').insert({
        school_id: schoolId, route_id: route.id, vehicle_id: route.vehicle_id,
        driver_id: route.driver_id, trip_date: filterDate, trip_type: route.route_type,
        scheduled_start: route.departure_time, status: 'scheduled'
      }).select().single()
      if (!trip) continue
      tripsCreated++
      const assignmentField = route.route_type === 'morning' ? 'morning_route_id' : 'afternoon_route_id'
      const { data: assignments } = await supabase.from('transport_assignments')
        .select('student_id, morning_stop_id, afternoon_stop_id')
        .eq(assignmentField, route.id).eq('status', 'active')
        .lte('start_date', filterDate).or(`end_date.is.null,end_date.gte.${filterDate}`)
      if (!assignments || assignments.length === 0) continue
      const studentIds = assignments.map(a => a.student_id)
      const { data: exceptions } = await supabase.from('transport_exceptions')
        .select('student_id, exception_type').in('student_id', studentIds)
        .eq('trip_date', filterDate).in('status', ['approved', 'auto_approved'])
      const exceptionMap = {}
      for (const ex of (exceptions || [])) exceptionMap[ex.student_id] = ex.exception_type
      const tripChildren = []
      for (const a of assignments) {
        const ex = exceptionMap[a.student_id]
        if (route.route_type === 'morning' && ex === 'parent_drop') continue
        if (route.route_type === 'afternoon' && ex === 'parent_collect') continue
        const stopId = route.route_type === 'morning' ? a.morning_stop_id : a.afternoon_stop_id
        tripChildren.push({ trip_id: trip.id, student_id: a.student_id, stop_id: stopId, status: ex === 'absent' ? 'absent' : 'waiting' })
      }
      if (tripChildren.length > 0) {
        await supabase.from('transport_trip_children').insert(tripChildren)
        childrenAdded += tripChildren.length
      }
    }
    alert(`✅ Generated ${tripsCreated} trips with ${childrenAdded} children!`)
    await fetchDailyTrips(filterDate)
  } catch (e) { alert('Error: ' + e.message) }
  setGeneratingTrips(false)
}

const addChildToTrip = async () => {
  if (!addChildForm.student_id || !addChildForm.stop_id || !showAddChildModal) return
  setAddingChild(true)
  try {
    const { data: existing } = await supabase.from('transport_trip_children')
      .select('id').eq('trip_id', showAddChildModal.id)
      .eq('student_id', addChildForm.student_id).maybeSingle()
    if (existing) { alert('Child already in trip!'); setAddingChild(false); return }
    await supabase.from('transport_trip_children').insert({
      trip_id: showAddChildModal.id, student_id: addChildForm.student_id,
      stop_id: addChildForm.stop_id, status: 'waiting'
    })
    const { data: ps } = await supabase.from('parent_students')
      .select('parent_id').eq('student_id', addChildForm.student_id)
    if (ps && ps.length > 0) {
      const student = students.find(s => s.id === addChildForm.student_id)
      await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: ps.map(p => p.parent_id), title: '🚌 Transport Update',
          body: `${student?.full_name} has been added to today's ${showAddChildModal.transport_routes?.route_type} transport.`,
          url: '/parent', data: { type: 'transport' } }) })
    }
    setShowAddChildModal(null)
    setAddChildForm({ student_id: '', stop_id: '' })
    await fetchTripChildren(showAddChildModal.id)
    alert('✅ Child added!')
  } catch (e) { alert('Error: ' + e.message) }
  setAddingChild(false)
}

const removeChildFromTrip = async (tc, trip) => {
  if (!confirm(`Remove ${tc.students?.full_name} from this trip?`)) return
  await supabase.from('transport_trip_children').delete().eq('id', tc.id)
  const exceptionType = trip.trip_type === 'morning' ? 'parent_drop' : 'parent_collect'
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('transport_exceptions').insert({
    school_id: schoolId, student_id: tc.student_id, trip_date: trip.trip_date,
    exception_type: exceptionType, notes: 'Removed by admin',
    created_by: user.id, status: 'approved'
  })
  const { data: ps } = await supabase.from('parent_students')
    .select('parent_id').eq('student_id', tc.student_id)
  if (ps && ps.length > 0) {
    await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: ps.map(p => p.parent_id), title: '🚌 Transport Update',
        body: `${tc.students?.full_name} has been removed from today's ${trip.trip_type} transport.`,
        url: '/parent', data: { type: 'transport' } }) })
  }
  await fetchTripChildren(trip.id)
}

const cancelTrip = async (trip) => {
  if (!confirm(`Cancel ${trip.transport_routes?.name}?\nAll parents will be notified.`)) return
  setCancellingTrip(trip.id)
  await supabase.from('transport_daily_trips').update({ status: 'cancelled' }).eq('id', trip.id)
  const { data: children } = await supabase.from('transport_trip_children')
    .select('student_id').eq('trip_id', trip.id)
  if (children && children.length > 0) {
    const parentIds = []
    for (const child of children) {
      const { data: ps } = await supabase.from('parent_students').select('parent_id').eq('student_id', child.student_id)
      if (ps) parentIds.push(...ps.map(p => p.parent_id))
    }
    if (parentIds.length > 0) {
      await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...new Set(parentIds)], title: '🚌 Trip Cancelled',
          body: `Today's ${trip.trip_type} transport (${trip.transport_routes?.name}) has been cancelled.`,
          url: '/parent', data: { type: 'transport' } }) })
    }
  }
  setCancellingTrip(null)
  await fetchDailyTrips(filterDate)
  alert('✅ Trip cancelled and parents notified!')
}

  const fetchRouteStops = async (routeId) => {
    const { data } = await supabase.from('transport_route_stops')
      .select('*, transport_stops(name, address, latitude, longitude)')
      .eq('route_id', routeId).order('stop_order')
    setRouteStops(data || [])
  }

  // VEHICLE CRUD
  const saveVehicle = async () => {
    if (!vehicleForm.name || !vehicleForm.registration_no || !vehicleForm.capacity) {
      alert('Please fill required fields'); return
    }
    setSaving(true)
    if (editing) {
      await supabase.from('transport_vehicles').update(vehicleForm).eq('id', editing)
    } else {
      await supabase.from('transport_vehicles').insert({ ...vehicleForm, school_id: schoolId })
    }
    setShowForm(false); setEditing(null)
    setVehicleForm({ name: '', registration_no: '', capacity: '', phone_number: '', status: 'active' })
    await fetchAll(); setSaving(false)
  }

  const deleteVehicle = async (id) => {
    if (!confirm('Delete this vehicle?')) return
    await supabase.from('transport_vehicles').delete().eq('id', id)
    await fetchAll()
  }

  // DRIVER CRUD
  const saveDriver = async () => {
    if (!driverForm.name || !driverForm.phone) { alert('Please fill required fields'); return }
    setSaving(true)
    if (editing) {
      const updateData = { ...driverForm }
      if (!updateData.user_id) delete updateData.user_id
      if (!updateData.licence_expiry) delete updateData.licence_expiry
      await supabase.from('transport_staff').update(updateData).eq('id', editing)
    } else {
      const driverData = { ...driverForm, school_id: schoolId, role: 'driver' }
      if (!driverData.user_id) delete driverData.user_id
      if (!driverData.licence_expiry) delete driverData.licence_expiry
      await supabase.from('transport_staff').insert(driverData)
    }
    setShowForm(false); setEditing(null)
    setDriverForm({ name: '', phone: '', licence_number: '', licence_expiry: '', status: 'active', user_id: '' })
    await fetchAll(); setSaving(false)
  }

  const deleteDriver = async (id) => {
    if (!confirm('Delete this driver?')) return
    await supabase.from('transport_staff').delete().eq('id', id)
    await fetchAll()
  }

  // STOP CRUD
  const searchStopAddress = async () => {
    if (!stopMapSearch.trim()) return
    setStopMapSearching(true)
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(stopMapSearch)}&key=AIzaSyAkK4Tr8r6339Pm4WDJL5e6wQA5h2yZzvI&region=in`)
      const data = await res.json()
      if (data.status === 'OK' && data.results.length > 0) {
        const r = data.results[0]
        setStopPickedLocation({ lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address })
        setStopForm(prev => ({ ...prev, latitude: r.geometry.location.lat, longitude: r.geometry.location.lng, address: r.formatted_address }))
      } else { alert('Address not found') }
    } catch (e) { alert('Search failed') }
    setStopMapSearching(false)
  }

  const saveStop = async () => {
    if (!stopForm.name) { alert('Please enter stop name'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('transport_stops').update(stopForm).eq('id', editing)
    } else {
      await supabase.from('transport_stops').insert({ ...stopForm, school_id: schoolId })
    }
    setShowForm(false); setEditing(null)
    setStopForm({ name: '', address: '', latitude: '', longitude: '', landmark: '', status: 'active' })
    setStopPickedLocation(null); setStopMapSearch('')
    await fetchAll(); setSaving(false)
  }

  const deleteStop = async (id) => {
    if (!confirm('Delete this stop?')) return
    await supabase.from('transport_stops').delete().eq('id', id)
    await fetchAll()
  }

  // ROUTE CRUD
  const saveRoute = async () => {
    if (!routeForm.name || !routeForm.route_type) { alert('Please fill required fields'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('transport_routes').update(routeForm).eq('id', editing)
    } else {
      const { data } = await supabase.from('transport_routes').insert({ ...routeForm, school_id: schoolId }).select().single()
    }
    setShowForm(false); setEditing(null)
    setRouteForm({ name: '', route_type: 'morning', vehicle_id: '', driver_id: '', departure_time: '07:55', arrival_time: '08:45', operating_days: ['Mon','Tue','Wed','Thu','Fri'], status: 'active' })
    await fetchAll(); setSaving(false)
  }

  const deleteRoute = async (id) => {
    if (!confirm('Delete this route?')) return
    await supabase.from('transport_route_stops').delete().eq('route_id', id)
    await supabase.from('transport_routes').delete().eq('id', id)
    await fetchAll()
  }

  const addStopToRoute = async () => {
    if (!stopToAdd || !selectedRouteForStops) return
    setAddingStopToRoute(true)
    const maxOrder = routeStops.length > 0 ? Math.max(...routeStops.map(s => s.stop_order)) : 0
    await supabase.from('transport_route_stops').insert({
      route_id: selectedRouteForStops,
      stop_id: stopToAdd,
      stop_order: maxOrder + 1,
      estimated_arrival: stopETA || null
    })
    setStopToAdd(''); setStopETA('')
    await fetchRouteStops(selectedRouteForStops)
    setAddingStopToRoute(false)
  }

  const removeStopFromRoute = async (id) => {
    await supabase.from('transport_route_stops').delete().eq('id', id)
    await fetchRouteStops(selectedRouteForStops)
  }

  const moveRouteStop = async (stop, direction) => {
    const sorted = [...routeStops].sort((a, b) => a.stop_order - b.stop_order)
    const idx = sorted.findIndex(s => s.id === stop.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const swap = sorted[swapIdx]
    await Promise.all([
      supabase.from('transport_route_stops').update({ stop_order: swap.stop_order }).eq('id', stop.id),
      supabase.from('transport_route_stops').update({ stop_order: stop.stop_order }).eq('id', swap.id)
    ])
    await fetchRouteStops(selectedRouteForStops)
  }

  const copyRoute = async (route) => {
    const newName = `${route.name} (Copy)`
    const { data: newRoute } = await supabase.from('transport_routes').insert({
      school_id: schoolId, name: newName,
      route_type: route.route_type === 'morning' ? 'afternoon' : 'morning',
      vehicle_id: route.vehicle_id, driver_id: route.driver_id,
      departure_time: route.departure_time, arrival_time: route.arrival_time,
      operating_days: route.operating_days, status: route.status,
      copied_from_route_id: route.id
    }).select().single()
    if (newRoute) {
      // Copy stops too
      const { data: srcStops } = await supabase.from('transport_route_stops').select('*').eq('route_id', route.id).order('stop_order')
      if (srcStops && srcStops.length > 0) {
        await supabase.from('transport_route_stops').insert(
          srcStops.map(s => ({ route_id: newRoute.id, stop_id: s.stop_id, stop_order: s.stop_order, estimated_arrival: s.estimated_arrival }))
        )
      }
    }
    await fetchAll()
    alert(`✅ Route copied as "${newName}". Edit name and timings as needed.`)
  }

  // ASSIGNMENT CRUD
  const saveAssignment = async () => {
    if (!assignForm.student_id || !assignForm.service_type || !assignForm.start_date) {
      alert('Please fill required fields'); return
    }
    setSaving(true)
    if (editing) {
      await supabase.from('transport_assignments').update(assignForm).eq('id', editing)
    } else {
      await supabase.from('transport_assignments').insert({ ...assignForm, school_id: schoolId })
    }
    setShowForm(false); setEditing(null)
    setAssignForm({ student_id: '', service_type: 'both', morning_route_id: '', morning_stop_id: '', afternoon_route_id: '', afternoon_stop_id: '', start_date: '', end_date: '', status: 'active' })
    await fetchAll(); setSaving(false)
  }

  const deleteAssignment = async (id) => {
    if (!confirm('End this transport assignment?')) return
    await supabase.from('transport_assignments').update({ status: 'ended' }).eq('id', id)
    await fetchAll()
  }

  // REQUEST REVIEW
  const reviewRequest = async (action) => {
    if (!reviewingRequest) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('transport_requests').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_notes: reviewNote,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', reviewingRequest.id)
    setReviewingRequest(null); setReviewNote('')
    await fetchAll()
    alert(action === 'approve' ? '✅ Request approved!' : '❌ Request rejected.')
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const morningRoutes = routes.filter(r => r.route_type === 'morning')
  const afternoonRoutes = routes.filter(r => r.route_type === 'afternoon')

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }
  const labelStyle = { color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }

  const TABS = [
    ['vehicles', '🚌 Vehicles'],
    ['drivers', '👨‍✈️ Drivers'],
    ['stops', '📍 Stops'],
    ['routes', '🗺️ Routes'],
    ['assignments', '👶 Child Assignments'],
    ['trips', '📅 Daily Trips'],
    ['requests', '📋 Requests'],
    ['live', '🟢 Live Tracking'],
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: "'DM Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .main { margin-left: 240px; flex: 1; padding: 32px; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-danger { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 6px 12px; color: #f87171; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-edit { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); border-radius: 8px; padding: 6px 12px; color: #38bdf8; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; margin-bottom: 14px; }
        .view-tab { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
        .view-tab.active { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .view-tab:not(.active) { background: transparent; color: rgba(255,255,255,0.4); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 28px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
        .table-wrap { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; overflow: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 11px 14px; text-align: left; font-size: 12px; color: rgba(255,255,255,0.4); font-weight: 600; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.07); white-space: nowrap; }
        td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        @media (max-width: 768px) { .main { margin-left: 0; padding: 16px; } }
      `}</style>

      <AdminSidebar />

      <div className="main">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>🚌 Transport Management</h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '4px' }}>Manage vehicles, drivers, routes and child assignments</p>
          </div>
          {['vehicles','drivers','stops','routes','assignments'].includes(view) && (
            <button onClick={() => { setShowForm(true); setEditing(null) }} className="btn-primary">
              + Add {view === 'vehicles' ? 'Vehicle' : view === 'drivers' ? 'Driver' : view === 'stops' ? 'Stop' : view === 'routes' ? 'Route' : 'Assignment'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', flexWrap: 'wrap' }}>
          {TABS.map(([v, l]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Loading...</div> : (
          <>
            {/* ═══════════════════════════════ VEHICLES ═══════════════════════════════ */}
            {view === 'vehicles' && (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Total', value: vehicles.length, color: '#38bdf8' },
                    { label: 'Active', value: vehicles.filter(v => v.status === 'active').length, color: '#10b981' },
                    { label: 'Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length, color: '#f59e0b' },
                    { label: 'Inactive', value: vehicles.filter(v => v.status === 'inactive').length, color: '#f87171' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {vehicles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
                    <div>No vehicles yet. Click "+ Add Vehicle" to add one.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Vehicle</th><th>Registration</th><th>Capacity</th><th>Phone</th><th>Status</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {vehicles.map(v => (
                          <tr key={v.id}>
                            <td><div style={{ fontWeight: '600' }}>🚌 {v.name}</div></td>
                            <td style={{ color: '#fbbf24' }}>{v.registration_no}</td>
                            <td><span className="badge" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>👦 {v.capacity} children</span></td>
                            <td style={{ color: '#38bdf8' }}>{v.phone_number || '—'}</td>
                            <td>
                              <span className="badge" style={{
                                background: v.status === 'active' ? 'rgba(16,185,129,0.15)' : v.status === 'maintenance' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                color: v.status === 'active' ? '#34d399' : v.status === 'maintenance' ? '#fbbf24' : '#f87171'
                              }}>{v.status}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn-edit" onClick={() => {
                                  setEditing(v.id)
                                  setVehicleForm({ name: v.name, registration_no: v.registration_no, capacity: v.capacity, phone_number: v.phone_number || '', status: v.status })
                                  setShowForm(true)
                                }}>✏️ Edit</button>
                                <button className="btn-danger" onClick={() => deleteVehicle(v.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════ DRIVERS ═══════════════════════════════ */}
            {view === 'drivers' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Add drivers who will operate transport vehicles. Each driver gets a login to the driver app.
                </div>
                {drivers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👨‍✈️</div>
                    <div>No drivers yet. Click "+ Add Driver" to add one.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Driver</th><th>Phone</th><th>Licence</th><th>Expiry</th><th>Status</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {drivers.map(d => {
                          const isExpiring = d.licence_expiry && new Date(d.licence_expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          const isExpired = d.licence_expiry && new Date(d.licence_expiry) < new Date()
                          return (
                            <tr key={d.id}>
                              <td><div style={{ fontWeight: '600' }}>👨‍✈️ {d.name}</div></td>
                              <td style={{ color: '#38bdf8' }}>{d.phone || '—'}</td>
                              <td style={{ color: 'rgba(255,255,255,0.6)' }}>{d.licence_number || '—'}</td>
                              <td>
                                {d.licence_expiry ? (
                                  <span style={{ color: isExpired ? '#f87171' : isExpiring ? '#fbbf24' : '#34d399', fontSize: '12px' }}>
                                    {isExpired ? '❌' : isExpiring ? '⚠️' : '✅'} {d.licence_expiry}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>
                                <span className="badge" style={{
                                  background: d.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                  color: d.status === 'active' ? '#34d399' : '#f87171'
                                }}>{d.status}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button className="btn-edit" onClick={() => {
                                    setEditing(d.id)
                                    setDriverForm({ name: d.name, phone: d.phone || '', licence_number: d.licence_number || '', licence_expiry: d.licence_expiry || '', status: d.status, user_id: d.user_id || '' })
                                    setShowForm(true)
                                  }}>✏️ Edit</button>
                                  <button className="btn-danger" onClick={() => deleteDriver(d.id)}>🗑️</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════ STOPS ═══════════════════════════════ */}
            {view === 'stops' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Stops are shared pickup/drop locations. Multiple children can share the same stop.
                </div>
                {stops.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
                    <div>No stops yet. Click "+ Add Stop" to create one.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Stop Name</th><th>Address</th><th>Landmark</th><th>Location</th><th>Status</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {stops.map(s => (
                          <tr key={s.id}>
                            <td><div style={{ fontWeight: '600' }}>📍 {s.name}</div></td>
                            <td style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '200px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address || '—'}</div>
                            </td>
                            <td style={{ color: 'rgba(255,255,255,0.4)' }}>{s.landmark || '—'}</td>
                            <td>
                              {s.latitude && s.longitude ? (
                                <span style={{ color: '#10b981', fontSize: '12px' }}>✅ Set</span>
                              ) : (
                                <span style={{ color: '#f87171', fontSize: '12px' }}>❌ Not set</span>
                              )}
                            </td>
                            <td>
                              <span className="badge" style={{
                                background: s.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: s.status === 'active' ? '#34d399' : '#f87171'
                              }}>{s.status}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn-edit" onClick={() => {
                                  setEditing(s.id)
                                  setStopForm({ name: s.name, address: s.address || '', latitude: s.latitude || '', longitude: s.longitude || '', landmark: s.landmark || '', status: s.status })
                                  if (s.latitude && s.longitude) setStopPickedLocation({ lat: s.latitude, lng: s.longitude, address: s.address })
                                  setShowForm(true)
                                }}>✏️ Edit</button>
                                <button className="btn-danger" onClick={() => deleteStop(s.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════ ROUTES ═══════════════════════════════ */}
            {view === 'routes' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Routes define the order of stops for morning pickup and afternoon drop. Morning and afternoon are separate routes.
                </div>

                {/* Morning Routes */}
                <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '12px', color: '#38bdf8' }}>🌅 Morning Routes ({morningRoutes.length})</div>
                {morningRoutes.length === 0 ? (
                  <div className="card" style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px' }}>No morning routes yet.</div>
                ) : morningRoutes.map(r => (
                  <RouteCard key={r.id} route={r}
                    onEdit={() => {
                      setEditing(r.id)
                      setRouteForm({ name: r.name, route_type: r.route_type, vehicle_id: r.vehicle_id || '', driver_id: r.driver_id || '', departure_time: r.departure_time || '07:55', arrival_time: r.arrival_time || '08:45', operating_days: r.operating_days || ['Mon','Tue','Wed','Thu','Fri'], status: r.status })
                      setShowForm(true)
                    }}
                    onDelete={() => deleteRoute(r.id)}
                    onCopy={() => copyRoute(r)}
                    onManageStops={() => { setSelectedRouteForStops(r.id); fetchRouteStops(r.id) }}
                    selectedRoute={selectedRouteForStops}
                    routeStops={routeStops}
                    stops={stops}
                    stopToAdd={stopToAdd}
                    setStopToAdd={setStopToAdd}
                    stopETA={stopETA}
                    setStopETA={setStopETA}
                    addingStopToRoute={addingStopToRoute}
                    onAddStop={addStopToRoute}
                    onRemoveStop={removeStopFromRoute}
                    onMoveStop={moveRouteStop}
                  />
                ))}

                {/* Afternoon Routes */}
                <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '12px', marginTop: '24px', color: '#a78bfa' }}>🏠 Afternoon Routes ({afternoonRoutes.length})</div>
                {afternoonRoutes.length === 0 ? (
                  <div className="card" style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px' }}>No afternoon routes yet. Use "Copy to Afternoon" on a morning route to create one quickly.</div>
                ) : afternoonRoutes.map(r => (
                  <RouteCard key={r.id} route={r}
                    onEdit={() => {
                      setEditing(r.id)
                      setRouteForm({ name: r.name, route_type: r.route_type, vehicle_id: r.vehicle_id || '', driver_id: r.driver_id || '', departure_time: r.departure_time || '12:30', arrival_time: r.arrival_time || '13:30', operating_days: r.operating_days || ['Mon','Tue','Wed','Thu','Fri'], status: r.status })
                      setShowForm(true)
                    }}
                    onDelete={() => deleteRoute(r.id)}
                    onCopy={() => copyRoute(r)}
                    onManageStops={() => { setSelectedRouteForStops(r.id); fetchRouteStops(r.id) }}
                    selectedRoute={selectedRouteForStops}
                    routeStops={routeStops}
                    stops={stops}
                    stopToAdd={stopToAdd}
                    setStopToAdd={setStopToAdd}
                    stopETA={stopETA}
                    setStopETA={setStopETA}
                    addingStopToRoute={addingStopToRoute}
                    onAddStop={addStopToRoute}
                    onRemoveStop={removeStopFromRoute}
                    onMoveStop={moveRouteStop}
                  />
                ))}
              </>
            )}

            {/* ═══════════════════════════════ ASSIGNMENTS ═══════════════════════════════ */}
            {view === 'assignments' && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '20px' }}>
                  Assign children to routes and stops. This determines which trips they appear in automatically.
                </div>

                {assignments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>👶</div>
                    <div>No assignments yet. Click "+ Add Assignment" to assign a child to transport.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Child</th><th>Service</th><th>Morning Route</th><th>Morning Stop</th><th>Afternoon Route</th><th>Start Date</th><th>Status</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {assignments.map(a => {
                          const afternoonRoute = routes.find(r => r.id === a.afternoon_route_id)
                          const afternoonStop = stops.find(s => s.id === a.afternoon_stop_id)
                          return (
                            <tr key={a.id}>
                              <td>
                                <div style={{ fontWeight: '600' }}>{a.students?.full_name}</div>
                                <div style={{ color: '#a78bfa', fontSize: '11px' }}>{a.students?.program}</div>
                              </td>
                              <td>
                                <span className="badge" style={{
                                  background: a.service_type === 'both' ? 'rgba(56,189,248,0.15)' : a.service_type === 'morning' ? 'rgba(245,158,11,0.15)' : 'rgba(167,139,250,0.15)',
                                  color: a.service_type === 'both' ? '#38bdf8' : a.service_type === 'morning' ? '#fbbf24' : '#a78bfa'
                                }}>
                                  {a.service_type === 'both' ? '↕️ Both' : a.service_type === 'morning' ? '🌅 Morning' : '🏠 Afternoon'}
                                </span>
                              </td>
                              <td style={{ color: 'rgba(255,255,255,0.6)' }}>{a.transport_routes?.name || '—'}</td>
                              <td style={{ color: 'rgba(255,255,255,0.6)' }}>{a.transport_stops?.name || '—'}</td>
                              <td style={{ color: 'rgba(255,255,255,0.6)' }}>{afternoonRoute?.name || '—'}</td>
                              <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{a.start_date}</td>
                              <td>
                                <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>{a.status}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button className="btn-edit" onClick={() => {
                                    setEditing(a.id)
                                    setAssignForm({ student_id: a.student_id, service_type: a.service_type, morning_route_id: a.morning_route_id || '', morning_stop_id: a.morning_stop_id || '', afternoon_route_id: a.afternoon_route_id || '', afternoon_stop_id: a.afternoon_stop_id || '', start_date: a.start_date || '', end_date: a.end_date || '', status: a.status })
                                    setShowForm(true)
                                  }}>✏️</button>
                                  <button className="btn-danger" onClick={() => deleteAssignment(a.id)}>🔚 End</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════ REQUESTS ═══════════════════════════════ */}
            {view === 'requests' && (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, color: '#f59e0b' },
                    { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, color: '#10b981' },
                    { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, color: '#f87171' },
                    { label: 'Total', value: requests.length, color: '#38bdf8' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {requests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                    <div>No transport requests yet.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Date</th><th>Child</th><th>Type</th><th>Service</th><th>Pickup Address</th><th>Status</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {requests.map(r => (
                          <tr key={r.id}>
                            <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{r.students?.full_name}</div>
                              <div style={{ color: '#a78bfa', fontSize: '11px' }}>{r.students?.program}</div>
                            </td>
                            <td>
                              <span className="badge" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '11px' }}>
                                {r.request_type?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{r.service_type || '—'}</td>
                            <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', maxWidth: '150px' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.pickup_address || '—'}
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{
                                background: r.status === 'pending' ? 'rgba(245,158,11,0.15)' : r.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: r.status === 'pending' ? '#fbbf24' : r.status === 'approved' ? '#34d399' : '#f87171'
                              }}>{r.status}</span>
                            </td>
                            <td>
                              <button className="btn-edit" onClick={() => { setReviewingRequest(r); setReviewNote(r.admin_notes || '') }}>
                                👁️ Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════ DAILY TRIPS ═══════════════════════════════ */}
            {view === 'trips' && (
              <>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <input type='date' value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    style={{ padding: '9px 14px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', fontSize: '14px' }} />
                  <button onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                    style={{ padding: '9px 16px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                    Today
                  </button>
                  <button onClick={generateTrips} disabled={generatingTrips}
                    style={{ padding: '9px 18px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif" }}>
                    {generatingTrips ? '⏳ Generating...' : '🔄 Generate Trips'}
                  </button>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>{dailyTrips.length} trips</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'Total', value: dailyTrips.length, color: '#38bdf8' },
                    { label: 'Scheduled', value: dailyTrips.filter(t => t.status === 'scheduled').length, color: '#f59e0b' },
                    { label: 'In Progress', value: dailyTrips.filter(t => t.status === 'in_progress').length, color: '#10b981' },
                    { label: 'Completed', value: dailyTrips.filter(t => t.status === 'completed').length, color: '#a78bfa' },
                    { label: 'Cancelled', value: dailyTrips.filter(t => t.status === 'cancelled').length, color: '#f87171' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {dailyTrips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>No trips for {filterDate}</div>
                    <div style={{ fontSize: '13px' }}>Click "🔄 Generate Trips" to create trips for this date</div>
                  </div>
                ) : dailyTrips.map(trip => {
                  const isExpanded = expandedTrip === trip.id
                  const children = tripChildren.filter(tc => tc.trip_id === trip.id)
                  const statusColor = { scheduled: '#f59e0b', in_progress: '#10b981', completed: '#a78bfa', cancelled: '#f87171' }[trip.status] || '#38bdf8'
                  return (
                    <div key={trip.id} className="card" style={{ marginBottom: '12px', opacity: trip.status === 'cancelled' ? 0.7 : 1, borderColor: trip.status === 'in_progress' ? 'rgba(16,185,129,0.3)' : trip.status === 'cancelled' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', fontSize: '16px' }}>
                              {trip.transport_routes?.route_type === 'morning' ? '🌅' : '🏠'} {trip.transport_routes?.name}
                            </span>
                            <span className="badge" style={{ background: statusColor + '22', color: statusColor }}>
                              {trip.status === 'scheduled' ? '⏰ Scheduled' : trip.status === 'in_progress' ? '🟢 In Progress' : trip.status === 'completed' ? '✅ Completed' : '❌ Cancelled'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                            {trip.transport_vehicles && <span style={{ color: '#fbbf24' }}>🚌 {trip.transport_vehicles.name} · {trip.transport_vehicles.registration_no}</span>}
                            {trip.transport_staff && <span style={{ color: 'rgba(255,255,255,0.5)' }}>👨‍✈️ {trip.transport_staff.name}</span>}
                            {trip.scheduled_start && <span style={{ color: '#38bdf8' }}>⏰ {trip.scheduled_start?.substring(0,5)}</span>}
                            {trip.actual_start && <span style={{ color: '#10b981' }}>▶️ {new Date(trip.actual_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                            {trip.actual_end && <span style={{ color: '#a78bfa' }}>🏁 {new Date(trip.actual_end).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {trip.status !== 'cancelled' && trip.status !== 'completed' && (
                            <>
                              <button onClick={() => { setShowAddChildModal(trip); setAddChildForm({ student_id: '', stop_id: '' }) }}
                                style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', color: '#34d399', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
                                ➕ Add Child
                              </button>
                              <button onClick={() => cancelTrip(trip)} disabled={cancellingTrip === trip.id}
                                style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                                {cancellingTrip === trip.id ? '⏳' : '❌ Cancel'}
                              </button>
                            </>
                          )}
                          <button onClick={async () => {
                            if (isExpanded) setExpandedTrip(null)
                            else { setExpandedTrip(trip.id); await fetchTripChildren(trip.id) }
                          }} style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                            {isExpanded ? '▲ Hide' : '▼ Children'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '14px' }}>
                          <div style={{ fontWeight: '600', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>👶 Children ({children.length})</div>
                          {children.length === 0 ? (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No children in this trip.</div>
                          ) : children.map(tc => {
                            const cColor = { waiting: '#f59e0b', boarded: '#10b981', dropped: '#a78bfa', absent: '#f87171' }[tc.status] || '#38bdf8'
                            return (
                              <div key={tc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', color: '#fff' }}>
                                    {tc.students?.full_name?.[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{tc.students?.full_name}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>📍 {tc.transport_stops?.name} · {tc.students?.program}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span className="badge" style={{ background: cColor + '22', color: cColor }}>
                                    {tc.status === 'waiting' ? '⏳ Waiting' : tc.status === 'boarded' ? '✅ Boarded' : tc.status === 'dropped' ? '🏠 Dropped' : tc.status === 'absent' ? '❌ Absent' : tc.status}
                                  </span>
                                  {tc.boarded_at && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{new Date(tc.boarded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                                  {trip.status !== 'cancelled' && trip.status !== 'completed' && tc.status === 'waiting' && (
                                    <button onClick={() => removeChildFromTrip(tc, trip)}
                                      style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>
                                      🗑️ Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add Child Modal */}
                {showAddChildModal && (
                  <div className="modal-overlay" onClick={() => setShowAddChildModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>➕ Add Child to Trip</h3>
                      <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>
                        {showAddChildModal.transport_routes?.route_type === 'morning' ? '🌅' : '🏠'} {showAddChildModal.transport_routes?.name} · {showAddChildModal.trip_date}
                      </div>
                      <label style={labelStyle}>Select Child *</label>
                      <select value={addChildForm.student_id} onChange={e => setAddChildForm({...addChildForm, student_id: e.target.value})} style={inputStyle}>
                        <option value=''>-- Select Child --</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.program})</option>)}
                      </select>
                      <label style={labelStyle}>Select Stop *</label>
                      <select value={addChildForm.stop_id} onChange={e => setAddChildForm({...addChildForm, stop_id: e.target.value})} style={inputStyle}>
                        <option value=''>-- Select Stop --</option>
                        {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button onClick={() => setShowAddChildModal(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                        <button onClick={addChildToTrip} disabled={addingChild || !addChildForm.student_id || !addChildForm.stop_id} className="btn-primary" style={{ flex: 1 }}>
                          {addingChild ? '⏳ Adding...' : '➕ Add Child'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}  

            {/* ═══════════════════════════════ LIVE TRACKING ═══════════════════════════════ */}
            {view === 'live' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>🟢 Live Van Tracking</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                      {liveTrips.length > 0 ? `${liveTrips.length} active trip${liveTrips.length > 1 ? 's' : ''} today` : 'No active trips right now'} · Updates every 15 sec
                    </div>
                  </div>
                  <button onClick={fetchLiveData} className="btn-secondary">🔄 Refresh</button>
                </div>

                {liveTrips.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>No Active Trips</div>
                    <div style={{ fontSize: '13px' }}>Live map appears when driver starts a trip</div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                      {liveTrips.map(trip => {
                        const loc = liveLocations[trip.id]
                        return (
                          <div key={trip.id} className="card" style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ fontWeight: '700', color: '#34d399' }}>🚌 {trip.transport_routes?.name}</div>
                              <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>🟢 Live</span>
                            </div>
                            <div style={{ color: '#fbbf24', fontSize: '12px', marginBottom: '4px' }}>{trip.transport_vehicles?.name} · {trip.transport_vehicles?.registration_no}</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>👨‍✈️ {trip.transport_staff?.name}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>
                              {trip.trip_type === 'morning' ? '🌅 Morning Pickup' : '🏠 Afternoon Drop'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
                              Started: {trip.actual_start ? new Date(trip.actual_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                            {loc && (
                              <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                                📡 {new Date(loc.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                {loc.speed > 0 && ` · ${(loc.speed * 3.6).toFixed(0)} km/h`}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                      🗺️ Interactive live map coming soon. GPS coordinates are being tracked.
                    </div>
                  </>
                )}
              </>
            )}


          </>
        )}
      </div>

      {/* ═══════════════════════════════ VEHICLE FORM MODAL ═══════════════════════════════ */}
      {showForm && view === 'vehicles' && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editing ? '✏️ Edit Vehicle' : '🚌 Add Vehicle'}</h3>
            <label style={labelStyle}>Vehicle Name *</label>
            <input value={vehicleForm.name} onChange={e => setVehicleForm({...vehicleForm, name: e.target.value})} placeholder='e.g. Van 1, School Bus A' style={inputStyle} autoFocus />
            <label style={labelStyle}>Registration Number *</label>
            <input value={vehicleForm.registration_no} onChange={e => setVehicleForm({...vehicleForm, registration_no: e.target.value})} placeholder='e.g. TN02AB1234' style={inputStyle} />
            <label style={labelStyle}>Child Capacity *</label>
            <input type='number' value={vehicleForm.capacity} onChange={e => setVehicleForm({...vehicleForm, capacity: e.target.value})} placeholder='e.g. 10' style={inputStyle} />
            <label style={labelStyle}>Van Phone Number</label>
            <input value={vehicleForm.phone_number} onChange={e => setVehicleForm({...vehicleForm, phone_number: e.target.value})} placeholder='+91 98765 43210' style={inputStyle} />
            <label style={labelStyle}>Status</label>
            <select value={vehicleForm.status} onChange={e => setVehicleForm({...vehicleForm, status: e.target.value})} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='maintenance'>Under Maintenance</option>
              <option value='inactive'>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveVehicle} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Vehicle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ DRIVER FORM MODAL ═══════════════════════════════ */}
      {showForm && view === 'drivers' && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editing ? '✏️ Edit Driver' : '👨‍✈️ Add Driver'}</h3>
            <label style={labelStyle}>Full Name *</label>
            <input value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} placeholder='Driver full name' style={inputStyle} autoFocus />
            <label style={labelStyle}>Phone Number *</label>
            <input value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} placeholder='+91 98765 43210' style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Licence Number</label>
                <input value={driverForm.licence_number} onChange={e => setDriverForm({...driverForm, licence_number: e.target.value})} placeholder='TN0120230001234' style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Licence Expiry</label>
                <input type='date' value={driverForm.licence_expiry} onChange={e => setDriverForm({...driverForm, licence_expiry: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <label style={labelStyle}>Status</label>
            <select value={driverForm.status} onChange={e => setDriverForm({...driverForm, status: e.target.value})} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveDriver} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Driver'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ STOP FORM MODAL ═══════════════════════════════ */}
      {showForm && view === 'stops' && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editing ? '✏️ Edit Stop' : '📍 Add Stop'}</h3>
            <label style={labelStyle}>Stop Name *</label>
            <input value={stopForm.name} onChange={e => setStopForm({...stopForm, name: e.target.value})} placeholder='e.g. Anna Nagar Main Road' style={inputStyle} autoFocus />
            <label style={labelStyle}>Landmark</label>
            <input value={stopForm.landmark} onChange={e => setStopForm({...stopForm, landmark: e.target.value})} placeholder='e.g. Near Reliance Fresh' style={inputStyle} />

            {/* Address Search */}
            <label style={labelStyle}>Search Address & Set Location</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input value={stopMapSearch} onChange={e => setStopMapSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchStopAddress()}
                placeholder='Search address e.g. Anna Nagar, Chennai' style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button onClick={searchStopAddress} disabled={stopMapSearching}
                style={{ padding: '10px 16px', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', color: '#38bdf8', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                {stopMapSearching ? '⏳' : '🔍 Search'}
              </button>
            </div>

            {stopPickedLocation && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ color: '#34d399', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>📍 Location Set</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{stopPickedLocation.address}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{parseFloat(stopPickedLocation.lat).toFixed(6)}, {parseFloat(stopPickedLocation.lng).toFixed(6)}</div>
              </div>
            )}

            <label style={labelStyle}>Full Address</label>
            <input value={stopForm.address} onChange={e => setStopForm({...stopForm, address: e.target.value})} placeholder='Full address' style={inputStyle} />
            <label style={labelStyle}>Status</label>
            <select value={stopForm.status} onChange={e => setStopForm({...stopForm, status: e.target.value})} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveStop} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Stop'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ ROUTE FORM MODAL ═══════════════════════════════ */}
      {showForm && view === 'routes' && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editing ? '✏️ Edit Route' : '🗺️ Add Route'}</h3>
            <label style={labelStyle}>Route Name *</label>
            <input value={routeForm.name} onChange={e => setRouteForm({...routeForm, name: e.target.value})} placeholder='e.g. Anna Nagar Morning Route' style={inputStyle} autoFocus />
            <label style={labelStyle}>Route Type *</label>
            <select value={routeForm.route_type} onChange={e => setRouteForm({...routeForm, route_type: e.target.value})} style={inputStyle}>
              <option value='morning'>🌅 Morning Pickup</option>
              <option value='afternoon'>🏠 Afternoon Drop</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Vehicle</label>
                <select value={routeForm.vehicle_id} onChange={e => setRouteForm({...routeForm, vehicle_id: e.target.value})} style={inputStyle}>
                  <option value=''>-- Select Vehicle --</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_no})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Driver</label>
                <select value={routeForm.driver_id} onChange={e => setRouteForm({...routeForm, driver_id: e.target.value})} style={inputStyle}>
                  <option value=''>-- Select Driver --</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Departure Time</label>
                <input type='time' value={routeForm.departure_time} onChange={e => setRouteForm({...routeForm, departure_time: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Expected Arrival</label>
                <input type='time' value={routeForm.arrival_time} onChange={e => setRouteForm({...routeForm, arrival_time: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <label style={labelStyle}>Operating Days</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {days.map(d => (
                <button key={d} onClick={() => {
                  const current = routeForm.operating_days || []
                  setRouteForm({...routeForm, operating_days: current.includes(d) ? current.filter(x => x !== d) : [...current, d]})
                }} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${(routeForm.operating_days || []).includes(d) ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`, background: (routeForm.operating_days || []).includes(d) ? 'rgba(56,189,248,0.15)' : 'transparent', color: (routeForm.operating_days || []).includes(d) ? '#38bdf8' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                  {d}
                </button>
              ))}
            </div>
            <label style={labelStyle}>Status</label>
            <select value={routeForm.status} onChange={e => setRouteForm({...routeForm, status: e.target.value})} style={inputStyle}>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveRoute} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Route'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════ ASSIGNMENT FORM MODAL ═══════════════════════════════ */}
      {showForm && view === 'assignments' && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>{editing ? '✏️ Edit Assignment' : '👶 Add Child Assignment'}</h3>
            <label style={labelStyle}>Child *</label>
            <select value={assignForm.student_id} onChange={e => setAssignForm({...assignForm, student_id: e.target.value})} style={inputStyle}>
              <option value=''>-- Select Child --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.program})</option>)}
            </select>
            <label style={labelStyle}>Service Type *</label>
            <select value={assignForm.service_type} onChange={e => setAssignForm({...assignForm, service_type: e.target.value})} style={inputStyle}>
              <option value='both'>↕️ Morning Pickup + Afternoon Drop</option>
              <option value='morning'>🌅 Morning Pickup Only</option>
              <option value='afternoon'>🏠 Afternoon Drop Only</option>
            </select>

            {(assignForm.service_type === 'both' || assignForm.service_type === 'morning') && (
              <>
                <div style={{ fontWeight: '600', color: '#38bdf8', fontSize: '13px', marginBottom: '8px', marginTop: '4px' }}>🌅 Morning Assignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Morning Route</label>
                    <select value={assignForm.morning_route_id} onChange={e => setAssignForm({...assignForm, morning_route_id: e.target.value})} style={inputStyle}>
                      <option value=''>-- Select Route --</option>
                      {morningRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Pickup Stop</label>
                    <select value={assignForm.morning_stop_id} onChange={e => setAssignForm({...assignForm, morning_stop_id: e.target.value})} style={inputStyle}>
                      <option value=''>-- Select Stop --</option>
                      {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {(assignForm.service_type === 'both' || assignForm.service_type === 'afternoon') && (
              <>
                <div style={{ fontWeight: '600', color: '#a78bfa', fontSize: '13px', marginBottom: '8px', marginTop: '4px' }}>🏠 Afternoon Assignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Afternoon Route</label>
                    <select value={assignForm.afternoon_route_id} onChange={e => setAssignForm({...assignForm, afternoon_route_id: e.target.value})} style={inputStyle}>
                      <option value=''>-- Select Route --</option>
                      {afternoonRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Drop Stop</label>
                    <select value={assignForm.afternoon_stop_id} onChange={e => setAssignForm({...assignForm, afternoon_stop_id: e.target.value})} style={inputStyle}>
                      <option value=''>-- Select Stop --</option>
                      {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input type='date' value={assignForm.start_date} onChange={e => setAssignForm({...assignForm, start_date: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Date (optional)</label>
                <input type='date' value={assignForm.end_date} onChange={e => setAssignForm({...assignForm, end_date: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveAssignment} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Assignment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST REVIEW MODAL */}
      {reviewingRequest && (
        <div className="modal-overlay" onClick={() => setReviewingRequest(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>📋 Review Transport Request</h3>
            <div style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '20px' }}>{reviewingRequest.students?.full_name} · {reviewingRequest.students?.program}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Request Type', value: reviewingRequest.request_type?.replace(/_/g, ' ') },
                { label: 'Service', value: reviewingRequest.service_type || '—' },
                { label: 'Start Date', value: reviewingRequest.start_date || '—' },
                { label: 'Status', value: reviewingRequest.status },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {reviewingRequest.pickup_address && (
              <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>🌅 Pickup Address</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{reviewingRequest.pickup_address}</div>
                {reviewingRequest.pickup_latitude && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>{reviewingRequest.pickup_latitude}, {reviewingRequest.pickup_longitude}</div>}
              </div>
            )}
            {reviewingRequest.drop_address && (
              <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>🏠 Drop Address</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{reviewingRequest.drop_address}</div>
              </div>
            )}
            {reviewingRequest.notes && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '4px' }}>Parent Notes</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{reviewingRequest.notes}</div>
              </div>
            )}
            <label style={labelStyle}>Admin Notes</label>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              placeholder='Add notes...' rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            {reviewingRequest.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={() => setReviewingRequest(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => reviewRequest('reject')}
                  style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  ❌ Reject
                </button>
                <button onClick={() => reviewRequest('approve')} className="btn-primary" style={{ flex: 1 }}>✅ Approve</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setReviewingRequest(null)} className="btn-secondary">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Route Card Component
function RouteCard({ route, onEdit, onDelete, onCopy, onManageStops, selectedRoute, routeStops, stops, stopToAdd, setStopToAdd, stopETA, setStopETA, addingStopToRoute, onAddStop, onRemoveStop, onMoveStop }) {
  const isSelected = selectedRoute === route.id
  const vehicle = route.transport_vehicles
  const driver = route.transport_staff
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isSelected ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>
            {route.route_type === 'morning' ? '🌅' : '🏠'} {route.name}
            {route.copied_from_route_id && <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>copied</span>}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', marginBottom: '8px' }}>
            {vehicle && <span style={{ color: '#fbbf24' }}>🚌 {vehicle.name} ({vehicle.registration_no})</span>}
            {driver && <span style={{ color: 'rgba(255,255,255,0.5)' }}>👨‍✈️ {driver.name}</span>}
            {route.departure_time && <span style={{ color: '#38bdf8' }}>⏰ {route.departure_time} → {route.arrival_time}</span>}
            {route.operating_days && <span style={{ color: 'rgba(255,255,255,0.4)' }}>📅 {route.operating_days.join(', ')}</span>}
          </div>
          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: route.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: route.status === 'active' ? '#34d399' : '#f87171' }}>{route.status}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={onManageStops} style={{ padding: '6px 12px', background: isSelected ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>
            📍 {isSelected ? 'Hide' : 'Manage'} Stops
          </button>
          <button onClick={onCopy} style={{ padding: '6px 12px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>📋 Copy</button>
          <button onClick={onEdit} style={{ padding: '6px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>✏️</button>
          <button onClick={onDelete} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>🗑️</button>
        </div>
      </div>
      {isSelected && (
        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '16px' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px', color: '#38bdf8' }}>📍 Stop Order ({routeStops.length} stops)</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <select value={stopToAdd} onChange={e => setStopToAdd(e.target.value)}
              style={{ flex: 1, minWidth: '150px', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }}>
              <option value=''>-- Add Stop --</option>
              {stops.filter(s => !routeStops.find(rs => rs.stop_id === s.id)).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input type='time' value={stopETA} onChange={e => setStopETA(e.target.value)}
              style={{ width: '110px', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none' }} />
            <button onClick={onAddStop} disabled={!stopToAdd || addingStopToRoute}
              style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              {addingStopToRoute ? '⏳' : '+ Add'}
            </button>
          </div>
          {routeStops.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No stops yet. Add stops above.</div>
          ) : (
            <>
              {[...routeStops].sort((a, b) => a.stop_order - b.stop_order).map((rs, idx) => (
                <div key={rs.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#38bdf8', flexShrink: 0 }}>{rs.stop_order}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{rs.transport_stops?.name}</div>
                    {rs.transport_stops?.address && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{rs.transport_stops.address}</div>}
                  </div>
                  {rs.estimated_arrival && <span style={{ color: '#38bdf8', fontSize: '12px' }}>⏰ {rs.estimated_arrival}</span>}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => onMoveStop(rs, -1)} disabled={idx === 0}
                      style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: idx === 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '11px' }}>▲</button>
                    <button onClick={() => onMoveStop(rs, 1)} disabled={idx === routeStops.length - 1}
                      style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: idx === routeStops.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: idx === routeStops.length - 1 ? 'default' : 'pointer', fontSize: '11px' }}>▼</button>
                    <button onClick={() => onRemoveStop(rs.id)}
                      style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🏫</div>
                <div style={{ fontWeight: '600', fontSize: '13px', color: '#34d399' }}>School {route.route_type === 'morning' ? '(Destination)' : '(Start)'}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}