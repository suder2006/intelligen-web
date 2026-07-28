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
      .from('story_plans')
      .select('id')
      .eq('school_id', schoolId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (existing) {
      return Response.json({ error: 'Story plan already exists for this week!' }, { status: 409 })
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
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: `Generate 5 short Indian children's stories for preschool children aged 2-6 years for Monday to Friday.

Requirements:
- Indian themes, characters, settings
- Animal stories, moral stories, nature stories, festival stories
- Age appropriate language (simple words)
- Warm, positive, no scary content, no monsters, no violence
- Medium length (~300-400 words each)
- Include 3 simple questions for parents to ask child
- Include one fun activity suggestion
- Strong moral value in each story

Return ONLY valid JSON, no other text:
{
  "monday": {
    "title": "The Kind Elephant",
    "category": "Animal Story",
    "emoji": "🐘",
    "story": "Full story text here (300-400 words)...",
    "moral": "Kindness makes the world a better place",
    "questions": [
      "What was the elephant's name?",
      "How did the elephant help his friends?",
      "How did helping others make the elephant feel?"
    ],
    "activity": {
      "title": "Draw and Share!",
      "description": "Draw your favourite animal from the story and share it with someone you love!"
    }
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
      .from('story_plans')
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