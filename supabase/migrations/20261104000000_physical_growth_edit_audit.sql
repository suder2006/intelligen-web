-- Who last edited a growth record from the admin page, and when.
-- Written by /api/admin/growth (service role).
ALTER TABLE public.physical_growth
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at timestamptz;
