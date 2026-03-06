import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wmxywsbrfbmyatzaehre.supabase.co'
const supabaseKey = 'sb_publishable_RbwxJkZPkfbDKqaZPxQT5g_zKZjK8P5'

export const supabase = createClient(supabaseUrl, supabaseKey)
