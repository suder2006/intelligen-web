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
    errors: []
  }

  try {
    await handleBirthdays(results)
  } catch (e) {
    results.errors.push(e.message)
    console.error('Cron error:', e)
  }

  return Response.json({ success: true, results })
}

async function handleBirthdays(results) {
  // Get today's date in IST
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(istDate.getUTCDate()).padStart(2, '0')
  const todayIST = `${istDate.getUTCFullYear()}-${mm}-${dd}`
  const monthDay = `${mm}-${dd}`

  console.log(`Checking birthdays for ${todayIST} (${monthDay})`)

  // Get all active students with today's birthday
  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, program, school_id, date_of_birth')
    .eq('status', 'active')
    .like('date_of_birth', `%-${monthDay}`)

  if (error) { console.error('Birthday fetch error:', error); return }

  results.birthdays.checked = students?.length || 0
  console.log(`Found ${results.birthdays.checked} birthdays today`)

  if (!students || students.length === 0) return

  // Group students by school
  const bySchool = {}
  for (const student of students) {
    if (!bySchool[student.school_id]) bySchool[student.school_id] = []
    bySchool[student.school_id].push(student)
  }

  // Process each school separately
  for (const [schoolId, schoolStudents] of Object.entries(bySchool)) {

    // Check which students already got notification today
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

    console.log(`School ${schoolId}: notifying ${toNotify.length} birthdays`)

    // Get all profiles for this school
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('school_id', schoolId)

    const allUserIds = (allProfiles || [])
      .filter(p => ['parent', 'teacher', 'staff', 'school_admin'].includes(p.role))
      .map(p => p.id)

    // Step 1: Send individual push to each birthday child's parents
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

      // Log individual notification
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

    // Step 2: Build combined announcement
    const announcementTitle = toNotify.length === 1
      ? `🎂 Happy Birthday ${toNotify[0].full_name}!`
      : `🎂 Today's Birthdays! (${toNotify.length} students)`

    const nameList = toNotify
      .map(s => `🎂 ${s.full_name} (${s.program})`)
      .join('\n')

    const announcementContent = toNotify.length === 1
      ? `Wishing ${toNotify[0].full_name} from ${toNotify[0].program} a very Happy Birthday! 🎉🎈\n\nMay this special day be filled with joy and wonderful memories! 🎂`
      : `Let's wish our little stars a very Happy Birthday! 🎉\n\n${nameList}\n\nMay their special days be filled with joy and wonderful memories! 🎂🎈`

    // Step 3: Save announcement to DB
    // This shows in admin, teacher and parent portals!
    await supabase.from('announcements').insert({
      school_id: schoolId,
      title: announcementTitle,
      content: announcementContent,
      created_at: new Date().toISOString()
    })

    results.birthdays.announcement = true

    // Step 4: Send combined push to ALL parents + teachers + admins
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