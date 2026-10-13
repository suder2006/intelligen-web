export const dynamic = 'force-dynamic'
import { authorizeAdmin } from '@/lib/adminAuth'

const MAX_LINES = 120 // per list, to keep the prompt a sensible size for large classes

const SYSTEM_PROMPT = 'You are an expert early childhood education consultant analyzing student progress data for a preschool in India. Your role is to identify patterns in student development and provide practical, actionable recommendations for teachers and administrators.'

const area = (r) => [r.development_area, r.skill_area, r.indicator].filter(Boolean).join(' › ')

// One line per student: "Aarav: Fine Motor › Cutting › Cuts on a line (achieved → emerging, severe); ..."
function listByStudent(rows) {
  const byStudent = {}
  rows.forEach(r => { (byStudent[r.student_name] ||= []).push(`${area(r)} (${r.from_rating} → ${r.to_rating}, ${r.severity})`) })
  const lines = Object.entries(byStudent).map(([name, items]) => `- ${name}: ${items.join('; ')}`)
  if (!lines.length) return 'None'
  return lines.length > MAX_LINES
    ? [...lines.slice(0, MAX_LINES), `...and ${lines.length - MAX_LINES} more students`].join('\n')
    : lines.join('\n')
}

function buildPrompt({ program, from_month, to_month, prev_month, rows, consecutive }) {
  const regressions = rows.filter(r => r.type === 'regression')
  const improvements = rows.filter(r => r.type === 'improvement')
  const count = (list) => new Set(list.map(r => r.student_id)).size
  const consecutiveList = consecutive.length
    ? consecutive.map(c => `- ${c.student_name}: regressed ${prev_month} → ${from_month} and again ${from_month} → ${to_month}`
      + ` (${c.skill_areas.join(', ') || 'various skills'}${c.same_indicators ? `; ${c.same_indicators} indicator(s) dropped both times` : ''})`).join('\n')
    : 'None'

  return `Analyze this student progress data for ${program} class, comparing ${from_month} to ${to_month}:

REGRESSIONS (${count(regressions)} students):
${listByStudent(regressions)}

CONSECUTIVE REGRESSIONS:
${consecutiveList}

IMPROVEMENTS (${count(improvements)} students):
${listByStudent(improvements)}

Please provide:
1. Key patterns observed
2. Skills needing most attention
3. Students needing immediate support (especially consecutive regressions)
4. Specific action recommendations for teachers
5. Parent communication suggestions

Keep response practical and concise for busy preschool teachers.

Return ONLY valid JSON, no other text:
{
  "summary": "2-3 sentence overview of the class",
  "key_patterns": ["short point", "..."],
  "skills_needing_attention": [{ "skill": "skill or area name", "reason": "why" }],
  "students_needing_support": [{ "student": "student name", "concern": "what is slipping", "action": "what to do this week" }],
  "teacher_actions": ["specific, practical action", "..."],
  "parent_communication": ["suggestion for what to tell parents and how", "..."]
}`
}

export async function POST(request) {
  try {
    const { insight_id, school_id, program, from_month, to_month } = await request.json()
    if (!insight_id) return Response.json({ error: 'insight_id is required' }, { status: 400 })
    const auth = await authorizeAdmin(request, school_id)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase } = auth

    // Analyse the saved comparison rather than trusting a copy sent from the browser.
    const { data: insight, error: loadError } = await supabase.from('progress_insights')
      .select('id, program, from_month, to_month, regression_data')
      .eq('id', insight_id).eq('school_id', school_id).maybeSingle()
    if (loadError) throw new Error(loadError.message)
    if (!insight) return Response.json({ error: 'Analysis not found' }, { status: 404 })

    const data = insight.regression_data || {}
    if (!data.rows?.length) return Response.json({ error: 'No ratings were compared in this analysis' }, { status: 400 })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: buildPrompt({
            program: insight.program || program,
            from_month: insight.from_month || from_month,
            to_month: insight.to_month || to_month,
            prev_month: data.prev_month,
            rows: data.rows,
            consecutive: data.consecutive || [],
          })
        }]
      })
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error?.message || 'AI request failed')
    const content = result.content[0].text
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const ai = JSON.parse(cleanContent)

    // Both columns are text; they hold JSON so the page can lay the sections out.
    const ai_insights = {
      summary: ai.summary || '',
      key_patterns: ai.key_patterns || [],
      skills_needing_attention: ai.skills_needing_attention || [],
      students_needing_support: ai.students_needing_support || [],
    }
    const ai_recommendations = {
      teacher_actions: ai.teacher_actions || [],
      parent_communication: ai.parent_communication || [],
    }
    const generated_at = new Date().toISOString()

    const { error: updateError } = await supabase.from('progress_insights').update({
      ai_insights: JSON.stringify(ai_insights),
      ai_recommendations: JSON.stringify(ai_recommendations),
      generated_at,
    }).eq('id', insight_id)
    if (updateError) throw new Error(updateError.message)

    return Response.json({ success: true, ai_insights, ai_recommendations, generated_at })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
