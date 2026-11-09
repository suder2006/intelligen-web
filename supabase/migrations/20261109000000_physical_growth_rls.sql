-- physical_growth RLS. Replaces school_access_growth (ALL, any signed-in user
-- of the row's school, no role check), which let teachers and parents approve,
-- edit or delete any growth record of their school.
--   school_admin, center_head: full access to their own school's rows
--   super_admin:               full access to every school's rows
--   teacher, staff:            read their own school's rows; insert only new
--                              pending rows measured by themselves, with no
--                              approval set. No update or delete.
--   parent:                    parents_read_growth is kept unchanged
--                              (approved rows of their own children)
--   anon:                      no access (every policy is for authenticated only)
-- /api/admin/growth uses the service role, which bypasses RLS and checks the
-- caller itself.

begin;

drop policy if exists "school_access_growth" on public.physical_growth;

-- Make the file re-runnable.
drop policy if exists "physical_growth_admin_all" on public.physical_growth;
drop policy if exists "physical_growth_super_admin_all" on public.physical_growth;
drop policy if exists "physical_growth_teacher_select" on public.physical_growth;
drop policy if exists "physical_growth_teacher_insert" on public.physical_growth;

alter table public.physical_growth enable row level security;

create index if not exists physical_growth_school_id_idx
  on public.physical_growth (school_id);

create policy "physical_growth_admin_all" on public.physical_growth
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
      and pr.school_id = physical_growth.school_id
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('school_admin', 'center_head')
      and pr.school_id = physical_growth.school_id
  ));

create policy "physical_growth_super_admin_all" on public.physical_growth
  for all to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'super_admin'
  ));

create policy "physical_growth_teacher_select" on public.physical_growth
  for select to authenticated
  using (exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid()
      and pr.role in ('teacher', 'staff')
      and pr.school_id = physical_growth.school_id
  ));

create policy "physical_growth_teacher_insert" on public.physical_growth
  for insert to authenticated
  with check (
    physical_growth.status = 'pending'
    and physical_growth.measured_by = auth.uid()
    and physical_growth.approved_by is null
    and physical_growth.approved_at is null
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid()
        and pr.role in ('teacher', 'staff')
        and pr.school_id = physical_growth.school_id
    )
  );

commit;

-- Check afterwards:
--   select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'physical_growth';
-- Expected: parents_read_growth plus the four policies above.
