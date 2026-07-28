import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { schoolId, weekStart } = await request.json()

    if (!schoolId || !weekStart) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if plan already exists
    const { data: existing } = await supabase
      .from('yoga_plans')
      .select('id')
      .eq('school_id', schoolId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Plan already exists for this week!' }, { status: 409 })
    }

    // Call Claude API server-side
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Generate a fun weekly kids yoga plan for preschool children aged 2-6 years for Monday to Friday.

Requirements:
- Simple, fun and playful poses
- Age appropriate for 2-6 year olds
- Animal and nature themed poses
- Include breathing exercises
- Each day has 4 activities
- Include YouTube search terms for each pose

Return ONLY valid JSON, no other text:
{
  "monday": {
    "morning_pose": {
      "name": "Cat-Cow Stretch",
      "emoji": "🐱",
      "instructions": ["Get on hands and knees", "Breathe in arch your back", "Breathe out round your back", "Repeat 5 times"],
      "duration": "2 minutes",
      "benefit": "Warms up the spine",
      "youtube_search": "cat cow stretch for kids yoga"
    },
    "main_pose": {
      "name": "Tree Pose",
      "emoji": "🌳",
      "instructions": ["Stand tall", "Place one foot on ankle", "Raise arms like branches", "Hold 10 seconds each side"],
      "duration": "3 minutes",
      "benefit": "Builds balance and focus",
      "youtube_search": "tree pose kids yoga"
    },
    "breathing": {
      "name": "Bunny Breathing",
      "emoji": "🐰",
      "instructions": ["Take 3 quick sniffs in", "One long breath out", "Repeat 5 times"],
      "duration": "2 minutes",
      "benefit": "Calms the mind",
      "youtube_search": "bunny breathing kids yoga"
    },
    "relaxation": {
      "name": "Sleeping Star",
      "emoji": "⭐",
      "instructions": ["Lie on your back", "Spread arms and legs wide", "Close your eyes", "Take 5 deep breaths"],
      "duration": "3 minutes",
      "benefit": "Relaxes the body",
      "youtube_search": "relaxation kids yoga savasana"
    },
    "theme": "Forest Adventure",
    "overall_benefit": "Energy and focus for the day"
  },
  "tuesday": { "same structure" },
  "wednesday": { "same structure" },
  "thursday": { "same structure" },
  "friday": { "same structure" }
}`
        }]
      })
    })

    const data = await response.json()
    const content = data.content[0].text
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const plan = JSON.parse(cleanContent)

    // Save to database
    const { error: insertError } = await supabase
      .from('yoga_plans')
      .insert({
        school_id: schoolId,
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