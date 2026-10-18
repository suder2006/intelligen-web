import { createClient } from '@supabase/supabase-js'
import { STORY_DAYS, generateStories, getRecentStorySummaries } from '@/lib/storyGenerator'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const maxDuration = 300

const ALLOWED_ROLES = ['school_admin']

// Without planId: generates a new Mon-Fri plan for { weekStart, program }.
// With planId + day: regenerates that one day of an existing plan.
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
    if (!ALLOWED_ROLES.includes(profile?.role) || !profile?.school_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = profile.school_id

    const { weekStart, program, planId, day } = await request.json()

    if (planId) {
      if (!STORY_DAYS.includes(day)) {
        return Response.json({ error: 'Invalid day' }, { status: 400 })
      }
      const { data: plan } = await supabase
        .from('story_plans')
        .select('*')
        .eq('id', planId)
        .eq('school_id', schoolId)
        .maybeSingle()
      if (!plan) {
        return Response.json({ error: 'Story plan not found' }, { status: 404 })
      }
      if (!plan.program) {
        return Response.json({ error: 'Older stories without a program cannot be regenerated' }, { status: 400 })
      }

      const recentSummaries = await getRecentStorySummaries(supabase, {
        schoolId,
        program: plan.program,
        weekStart: plan.week_start_date,
        extraStories: STORY_DAYS.map(d => plan[d]),
      })
      const generated = await generateStories({ program: plan.program, days: [day], recentSummaries })

      const { error: updateError } = await supabase
        .from('story_plans')
        .update({ [day]: generated[day] })
        .eq('id', plan.id)
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
      }
      return Response.json({ success: true, story: generated[day] })
    }

    if (!weekStart || !program) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if plan already exists
    const { data: existing } = await supabase
      .from('story_plans')
      .select('id')
      .eq('school_id', schoolId)
      .eq('program', program)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: `${program} stories already exist for this week!` }, { status: 409 })
    }

    const recentSummaries = await getRecentStorySummaries(supabase, { schoolId, program, weekStart })
    const plan = await generateStories({ program, recentSummaries })

    // Save to database
    const { error: insertError } = await supabase
      .from('story_plans')
      .insert({
        school_id: schoolId,
        program,
        week_start_date: weekStart,
        monday: plan.monday,
        tuesday: plan.tuesday,
        wednesday: plan.wednesday,
        thursday: plan.thursday,
        friday: plan.friday,
        generated_by_ai: true,
        edited_by_admin: false
      })

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    return Response.json({ success: true, weekStart })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
