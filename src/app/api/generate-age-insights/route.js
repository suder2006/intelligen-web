export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { authorizeAdmin } from '@/lib/adminAuth'

// Keeps the prompt and the per-child answer a manageable size for large classes.
const MAX_CHILDREN = 25
const MAX_INDICATORS = 12

const SYSTEM_PROMPT = 'You are an expert early childhood development specialist and educator in India. You analyze student developmental data and provide practical, immediate intervention strategies for preschool teachers and administrators.'

const indicatorName = (i) => [i.skill_area, i.indicator].filter(Boolean).join(' › ') || 'Unnamed indicator'

const ageText = (months) => months == null ? 'not recorded' : `${Math.floor(months / 12)} years ${months % 12} months`

// Every indicator the child hasn't achieved this month, Emerging first.
function childBlock(child) {
  const items = [
    ...child.emerging.map(i => `- ${indicatorName(i)}: Emerging`),
    ...child.developing.map(i => `- ${indicatorName(i)}: Developing`),
  ]
  const lines = items.slice(0, MAX_INDICATORS)
  if (items.length > MAX_INDICATORS) lines.push(`- ...and ${items.length - MAX_INDICATORS} more`)
  return `Student: ${child.student_name}, Age: ${ageText(child.age_months)}\nIndicators not achieved:\n${lines.join('\n')}`
}

const concernList = (children) => children.length ? children.map(childBlock).join('\n\n') : 'None'

function buildPrompt({ program, month, data, high, medium }) {
  const omitted = (data.high?.length || 0) + (data.medium?.length || 0) - high.length - medium.length
  return `Analyze this monthly assessment for ${program} class for ${month}.

These children have not achieved their monthly indicators. Every child in ${program} is expected to achieve all of this month's indicators. Please provide immediate intervention strategies.

HIGH CONCERN (has Emerging indicators - address immediately):
${concernList(high)}

MEDIUM CONCERN (has Developing indicators - monitor and support):
${concernList(medium)}
${omitted > 0 ? `\n(${omitted} more flagged children are not listed here.)\n` : ''}
Please provide for EACH child:
1. Immediate classroom strategies
2. Specific activities to help
3. Parent involvement suggestions
4. Timeline for reassessment
5. When to consider specialist referral

Keep recommendations practical and immediately actionable for busy preschool teachers in India.

Keep each list to 2-3 short items. Return ONLY valid JSON, no other text:
{
  "summary": "2-3 sentence overview of the class",
  "children": [
    {
      "student": "student name exactly as given",
      "concern": "high or medium",
      "classroom_strategies": ["..."],
      "activities": ["..."],
      "parent_involvement": ["..."],
      "reassessment_timeline": "e.g. Reassess in 4 weeks",
      "specialist_referral": "when a referral would be warranted"
    }
  ],
  "general_recommendations": ["class-wide suggestion", "..."]
}`
}

export async function POST(request) {
  try {
    const { insight_id, school_id, program, month } = await request.json()
    if (!insight_id) return Response.json({ error: 'insight_id is required' }, { status: 400 })
    const auth = await authorizeAdmin(request, school_id)
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })
    const { supabase } = auth

    // Analyse the saved check rather than trusting a copy sent from the browser.
    const { data: insight, error: loadError } = await supabase.from('age_appropriate_insights')
      .select('id, program, month, analysis_data')
      .eq('id', insight_id).eq('school_id', school_id).maybeSingle()
    if (loadError) throw new Error(loadError.message)
    if (!insight) return Response.json({ error: 'Analysis not found' }, { status: 404 })

    const data = insight.analysis_data || {}
    const high = (data.high || []).slice(0, MAX_CHILDREN)
    const medium = (data.medium || []).slice(0, Math.max(0, MAX_CHILDREN - high.length))
    if (!high.length && !medium.length) {
      return Response.json({ error: 'No children are flagged in this check, so there is nothing to analyse.' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: buildPrompt({ program: insight.program || program, month: insight.month || month, data, high, medium })
        }]
      })
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error?.message || 'AI request failed')
    if (result.stop_reason === 'max_tokens') throw new Error('The AI response was too long. Please try again.')
    const content = result.content[0].text
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const ai = JSON.parse(cleanContent)

    // Both columns are text; they hold JSON so the page can lay the sections out.
    const ai_insights = { summary: ai.summary || '' }
    const ai_recommendations = {
      children: ai.children || [],
      general_recommendations: ai.general_recommendations || [],
    }
    const generated_at = new Date().toISOString()

    const { error: updateError } = await supabase.from('age_appropriate_insights').update({
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
