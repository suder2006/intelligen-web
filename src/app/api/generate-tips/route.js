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

    // Check if tips already exist
    const { data: existing } = await supabase
      .from('daily_tips')
      .select('id')
      .eq('school_id', schoolId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Tips already exist for this week!' }, { status: 409 })
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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate 7 daily parenting tips for parents of preschool children aged 2-6 years in India for each day of the week.

Requirements:
- Practical and actionable tips
- Indian context and culture
- Age appropriate for 2-6 year olds
- Short and easy to read (2-3 sentences max)
- Rotate categories: Parenting, Nutrition, Activity, Child Development, Health, School Readiness, Family Fun
- Warm and encouraging tone
- No scary or negative content

Return ONLY valid JSON, no other text:
{
  "monday": {
    "tip": "Reading just 10 minutes daily with your child before bedtime improves vocabulary by 3x before age 6. Try reading a short story together tonight!",
    "category": "Child Development",
    "emoji": "📚",
    "share_text": "💡 Parenting Tip from intelliGen:\n\nReading just 10 minutes daily with your child before bedtime improves vocabulary by 3x before age 6. Try reading a short story together tonight!\n\n📲 intelliGen School App"
  },
  "tuesday": { "same structure", "category": "Nutrition", "emoji": "🥗" },
  "wednesday": { "same structure", "category": "Activity", "emoji": "🎨" },
  "thursday": { "same structure", "category": "Health", "emoji": "🏥" },
  "friday": { "same structure", "category": "School Readiness", "emoji": "📖" },
  "saturday": { "same structure", "category": "Family Fun", "emoji": "👨‍👩‍👧" },
  "sunday": { "same structure", "category": "Parenting", "emoji": "💝" }
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
    const tips = JSON.parse(cleanContent)

    // Save to database
    const { error: insertError } = await supabase
      .from('daily_tips')
      .insert({
        school_id: schoolId,
        week_start_date: weekStart,
        monday: tips.monday,
        tuesday: tips.tuesday,
        wednesday: tips.wednesday,
        thursday: tips.thursday,
        friday: tips.friday,
        saturday: tips.saturday,
        sunday: tips.sunday,
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