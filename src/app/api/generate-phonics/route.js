import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ROLES = ['school_admin', 'teacher']

// Generates draft content for one phonics lesson. Nothing is saved here —
// the admin reviews and edits the fields, then saves from the page.
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
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!ALLOWED_ROLES.includes(profile?.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { program, moduleTitle, lessonTitle, lessonDescription } = await request.json()

    if (!program || !lessonTitle) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
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
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are creating content for a phonics lesson in a preschool app used by schools and parents in India.

Program: ${program}
Module: ${moduleTitle || '(none)'}
Lesson: ${lessonTitle}
Lesson description: ${lessonDescription || '(none)'}

Requirements:
- Age appropriate for ${program} children (Playgroup ~2-3 yrs, Nursery ~3-4 yrs, LKG ~4-5 yrs, UKG ~5-6 yrs)
- Simple, familiar words from the Indian context where natural
- activity_text: a fun, hands-on activity a parent can do at home in 5-10 minutes (3-5 short sentences)
- parent_tip: one practical tip for the parent on teaching this sound/skill (2-3 sentences)
- example_words: 5-8 example words that clearly demonstrate the lesson's sound, each with a fitting emoji
- Warm and encouraging tone

Return ONLY valid JSON, no other text:
{
  "activity_text": "...",
  "parent_tip": "...",
  "example_words": [
    { "word": "apple", "emoji": "🍎" }
  ]
}`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) {
      return Response.json({ error: data.error?.message || 'AI request failed' }, { status: 502 })
    }
    const content = data.content[0].text
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const generated = JSON.parse(cleanContent)

    return Response.json({
      activity_text: generated.activity_text || '',
      parent_tip: generated.parent_tip || '',
      example_words: Array.isArray(generated.example_words) ? generated.example_words : []
    })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
