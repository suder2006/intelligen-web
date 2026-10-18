// Server-only: AI story generation for story_plans, one plan per school + program + week.

export const STORY_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

// Age band and length per program. Programs come from curriculum_masters, so match by name
// and fall back to a middle band for any program not listed here.
const PROGRAM_PROFILES = {
  playgroup: { age_range: '2-3 years', word_count: '150-200', read_time: '2-3 minutes' },
  nursery: { age_range: '3-4 years', word_count: '200-300', read_time: '3-4 minutes' },
  lkg: { age_range: '4-5 years', word_count: '300-400', read_time: '5-6 minutes' },
  ukg: { age_range: '5-6 years', word_count: '400-500', read_time: '6-8 minutes' },
}
const DEFAULT_PROFILE = { age_range: '3-5 years', word_count: '250-350', read_time: '4-5 minutes' }

export function getProgramProfile(program) {
  const key = (program || '').toLowerCase().replace(/[^a-z]/g, '')
  return PROGRAM_PROFILES[key] || DEFAULT_PROFILE
}

// Themes and tones are shuffled per plan so the five days of a week never share one.
const THEMES = [
  'everyday family life', 'friendship', 'nature and seasons', 'a small scientific discovery',
  'a festival or celebration', 'a city or village adventure', 'animals behaving like animals',
  'a gentle fantasy world', 'food and cooking', 'weather and sky', 'a new skill or first try',
  'helping in the neighbourhood', 'music, sounds and rhythm', 'a lost-and-found mystery',
  'machines, vehicles and how things work', 'the ocean, rivers or ponds', 'a game at school',
  'grandparents and stories of long ago', 'shapes, colours and numbers in the world', 'a tiny creature with a big job',
]
const TONES = ['funny', 'adventurous', 'heartwarming', 'gently mysterious', 'imaginative', 'curious and educational', 'playful']

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SYSTEM_PROMPT = `You are an internationally acclaimed children's storyteller and early childhood education specialist, creating imaginative, original, emotionally engaging stories for children aged 2–6.

Your stories should feel like they were written by an exceptionally creative human storyteller, not generated from a repetitive template.

**CREATIVITY & ORIGINALITY**
- Create fresh characters, settings, conflicts, discoveries, and endings.
- Explore diverse worlds: everyday childhood experiences, nature, animals, imaginative fantasy, science, friendship, family, adventures, and unexpected discoveries.
- Avoid repeatedly using the same characters, settings, opening phrases, story structures, or moral lessons.
- Do not default to talking animals, magical forests, princesses, or predictable happy endings.
- Introduce delightful surprises, gentle humour, curiosity, and imaginative twists.
- Make stories culturally inclusive and relatable to children from different backgrounds, including Indian children.
- Never reproduce copyrighted stories or closely imitate existing characters, franchises, or recognizable storylines.

**AGE-APPROPRIATE STORYTELLING**
- Adapt vocabulary, sentence length, plot complexity, and story duration to the specified age group.
- For ages 2–3: Use very simple language, repetition, familiar experiences, sounds, and playful actions.
- For ages 3–4: Include simple adventures, cause-and-effect relationships, emotions, and engaging discoveries.
- For ages 4–5: Introduce imaginative problems, creative solutions, humour, and curiosity.
- For ages 5–6: Include richer adventures, clever thinking, unexpected developments, and meaningful character growth.
- Keep every story emotionally safe, positive, and developmentally appropriate.

**STORY QUALITY**
- Begin with an engaging opening that immediately captures attention.
- Develop a clear beginning, middle, and satisfying ending.
- Use natural dialogue and vivid but simple sensory descriptions.
- Include moments of surprise, wonder, humour, or emotional connection.
- Allow characters to discover and solve problems naturally.
- Avoid unnecessary explanations and overly complicated vocabulary.
- Do not force a moral lesson into every story.
- When appropriate, weave in kindness, empathy, creativity, resilience, teamwork, curiosity, or problem-solving through actions rather than lectures.

**VARIETY**
- Vary narrative structures, storytelling styles, pacing, and endings.
- Some stories may be funny, some adventurous, some heartwarming, some mysterious, and others imaginative or educational.
- Avoid formulaic openings such as "Once upon a time" unless specifically appropriate.
- Never use the same recurring story formula.
- If previous story summaries are provided, actively avoid similar characters, settings, conflicts, and resolutions.

**OUTPUT**
- Provide an interesting, child-friendly story title.
- Write a complete, polished story ready for parents or teachers to read aloud.
- Use natural paragraph breaks and dialogue.
- Do not include introductory AI commentary.
- Do not add explanations, educational objectives, or moral summaries unless requested.
- Ensure the story feels fresh, memorable, and enjoyable when read aloud.`

const STORY_SHAPE = `{
    "title": "Story title",
    "category": "Short category, e.g. Funny Adventure",
    "emoji": "One emoji that fits the story",
    "story": "Complete story text with paragraph breaks (\\n\\n) and dialogue",
    "moral": "One short sentence a child can remember",
    "questions": ["Three simple questions for parents to ask the child"],
    "activity": { "title": "Short activity name", "description": "One fun follow-up activity to do at home" }
  }`

function buildUserPrompt({ program, days, recentSummaries }) {
  const profile = getProgramProfile(program)
  const themes = shuffle(THEMES)
  const tones = shuffle(TONES)

  const perDay = days.map((day, i) => {
    const dayName = day[0].toUpperCase() + day.slice(1)
    return `- ${dayName}: preferred theme "${themes[i]}", story tone "${tones[i % tones.length]}"`
  }).join('\n')

  const summaries = recentSummaries.length > 0
    ? recentSummaries.map(s => `- ${s}`).join('\n')
    : '- (none)'

  const plural = days.length > 1
  const jsonExample = `{\n${days.map(d => `  "${d}": ${STORY_SHAPE}`).join(',\n')}\n}`

  return `Create ${plural ? `${days.length} original, imaginative, engaging stories` : 'an original, imaginative, engaging story'} for children in the ${program} program, aged ${profile.age_range}${plural ? ', one for each school day listed below' : ''}.

Story requirements:
- Target length: ${profile.word_count} words${plural ? ' per story' : ''} (about ${profile.read_time} read aloud).
- Story language: English.
- Suitable for parents and teachers to read aloud.
- Use age-appropriate vocabulary, dialogue, and storytelling complexity.
- Include a memorable character, an interesting situation, and a satisfying ending.
- Make the story entertaining first, with learning emerging naturally.
- Write a completely unique and fresh story for ${program} children aged ${profile.age_range}.
- Give each story a strong beginning, middle and end, and include dialogue.
- Surprise with unexpected characters and settings, different from typical children's stories.
- Each story should leave the child with one clear, gentle takeaway, shown through what the characters do.

${plural ? 'Theme and tone for each day:' : 'Theme and tone:'}
${perDay}
${plural ? '\nEvery story in this set must have different characters, settings and story structures from the others.\n' : ''}
Previous story summaries to avoid repeating (never reuse these characters, and do not write the same type of story):
${summaries}

Return ONLY valid JSON, no other text, in exactly this shape:
${jsonExample}`
}

function summarize(story) {
  if (!story?.title) return null
  const firstSentence = (story.story || '').split(/(?<=[.!?])\s/)[0]?.slice(0, 180) || ''
  return `"${story.title}" (${story.category || 'story'}): ${firstSentence}`
}

// Summaries of this program's stories from plans in the last 7 days before weekStart,
// plus any other days of the plan being regenerated.
export async function getRecentStorySummaries(supabase, { schoolId, program, weekStart, extraStories = [] }) {
  const since = new Date(weekStart + 'T12:00:00Z')
  since.setUTCDate(since.getUTCDate() - 7)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: recentPlans } = await supabase
    .from('story_plans')
    .select('week_start_date, monday, tuesday, wednesday, thursday, friday')
    .eq('school_id', schoolId)
    .eq('program', program)
    .gte('week_start_date', sinceStr)
    .lt('week_start_date', weekStart)

  const stories = [
    ...(recentPlans || []).flatMap(p => STORY_DAYS.map(d => p[d])),
    ...extraStories,
  ]
  return stories.map(summarize).filter(Boolean)
}

// Calls Claude and returns { [day]: story } for the requested days.
export async function generateStories({ program, days = STORY_DAYS, recentSummaries = [] }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: days.length > 1 ? 12000 : 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt({ program, days, recentSummaries }) }]
    })
  })

  const data = await response.json()
  if (!data.content || !data.content[0]) {
    throw new Error(`Invalid story API response: ${data.error?.message || JSON.stringify(data).slice(0, 200)}`)
  }

  const cleanContent = data.content[0].text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  const plan = JSON.parse(cleanContent)

  for (const day of days) {
    if (!plan[day]?.story) throw new Error(`Story missing for ${day}`)
  }
  return plan
}
