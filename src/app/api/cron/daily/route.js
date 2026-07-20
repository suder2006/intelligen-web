import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    birthdays: { checked: 0, sent: 0, announcement: false },
    transport: { trips_created: 0, children_added: 0, skipped: 0 },
    errors: []
  }

  try {
    await handleBirthdays(results)
  } catch (e) {
    results.errors.push(`Birthday error: ${e.message}`)
    console.error('Birthday cron error:', e)
  }

  try {
    await handleTransportTrips(results)
  } catch (e) {
    results.errors.push(`Transport error: ${e.message}`)
    console.error('Transport cron error:', e)
  }

  return Response.json({ success: true, results })
}

// ═══════════════════════════════════════════════════════════
// TRANSPORT TRIP GENERATION
// ═══════════════════════════════════════════════════════════
async function handleTransportTrips(results) {
  // Get today's date in IST
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  const todayIST = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`

  // Get day of week (Mon, Tue, Wed, Thu, Fri, Sat)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const todayDayName = dayNames[istDate.getUTCDay()]

  console.log(`Generating transport trips for ${todayIST} (${todayDayName})`)

  // Skip Sunday
  if (todayDayName === 'Sun') {
    console.log('Sunday - skipping transport trip generation')
    results.transport.skipped++
    return
  }

  // Get all active routes that operate today
  const { data: routes, error: routesError } = await supabase
    .from('transport_routes')
    .select('*, transport_vehicles(*)')
    .eq('status', 'active')
    .contains('operating_days', [todayDayName])

  if (routesError) {
    console.error('Routes fetch error:', routesError)
    return
  }

  console.log(`Found ${routes?.length || 0} active routes for today`)

  if (!routes || routes.length === 0) return

  for (const route of routes) {
    // Check if trip already exists for today
    const { data: existingTrip } = await supabase
      .from('transport_daily_trips')
      .select('id')
      .eq('route_id', route.id)
      .eq('trip_date', todayIST)
      .maybeSingle()

    if (existingTrip) {
      console.log(`Trip already exists for route ${route.name} on ${todayIST}`)
      results.transport.skipped++
      continue
    }

    // Create daily trip
    const { data: trip, error: tripError } = await supabase
      .from('transport_daily_trips')
      .insert({
        school_id: route.school_id,
        route_id: route.id,
        vehicle_id: route.vehicle_id,
        driver_id: route.driver_id,
        trip_date: todayIST,
        trip_type: route.route_type,
        scheduled_start: route.departure_time,
        status: 'scheduled'
      })
      .select()
      .single()

    if (tripError) {
      console.error(`Trip creation error for route ${route.name}:`, tripError)
      results.errors.push(`Trip creation failed for ${route.name}`)
      continue
    }

    results.transport.trips_created++
    console.log(`Created trip for route ${route.name} (${route.route_type})`)

    // Get active assignments for this route
    const assignmentField = route.route_type === 'morning'
      ? 'morning_route_id'
      : 'afternoon_route_id'

    const stopField = route.route_type === 'morning'
      ? 'morning_stop_id'
      : 'afternoon_stop_id'

    const { data: assignments } = await supabase
      .from('transport_assignments')
      .select('student_id, morning_stop_id, afternoon_stop_id, service_type')
      .eq(assignmentField, route.id)
      .eq('status', 'active')
      .lte('start_date', todayIST)
      .or(`end_date.is.null,end_date.gte.${todayIST}`)

    if (!assignments || assignments.length === 0) {
      console.log(`No assignments for route ${route.name}`)
      continue
    }

    // Check for exceptions (absent, parent_drop, parent_collect)
    const studentIds = assignments.map(a => a.student_id)
    const { data: exceptions } = await supabase
      .from('transport_exceptions')
      .select('student_id, exception_type')
      .in('student_id', studentIds)
      .eq('trip_date', todayIST)
      .in('status', ['approved', 'auto_approved'])

    const exceptionMap = {}
    for (const ex of (exceptions || [])) {
      exceptionMap[ex.student_id] = ex.exception_type
    }

    // Add children to trip
    const tripChildren = []
    for (const assignment of assignments) {
      const exception = exceptionMap[assignment.student_id]

      // Skip if parent_drop (morning) or parent_collect (afternoon)
      if (route.route_type === 'morning' && exception === 'parent_drop') {
        console.log(`Skipping ${assignment.student_id} - parent will drop`)
        continue
      }
      if (route.route_type === 'afternoon' && exception === 'parent_collect') {
        console.log(`Skipping ${assignment.student_id} - parent will collect`)
        continue
      }

      const stopId = route.route_type === 'morning'
        ? assignment.morning_stop_id
        : assignment.afternoon_stop_id

      tripChildren.push({
        trip_id: trip.id,
        student_id: assignment.student_id,
        stop_id: stopId,
        status: exception === 'absent' ? 'absent' : 'waiting'
      })
    }

    if (tripChildren.length > 0) {
      const { error: childrenError } = await supabase
        .from('transport_trip_children')
        .insert(tripChildren)

      if (childrenError) {
        console.error('Trip children insert error:', childrenError)
      } else {
        results.transport.children_added += tripChildren.length
        console.log(`Added ${tripChildren.length} children to trip ${route.name}`)
      }
    }
  }

  console.log(`Transport cron complete: ${results.transport.trips_created} trips, ${results.transport.children_added} children ✅`)
}

// ═══════════════════════════════════════════════════════════
// BIRTHDAY WISHES
// ═══════════════════════════════════════════════════════════
async function handleBirthdays(results) {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(istDate.getUTCDate()).padStart(2, '0')
  const todayIST = `${istDate.getUTCFullYear()}-${mm}-${dd}`
  const monthDay = `${mm}-${dd}`

  console.log(`Checking birthdays for ${todayIST} (${monthDay})`)

  const { data: allStudents, error } = await supabase
    .from('students')
    .select('id, full_name, program, school_id, date_of_birth')
    .eq('status', 'active')
    .not('date_of_birth', 'is', null)

  const students = (allStudents || []).filter(s => {
    const dob = new Date(s.date_of_birth)
    return (dob.getUTCMonth() + 1) === parseInt(mm) &&
           dob.getUTCDate() === parseInt(dd)
  })

  if (error) { console.error('Birthday fetch error:', error); return }

  results.birthdays.checked = students?.length || 0
  console.log(`Found ${results.birthdays.checked} birthdays today`)

  if (!students || students.length === 0) return

  const bySchool = {}
  for (const student of students) {
    if (!bySchool[student.school_id]) bySchool[student.school_id] = []
    bySchool[student.school_id].push(student)
  }

  for (const [schoolId, schoolStudents] of Object.entries(bySchool)) {
    const { data: alreadySent } = await supabase
      .from('birthday_notifications')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('notification_date', todayIST)

    const alreadySentIds = (alreadySent || []).map(n => n.student_id)
    const toNotify = schoolStudents.filter(s => !alreadySentIds.includes(s.id))

    if (toNotify.length === 0) {
      console.log(`School ${schoolId}: all birthdays already notified`)
      continue
    }

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('school_id', schoolId)

    const allUserIds = (allProfiles || [])
      .filter(p => ['parent', 'teacher', 'staff', 'school_admin'].includes(p.role))
      .map(p => p.id)

    for (const student of toNotify) {
      const { data: parentLinks } = await supabase
        .from('parent_students')
        .select('parent_id')
        .eq('student_id', student.id)

      const parentIds = (parentLinks || []).map(p => p.parent_id)

      if (parentIds.length > 0) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: parentIds,
              title: `🎂 Happy Birthday ${student.full_name}!`,
              body: `Today is ${student.full_name}'s special day! 🎉 Wishing your little one a wonderful birthday filled with joy and laughter! 🎈`,
              url: '/parent',
              data: { type: 'announcement' }
            })
          })
        } catch (e) {
          console.error('Individual push error:', e)
        }
      }

      await supabase.from('birthday_notifications').insert({
        student_id: student.id,
        school_id: schoolId,
        notification_date: todayIST,
        sent_at: new Date().toISOString(),
        message: `Happy Birthday ${student.full_name}!`,
        created_at: new Date().toISOString()
      })

      results.birthdays.sent++
    }

    const announcementTitle = toNotify.length === 1
      ? `🎂 Happy Birthday ${toNotify[0].full_name}!`
      : `🎂 Today's Birthdays! (${toNotify.length} students)`

    const nameList = toNotify.map(s => `🎂 ${s.full_name} (${s.program})`).join('\n')

    const announcementContent = toNotify.length === 1
      ? `Wishing ${toNotify[0].full_name} from ${toNotify[0].program} a very Happy Birthday! 🎉🎈\n\nMay this special day be filled with joy and wonderful memories! 🎂`
      : `Let's wish our little stars a very Happy Birthday! 🎉\n\n${nameList}\n\nMay their special days be filled with joy and wonderful memories! 🎂🎈`

    await supabase.from('announcements').insert({
      school_id: schoolId,
      title: announcementTitle,
      content: announcementContent,
      created_at: new Date().toISOString()
    })

    results.birthdays.announcement = true

    if (allUserIds.length > 0) {
      const combinedBody = toNotify.length === 1
        ? `🎂 ${toNotify[0].full_name} (${toNotify[0].program}) is celebrating their birthday today! 🎉`
        : `🎂 ${toNotify.length} students are celebrating birthdays today! ${toNotify.map(s => s.full_name.split(' ')[0]).join(', ')} 🎉`

      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: allUserIds,
            title: announcementTitle,
            body: combinedBody,
            url: '/parent',
            data: { type: 'announcement' }
          })
        })
      } catch (e) {
        console.error('Combined push error:', e)
      }
    }

    console.log(`School ${schoolId}: birthday cron complete ✅`)
  }
}