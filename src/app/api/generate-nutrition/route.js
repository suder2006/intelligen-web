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
      .from('nutrition_plans')
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
          content: `Generate a healthy Indian nutrition meal plan for preschool children aged 2-6 years for a full week (Monday to Friday).

Requirements:
- South Indian / Tamil Nadu style meals preferred
- Age appropriate portions for 2-6 year olds
- Balanced nutrition each day
- Variety across the week (no repetition)
- Include breakfast, morning snack, lunch, evening snack, dinner
- Include key nutrients and child benefits

Return ONLY valid JSON, no other text:
{
  "monday": {
    "breakfast": "meal description",
    "morning_snack": "snack description",
    "lunch": "meal description",
    "evening_snack": "snack description",
    "dinner": "meal description",
    "nutrients": ["Protein: dal and curd", "Calcium: milk"],
    "benefits": ["💪 Protein supports muscle growth", "🦴 Calcium builds strong bones"]
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

    const { error: insertError } = await supabase
      .from('nutrition_plans')
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