-- Role a staff member had before being deactivated (role = 'inactive'), so
-- /api/admin/staff-status can restore it on reactivation.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS previous_role text;
