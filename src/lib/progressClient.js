import { supabase } from '@/lib/supabase'

// Browser helpers shared by the progress analysis panels (RegressionAnalysis, AgeCheck).

export const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

// ai_insights / ai_recommendations are text columns holding JSON; older or hand-edited rows may be plain text.
export const parseAi = (text) => {
  if (!text) return null
  try { return JSON.parse(text) } catch { return { summary: text } }
}

const authHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token || ''}` }
}

// fetch with the signed-in user's token; throws the route's error message on failure.
export async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...options.headers } })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
  return json
}

// Base styles for a panel, scoped under `scope` so they work on the admin and teacher pages alike.
export const panelCss = (scope) => `
  ${scope} .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; margin-bottom: 10px; }
  ${scope} .tab { padding: 8px 16px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.07); }
  ${scope} .tab-active { background: rgba(167,139,250,0.15); color: #a78bfa; border-color: rgba(167,139,250,0.3); }
  ${scope} .btn-primary { background: linear-gradient(135deg, #a78bfa, #818cf8); border: none; border-radius: 10px; padding: 10px 20px; color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  ${scope} .btn-primary:disabled { opacity: 0.6; cursor: default; }
  ${scope} .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 9px 18px; color: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
  ${scope} .section-label { color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; }
  ${scope} .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
  ${scope} .stat-card { margin-bottom: 0; }
  ${scope} .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  ${scope} .badge-red { background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.35); }
  ${scope} .ai-card { border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.06); }
  ${scope} .ai-heading { color: #a78bfa; font-weight: 700; font-size: 13px; margin-bottom: 6px; }
  ${scope} .ai-list { padding-left: 18px; color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.6; }
  ${scope} .ai-list li { margin-bottom: 4px; }
  ${scope} .history-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 6px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.07); }
  ${scope} .history-item:hover { background: rgba(255,255,255,0.07); }
  ${scope} .history-active { border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.1); }
  ${scope} .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(15,23,42,0.3); border-top-color: #0f172a; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: -2px; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 640px) { ${scope} .stats { grid-template-columns: 1fr; } }
`
